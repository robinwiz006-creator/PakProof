#!/usr/bin/env python3
"""Manual, opt-in backup; restore destination is ONLY a new network-isolated Docker container.
No hosted credentials are read from environment variables. Never print tool stderr/data.
"""
from __future__ import annotations
import argparse
import contextlib
import datetime as dt
import getpass
import hashlib
import json
import os
from pathlib import Path
import queue
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

PROJECT = "wizlluiyhsxtsxpuwudc"
IMAGE = "postgres:17-alpine"
ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT_SQL = Path(__file__).with_name("recovery_snapshot.sql").read_text(encoding="utf-8")
OPTIONS = "-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog -c extra_float_digits=3"
COMPARE = ("schemas", "tables", "sequences", "relation_acls", "functions", "views", "policies", "triggers", "constraints", "indexes", "schema_acls", "column_acls", "storage", "memberships", "auth_orphan_identity_count")

class SafeError(Exception):
    pass

def check(ok, message):
    if not ok:
        raise SafeError(message)

def stamp():
    return dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")

def sql_string(value):
    return "'" + str(value).replace("'", "''") + "'"

def sql_id(value):
    return '"' + str(value).replace('"', '""') + '"'

def outside_git(path):
    p = Path(path).expanduser().resolve()
    check(not p.is_relative_to(ROOT), "Recovery material must be outside the repository.")
    for parent in [p, *p.parents]:
        check(not (parent / ".git").exists(), "Recovery material must be outside every Git working tree.")
    check("," not in str(p) and "\n" not in str(p), "Choose a recovery path without commas or newlines.")
    return p

def run(args, *, data=None, output=None, timeout=900, stage="tool"):
    # stderr may contain personal rows, URLs or connection details. Never print/save it.
    try:
        result = subprocess.run(args, input=data, stdout=output or subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        raise SafeError(f"{stage}: tool unavailable or timed out; no recovery success recorded.") from None
    check(result.returncode == 0, f"{stage}: command failed (exit {result.returncode}); review the guide, not raw private logs.")
    return result.stdout if output is None else b""

def private_dir(path):
    path.mkdir(mode=0o700, parents=False, exist_ok=False)
    if os.name == "nt":
        who = run(["whoami", "/user", "/fo", "csv", "/nh"], stage="Windows identity")
        sid = re.search(rb"S-1-[0-9-]+", who)
        check(sid is not None, "Could not determine the current Windows SID.")
        run(["icacls", str(path), "/inheritance:r", "/grant:r", "*" + sid[0].decode() + ":(OI)(CI)F"], stage="private folder ACL")
    else:
        path.chmod(0o700)

def write_bytes(path, data):
    with path.open("xb") as f:
        if os.name != "nt": os.fchmod(f.fileno(), 0o600)
        f.write(data)

def write_json(path, data):
    write_bytes(path, json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"))

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""): h.update(chunk)
    return h.hexdigest()

class Docker:
    def __init__(self, network="bridge", bundle=None, server=False):
        self.name = "proofpak-recovery-" + uuid.uuid4().hex[:12]
        self.server = server
        args = ["docker", "run", "-d", "--name", self.name, "--label", "proofpak.recovery=local-only",
                "--network", network, "--log-driver=none", "--tmpfs", "/run/proofpak:rw,nosuid,nodev,mode=0700"]
        if bundle:
            args += ["--mount", f"type=bind,source={outside_git(bundle)},target=/backup,readonly"]
        if server:
            check(network == "none", "Restore servers must have network=none.")
            args += ["--tmpfs", "/var/lib/postgresql/data:rw,nosuid,nodev,size=2g",
                     "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE, "-c", "log_min_messages=panic",
                     "-c", "log_min_error_statement=panic", "-c", "log_statement=none"]
        else:
            args += ["--entrypoint", "sleep", IMAGE, "infinity"]
        try:
            run(args, stage="isolated Docker start")
            if server:
                for _ in range(60):
                    r = subprocess.run(["docker", "exec", self.name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if r.returncode == 0: break
                    time.sleep(0.5)
                else: raise SafeError("Local recovery database did not become ready.")
        except Exception:
            self.close(); raise
    def close(self):
        subprocess.run(["docker", "rm", "-f", self.name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    def command(self, args, source=False, readonly=False):
        cmd = ["docker", "exec", "-i"]
        if source: cmd += ["-e", "PGSERVICEFILE=/run/proofpak/service.conf", "-e", "PGSERVICE=source"]
        if readonly or source: cmd += ["-e", "PGOPTIONS=" + OPTIONS]
        return cmd + [self.name] + args
    def execute(self, args, source=False, readonly=False, **kwargs):
        return run(self.command(args, source, readonly), **kwargs)
    def secret_file(self, name, value):
        check(name in ("service.conf", "pgpass", "root.crt"), "Invalid temporary secret filename.")
        self.execute(["sh", "-c", "umask 077; cat > /run/proofpak/" + name + "; chmod 600 /run/proofpak/" + name], data=value, stage="temporary connection setup")
    def configure(self, host, port, user, password, ca=None, fixture=False):
        for value in (host, user, password): check("\n" not in value and "\r" not in value, "Connection values cannot contain newlines.")
        check(re.fullmatch(r"[A-Za-z0-9_.-]+", host) and re.fullmatch(r"[A-Za-z0-9_.-]+", user), "Invalid connection host/user format.")
        if not fixture:
            validate_endpoint(host, port, user)
            check(ca and Path(ca).is_file(), "Download the official database CA certificate and supply --ca-file.")
            self.secret_file("root.crt", Path(ca).read_bytes())
        esc = lambda s: s.replace("\\", "\\\\").replace(":", "\\:")
        self.secret_file("pgpass", (":".join(map(esc, [host, str(port), "postgres", user, password])) + "\n").encode())
        config = f"[source]\nhost={host}\nport={port}\nuser={user}\ndbname=postgres\npassfile=/run/proofpak/pgpass\n"
        config += "sslmode=disable\n" if fixture else "sslmode=verify-full\nsslrootcert=/run/proofpak/root.crt\n"
        self.secret_file("service.conf", config.encode())

@contextlib.contextmanager
def docker(**kwargs):
    d = Docker(**kwargs)
    try: yield d
    finally: d.close()

def validate_endpoint(host, port, user):
    direct = host == f"db.{PROJECT}.supabase.co"
    pooled = host.endswith(".pooler.supabase.com") and user == "postgres." + PROJECT
    check(port == 5432 and (direct or pooled), "Use this project's direct host or session pooler on port 5432; never transaction pooler 6543.")
    check(user == ("postgres" if direct else "postgres." + PROJECT), "Database user must match the confirmed project connection panel.")

class ExportedSnapshot:
    def __init__(self, tool):
        self.p = subprocess.Popen(tool.command(["psql", "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1"], source=True), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.p.stdin.write(b"begin isolation level repeatable read read only; select pg_export_snapshot();\n"); self.p.stdin.flush()
        q = queue.Queue()
        threading.Thread(target=lambda: q.put(self.p.stdout.readline()), daemon=True).start()
        try: value = q.get(timeout=30).decode().strip()
        except (queue.Empty, UnicodeError): self.close(); raise SafeError("Read-only snapshot connection failed or timed out.") from None
        if not re.fullmatch(r"[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+", value): self.close(); raise SafeError("Read-only snapshot unavailable; verify connection/TLS/permissions.")
        self.id = value
    def close(self):
        if self.p.poll() is None:
            try: self.p.stdin.write(b"rollback;\n"); self.p.stdin.flush(); self.p.stdin.close(); self.p.wait(timeout=10)
            except (OSError, subprocess.TimeoutExpired): self.p.kill(); self.p.wait()
        if self.p.stdout: self.p.stdout.close()

def inventory(tool, source=False, exported=None):
    sql = "begin isolation level repeatable read read only;\n"
    if exported: sql += "set transaction snapshot " + sql_string(exported) + ";\n"
    sql += SNAPSHOT_SQL + "\nrollback;\n"
    args = ["psql", "-X", "-qAt", "--no-password", "-v", "ON_ERROR_STOP=1"]
    if not source: args += ["-U", "postgres", "-d", "postgres"]
    raw = tool.execute(args, source=source, readonly=True, data=sql.encode(), stage="private database inventory")
    try: result = json.loads(raw)
    except (ValueError, UnicodeError): raise SafeError("Database inventory did not return the required private JSON.") from None
    check(result["server_major"] == 17, "This helper is validated for PostgreSQL 17 only; review a matching version first.")
    check(all(result["required_relations"].values()), "Required Auth/Storage relations missing; coverage cannot be assumed.")
    check(result["unsupported_relation_count"] == 0, "Foreign/materialized relations require specialist content verification before using this workflow.")
    check(result["large_object_count"] == 0, "Large objects detected; specialist content verification required before using this workflow.")
    return result

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafeError("Storage redirected; refusing to forward credentials or follow signed/external URLs.")

def object_path(bucket, name):
    check(isinstance(bucket, str) and isinstance(name, str), "Invalid Storage index.")
    for value in (bucket, name):
        check(value and not value.startswith("/") and all(ord(c) >= 32 for c in value), "Unsupported Storage key; review privately.")
        check(not any(p in (".", "..") for p in value.split("/")), "Unsupported Storage path segments; no path traversal allowed.")
    return "/storage/v1/object/authenticated/" + urllib.parse.quote(bucket, safe="") + "/" + urllib.parse.quote(name, safe="/")

def fetch_storage(bucket, name, key):
    url = "https://" + PROJECT + ".supabase.co" + object_path(bucket, name)
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + key, "apikey": key})
    opener = urllib.request.build_opener(NoRedirect())
    try: return opener.open(request, timeout=60)
    except SafeError: raise
    except Exception: raise SafeError("Storage download failed; details/URLs withheld. Coverage is incomplete.") from None

def copy_stream(response, path):
    with path.open("xb") as target:
        if os.name != "nt": os.fchmod(target.fileno(), 0o600)
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk: break
            target.write(chunk)

def export_bundle(tool, parent, storage_reader=None):
    parent = outside_git(parent)
    check(parent.is_dir(), "Create the encrypted private parent folder first.")
    bundle = parent / ("proofpak-recovery-" + stamp() + "-" + uuid.uuid4().hex[:6])
    private_dir(bundle)
    write_bytes(bundle / ".gitignore", b"*\n")
    write_bytes(bundle / ".vercelignore", b"**\n")
    manifest = {"format": 1, "project_reference": PROJECT, "created_utc": stamp(), "backup_created": False,
                "complete_supabase_project_recovery": False, "files": {}, "limitations": [
                    "Control-plane/Auth provider/SMTP/API/JWT/Vercel secrets and external evidence files are not in this archive.",
                    "Database role passwords are excluded; role settings/default ACLs are inventory/reference only in local rehearsal.",
                    "Excluded schemas/Vault/Realtime/platform state require owner review; no full-project recovery claim."]}
    snapshot = ExportedSnapshot(tool)
    try:
        source = inventory(tool, source=True, exported=snapshot.id)
        write_json(bundle / "source-snapshot.json", source)
        # All selected Auth and Storage records explicitly included; no default CLI exclusions.
        args = ["pg_dump", "--no-password", "--format=custom", "--large-objects", "--strict-names", "--lock-wait-timeout=10000", "--snapshot=" + snapshot.id]
        for schema in source["schemas"]: args += ["--schema=" + schema]
        for name, version, schema in source["extensions"]:
            if schema in source["schemas"]: args += ["--extension=" + name]
        with (bundle / "database.pgdump").open("xb") as f:
            if os.name != "nt": os.fchmod(f.fileno(), 0o600)
            tool.execute(args, source=True, output=f, stage="database archive export")
        with (bundle / "roles-reference.sql").open("xb") as f:
            if os.name != "nt": os.fchmod(f.fileno(), 0o600)
            tool.execute(["pg_dumpall", "--roles-only", "--no-role-passwords", "--no-password"], source=True, output=f, stage="roles reference export")
        objects = source["storage"]["objects"]
        records = []
        blob_dir = bundle / "storage-blobs"
        private_dir(blob_dir)
        for item in objects:
            bucket, name = item["bucket_id"], item["name"]
            object_path(bucket, name)
            check(storage_reader is not None, "Storage objects exist; an authorized file download method is required.")
            filename = hashlib.sha256((bucket + "\0" + name).encode()).hexdigest() + ".blob"
            with storage_reader(bucket, name) as stream: copy_stream(stream, blob_dir / filename)
            size = (blob_dir / filename).stat().st_size
            expected = (item.get("metadata") or {}).get("size")
            check(expected is None or int(expected) == size, "Storage byte length mismatch; do not mark backup complete.")
            records.append({"bucket_id": bucket, "name": name, "file": "storage-blobs/" + filename, "bytes": size, "sha256": digest(blob_dir / filename)})
        write_json(bundle / "storage-index.json", records)
        # Storage bytes aren't part of the SQL snapshot. Require unchanged observed metadata.
        end = inventory(tool, source=True)
        check(source["storage"] == end["storage"], "Storage metadata changed during export. Keep this bundle INCOMPLETE and repeat in a quiet window.")
        manifest["storage"] = {"bucket_count": len(source["storage"]["buckets"]), "object_count": len(records),
                               "mode": "files_exported" if records else "verified_empty_objects_at_capture"}
        manifest["source_server_version"] = source["server_version"]
        manifest["tools"] = {"image": IMAGE, "pg_dump": tool.execute(["pg_dump", "--version"]).decode().strip(), "helper_sha256": digest(Path(__file__)), "snapshot_sql_sha256": digest(Path(__file__).with_name("recovery_snapshot.sql"))}
        manifest["backup_created"] = True
        for path in bundle.rglob("*"):
            if path.is_file() and not path.name.startswith("."):
                manifest["files"][path.relative_to(bundle).as_posix()] = {"bytes": path.stat().st_size, "sha256": digest(path)}
        write_json(bundle / "manifest.json", manifest)
        return bundle
    finally:
        snapshot.close()


def load_bundle(bundle):
    bundle = outside_git(bundle)
    try: m = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError): raise SafeError("No complete backup manifest found; incomplete bundles are not usable recovery evidence.") from None
    check(m.get("format") == 1 and m.get("project_reference") == PROJECT and m.get("backup_created") is True, "Backup manifest is incomplete or for another project/version.")
    check({"database.pgdump", "roles-reference.sql", "source-snapshot.json", "storage-index.json"} <= set(m.get("files", {})), "Required recovery files missing from manifest.")
    for name, expected in m["files"].items():
        relative = Path(name)
        check(not relative.is_absolute() and ".." not in relative.parts and "\\" not in name, "Unsafe manifest path.")
        path = bundle / relative
        check(not path.is_symlink() and path.resolve().is_relative_to(bundle), "Unsafe recovery file link.")
        check(path.is_file() and path.stat().st_size == expected["bytes"] and digest(path) == expected["sha256"], "Recovery file missing or checksum differs; no verification success.")
    return bundle, m

def archive_verify(bundle):
    bundle, manifest = load_bundle(bundle)
    with docker(network="none", bundle=bundle) as tool:
        toc = tool.execute(["pg_restore", "--list", "/backup/database.pgdump"], stage="archive table-of-contents validation")
        check(bool(toc.strip()), "Archive table of contents empty.")
    return {"archive_integrity_verified": True, "manifest_sha256": digest(bundle / "manifest.json"), "meaning": "File hashes and archive TOC only; no restore claim."}

def role_bootstrap(source):
    # roles-reference.sql is retained privately but NOT blindly replayed.
    commands = []
    for r in source["roles"]:
        if r["name"] == "postgres": continue  # keep isolated restore administrator operational
        flags = ["NOLOGIN"]
        for field, yes, no in [("superuser", "SUPERUSER", "NOSUPERUSER"), ("inherit", "INHERIT", "NOINHERIT"), ("create_role", "CREATEROLE", "NOCREATEROLE"), ("create_db", "CREATEDB", "NOCREATEDB"), ("replication", "REPLICATION", "NOREPLICATION"), ("bypass_rls", "BYPASSRLS", "NOBYPASSRLS")]: flags.append(yes if r[field] else no)
        commands.append("create role " + sql_id(r["name"]) + " " + " ".join(flags) + ";")
    for m in source["memberships"]:
        flags = ", ".join(k.upper() + " " + ("TRUE" if m[k] else "FALSE") for k in ("admin", "inherit", "set"))
        commands.append("grant " + sql_id(m["role"]) + " to " + sql_id(m["member"]) + " with " + flags + ";")
    return "\n".join(commands)

def compare_snapshots(source, restored):
    mismatches = [key for key in COMPARE if source[key] != restored[key]]
    # Only in-scope extensions are expected from the selected-schema archive.
    scoped = lambda x: [e for e in x["extensions"] if e[2] in source["schemas"]]
    if scoped(source) != scoped(restored): mismatches.append("in_scope_extensions")
    for name in ("anon", "authenticated", "service_role"):
        left = next((r for r in source["roles"] if r["name"] == name), None)
        right = next((r for r in restored["roles"] if r["name"] == name), None)
        if left and (not right or any(left[k] != right[k] for k in ("superuser", "inherit", "bypass_rls"))): mismatches.append("client_role_flags")
    if source["auth_orphan_identity_count"] or restored["auth_orphan_identity_count"]: mismatches.append("auth_identity_orphans")
    return sorted(set(mismatches))

def rehearse(bundle):
    bundle, manifest = load_bundle(bundle)
    integrity = archive_verify(bundle)
    source = json.loads((bundle / "source-snapshot.json").read_text(encoding="utf-8"))
    index = json.loads((bundle / "storage-index.json").read_text(encoding="utf-8"))
    report = {**integrity, "restore_completed": False, "recovery_checks_passed": False,
              "full_supabase_project_recovery_verified": False, "storage_api_reimport_tested": False}
    with docker(network="none", bundle=bundle, server=True) as target:
        # Only this newly created, unexposed container is a restore destination.
        args = ["psql", "-X", "-q", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"]
        target.execute(args, data=role_bootstrap(source).encode(), stage="isolated role scaffolding")
        target.execute(args, data=b"drop schema public cascade;", stage="empty local target preparation")
        target.execute(["pg_restore", "--exit-on-error", "-U", "postgres", "-d", "postgres", "/backup/database.pgdump"], stage="isolated archive restore")
        # pg_dump treats initdb's PUBLIC USAGE on schema public as a baseline.
        # Re-establish only privileges explicitly present in the captured source.
        public = next(x for x in source["schema_acls"] if x["name"] == "public")
        for grantee, grantor, privilege, grantable in public["acl"]:
            if grantee == "PUBLIC":
                check(privilege in ("CREATE", "USAGE"), "Unsupported captured schema privilege.")
                statement = "set role " + sql_id(grantor) + "; grant " + privilege + " on schema public to PUBLIC" + (" with grant option" if grantable else "") + "; reset role;"
                target.execute(args, data=statement.encode(), stage="captured public-schema ACL restoration")
        report["restore_completed"] = True
        restored = inventory(target)
        mismatches = compare_snapshots(source, restored)
        # Recover bytes to a second private folder on the same encrypted parent, never use object keys as paths.
        copied = bundle.parent / ("proofpak-file-recovery-" + uuid.uuid4().hex[:8])
        private_dir(copied)
        try:
            for item in index:
                check(item["file"] in manifest["files"], "Storage index references unverified data.")
                dest = copied / Path(item["file"]).name
                with (bundle / item["file"]).open("rb") as stream: copy_stream(stream, dest)
                check(digest(dest) == item["sha256"] and dest.stat().st_size == item["bytes"], "Recovered Storage file mismatch.")
        finally: shutil.rmtree(copied)
        report.update({"recovery_checks_passed": not mismatches, "mismatched_sections": mismatches,
                       "database_table_count": len(source["tables"]), "storage_files_recovered": len(index),
                       "storage_bytes_recovered": sum(i["bytes"] for i in index),
                       "limitations": ["Local SQL/Auth-record recovery is not a hosted Auth login or email test.", "Role passwords/settings/default ACLs and external managed configuration require separate review.", "Storage bytes/metadata recovered locally; no Supabase Storage API import was performed.", "Excluded schemas, Vault secrets, external evidence and actual chain history are outside this scope."]})
    reports = bundle / "checks"
    if not reports.exists(): private_dir(reports)
    path = reports / ("restore-" + stamp() + "-" + uuid.uuid4().hex[:6] + ".json")
    write_json(path, report)
    check(report["recovery_checks_passed"], "Restore finished but recovery comparisons differ; see the private report, not user records in console.")
    return report


def authorize_encryption():
    print("Use an encrypted backup volume AND an encrypted/trusted host/Docker disk. The helper does not encrypt drives.")
    check(input("Type ENCRYPTED to confirm this has been checked: ").strip() == "ENCRYPTED", "Encrypted storage confirmation required.")

def backup_command(args):
    check(sys.stdin.isatty(), "Backup requires an interactive terminal with hidden password input; do not pipe credentials.")
    check(args.authorize_production_read, "No production connection attempted. Explicit manual authorization flag is required.")
    check(input("Type BACKUP " + PROJECT + " to authorize this read-only export: ").strip() == "BACKUP " + PROJECT, "Backup not authorized.")
    authorize_encryption()
    check(input("Type QUIET after arranging no schema/role/Storage changes during capture: ").strip() == "QUIET", "Quiet-window confirmation required.")
    parent = outside_git(args.output_parent)
    check(parent.is_dir(), "Create the encrypted private parent folder first.")
    host = input("Database direct/session-pooler hostname from Supabase Connect: ").strip()
    user = input("Database username from that same panel: ").strip()
    validate_endpoint(host, 5432, user)
    password = getpass.getpass("Database password (hidden, never sent to chat): ")
    key = None
    def reader(bucket, name):
        nonlocal key
        if key is None: key = getpass.getpass("Storage files exist. Enter the matching server-only service key locally (hidden): ")
        return fetch_storage(bucket, name, key)
    with docker() as tool:
        tool.configure(host, 5432, user, password, args.ca_file)
        bundle = export_bundle(tool, parent, reader)
    print("BACKUP FILES CREATED — NOT RESTORE-VERIFIED.")
    print("Private bundle:", bundle)
    print("Manifest SHA-256:", digest(bundle / "manifest.json"))


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup", help="Authorized read-only production export; never runs by default")
    b.add_argument("--output-parent", required=True); b.add_argument("--ca-file", required=True)
    b.add_argument("--authorize-production-read", action="store_true")
    for name in ("verify", "rehearse"):
        a = sub.add_parser(name); a.add_argument("--bundle", required=True)
    args = p.parse_args()
    if args.command == "backup": backup_command(args)
    elif args.command == "verify":
        result = archive_verify(args.bundle)
        print("ARCHIVE INTEGRITY CHECK PASSED — RESTORATION NOT YET PROVEN.")
        print("Manifest SHA-256:", result["manifest_sha256"])
    else:
        authorize_encryption()
        result = rehearse(args.bundle)
        print("LOCAL DATABASE RESTORE AND RECOVERY COMPARISONS PASSED.")
        print("Tables checked:", result["database_table_count"], "Storage files recovered:", result["storage_files_recovered"])
        print("FULL SUPABASE PROJECT / AUTH LOGIN / STORAGE API RECOVERY REMAINS UNVERIFIED.")

if __name__ == "__main__":
    try: main()
    except SafeError as e: print("STOP:", e); raise SystemExit(1)
    except KeyboardInterrupt: print("STOP: cancelled; no recovery success is implied."); raise SystemExit(130)
    except Exception: print("STOP: unexpected local error; details withheld to protect private data. No verified recovery claim."); raise SystemExit(1)
