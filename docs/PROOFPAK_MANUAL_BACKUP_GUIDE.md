# ProofPak manual backup guide — Task 17E

**Status: procedure prepared; no production export or restore performed.** Project: `wizlluiyhsxtsxpuwudc`. Stop before the backup command until the owner explicitly authorizes the export. Authorization to back up is not authorization to migrate.

## What this protects

ProofPak needs more than its public tables. Preserve:

| Item                                                                                                | Prepared coverage                                                            | Remaining requirement                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Application records, credentials, original claims, revocations, payments and transaction signatures | Custom-format PostgreSQL archive of `public`                                 | Compare restored counts and row fingerprints                                 |
| Auth users, identities, sessions and other Auth tables                                              | Explicit `auth` schema export; not a default CLI dump that excludes Auth     | Hosted login, provider and email configuration need separate recovery checks |
| Functions, triggers, policies, object ownership, grants and sequences                               | Archive plus catalog inventory and comparison                                | Managed role settings and platform configuration need review                 |
| Roles and memberships                                                                               | Password-free roles reference; local role scaffold and membership comparison | Role passwords, settings and managed role behavior are not fully recreated   |
| Storage buckets, object metadata and policies                                                       | `storage` schema archive                                                     | Actual file contents require authenticated downloads                         |
| Storage file contents                                                                               | Downloads, opaque filenames, byte counts and SHA-256 checks                  | Local file recovery is not a tested Storage API re-import                    |
| Extensions                                                                                          | Inventory of every extension; selected-schema archive                        | Supabase-only extensions may prevent vanilla PostgreSQL restoration          |
| Migration ledger                                                                                    | `supabase_migrations` exported **if present**                                | Missing history stays missing; do not invent applied versions                |
| Environment and hosted settings                                                                     | Manual inventory kept in your password manager                               | Not recovered by a database archive                                          |
| External evidence URLs and blockchain history                                                       | References retained in database                                              | External files and devnet history are not backed up by this process          |

The code has no Supabase Storage API calls or bucket migrations. That does **not** establish that the hosted project has no buckets or files. The helper checks actual metadata at capture and downloads files if present. It does not download external evidence URLs.

## 1. Install and prepare on Windows

1. Install Python 3.12 or newer from <https://www.python.org/downloads/windows/>. Enable the Python launcher.
2. Install Docker Desktop from <https://www.docker.com/products/docker-desktop/> and enable its WSL 2 backend. Start Docker Desktop.
3. Use the existing local ProofPak repository containing `scripts/recovery`. Do not put backups inside it, OneDrive shared folders, GitHub, Vercel or public cloud buckets.
4. Prepare an encrypted, access-controlled drive: BitLocker where supported, or an encrypted VeraCrypt volume. Also protect the Windows system drive and Docker/WSL disk: temporary database memory can spill to swap. A Python folder permission is **not encryption**.
5. Create a folder on that encrypted drive, for example `E:\ProofPak-Recovery`. Keep a second encrypted copy separately after verification. Store encryption recovery material separately in your password manager.
6. Open PowerShell in the repository folder and run:

```powershell
py -3 --version
docker version
docker pull postgres:17-alpine
py -3 scripts/recovery/proofpak_recovery.py --help
```

The CLI uses official PostgreSQL utilities inside Docker; PostgreSQL and the Supabase CLI do not need separate Windows installations. No additional Python packages are required. PostgreSQL 17 is required by this helper. Another source major version must be reviewed, not forced through it. The image tag can receive patches; retain the image digest/version with your recovery evidence.

## 2. Collect settings privately

In Supabase, open the **existing** project and confirm its reference is `wizlluiyhsxtsxpuwudc`.

- Open **Connect**. Copy the direct database hostname and username, or the **session pooler** hostname and username. Use port **5432**, not transaction pooler 6543. For the session pooler the user must be `postgres.wizlluiyhsxtsxpuwudc`.
- Retrieve the existing database password privately. Do not reset it as part of this task. Never paste it into chat, command arguments or a script.
- Download the official database root CA certificate using the project's database SSL connection instructions. Save it locally, for example `E:\ProofPak-Recovery\database-root.crt`. It is a public certificate, not a private key. The helper requires certificate and hostname validation and will not fall back to insecure TLS.
- If Storage has files, the helper will request the matching server-only service key through a hidden local prompt. Never put it in a command, screenshot or chat. It is used only to read Storage objects from this project.
- Keep a separate private configuration checklist: Supabase Auth Site URL and redirects, SMTP/provider settings, Auth hooks, API/JWT configuration, enabled extensions, Realtime/publication configuration, Storage configuration and Vercel variable **names**. Secret values belong only in your password manager, never these reports.

If you cannot locate the CA or establish a verified TLS session, stop and ask a database operator to assist. Do not disable TLS verification.

## 3. Approval and quiet window

Before executing, confirm with the owner:

> Authorize a read-only database and Storage export of project wizlluiyhsxtsxpuwudc to my encrypted local backup folder, followed by a disposable local restore test. No hosted writes, migration or deployment is authorized.

Arrange a short quiet window with your friend. Avoid schema changes, administrator changes and Storage uploads/deletions during capture. The SQL archive and row fingerprints share one consistent database snapshot. Roles and file contents are not transactional with that snapshot. Unchanged Storage metadata checks reduce risk but cannot prove there were no out-of-band file changes. If a quiet window cannot be assured, do not call the backup complete.

## 4. Run the authorized backup

**Do not run this yet without explicit approval.** Replace the example paths only.

```powershell
py -3 scripts/recovery/proofpak_recovery.py backup --output-parent "E:\ProofPak-Recovery" --ca-file "E:\ProofPak-Recovery\database-root.crt" --authorize-production-read
```

Answer the local prompts. Passwords and keys are hidden. The helper checks the project endpoint, creates an access-restricted folder, and uses a read-only snapshot. Temporary credentials travel via standard input into a Docker tmpfs file; they are not placed in process arguments or saved in the backup.

It exports these private files:

- `database.pgdump`: selected schemas and data, including Auth.
- `roles-reference.sql`: roles without password hashes; reference only, never blindly run on hosted Supabase.
- `source-snapshot.json`: private catalog, aggregate fingerprints and Storage inventory. Do not share it.
- `storage-index.json` and `storage-blobs`: private mapping and actual file bytes, if any.
- `manifest.json`: file sizes and SHA-256 values.

The helper refuses repository destinations, uses fresh folders, and adds local Git/Vercel ignore files. Do not move an archive into the repository later. It does not encrypt files itself.

**“BACKUP FILES CREATED” means only stage 1.** A missing manifest or stopped command means an incomplete bundle. Do not approve migration on that basis. Keep partial material private; remove it securely after resolving the failure.

## 5. Verify and restore locally

Copy the exact new bundle path printed by the helper:

```powershell
py -3 scripts/recovery/proofpak_recovery.py verify --bundle "E:\ProofPak-Recovery\proofpak-recovery-REPLACE-WITH-ACTUAL-FOLDER"
py -3 scripts/recovery/proofpak_recovery.py rehearse --bundle "E:\ProofPak-Recovery\proofpak-recovery-REPLACE-WITH-ACTUAL-FOLDER"
```

The first command verifies file hashes and reads the archive directory. It does not prove restoration. The second starts a new local PostgreSQL container with **no network and no exposed port**, restores into that container, compares records and security objects, recovers file bytes into a second temporary private folder, then removes the container and temporary recovered files. It cannot take a production destination URL.

Follow [the recovery verification checklist](PROOFPAK_RECOVERY_VERIFICATION.md). A private `checks/restore-*.json` records completed comparison results. Do not share the JSON or backup with AI services. You may report only the four stage statuses and a sanitized failure stage.

## 6. Secure retention

Keep two encrypted copies and the manifest SHA-256 separately in trusted storage. Checksums detect changes relative to a trusted manifest; an attacker who replaces both manifest and archive can defeat them. Retain the repository commit, PostgreSQL tool/image version, capture time and private configuration checklist. Verify the copied bundle again. Windows users should inspect folder Properties → Security: only the backup operator and intentionally authorized recovery administrators should have access. Windows ACL behavior still needs manual verification.

Keep the baseline backup until migration and hosted acceptance tests have passed and the owner agrees a retention policy. Deleting a file is not a guaranteed secure erase on SSDs; rely on encryption and controlled key retention.

## Common problems

| Problem                                    | Safe response                                                                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Docker unavailable or drive sharing denied | Start Docker Desktop, enable local drive access, retry; never upload the bundle elsewhere                                                 |
| Direct host cannot resolve/connect         | Use the project's session pooler on 5432 with the matching username and valid CA                                                          |
| TLS error                                  | Check official CA, hostname and system clock; never use `sslmode=disable` for production                                                  |
| Password/authentication error              | Confirm existing credentials privately; do not paste logs or reset production settings                                                    |
| Permission/RLS export error                | Stop; partial dumps are not acceptable. Review with an authorized operator; do not disable RLS                                            |
| Storage download/size/change error         | Keep bundle incomplete; review permissions and repeat in an agreed quiet window                                                           |
| Unsupported extension or restore error     | Stop. A vanilla PostgreSQL restore may be insufficient; arrange an authorized compatible local Supabase environment and specialist review |
| Comparison mismatch                        | Do not migrate. Investigate the named section privately; do not edit snapshots to manufacture success                                     |
| Disk/memory shortage                       | Increase trusted encrypted local capacity; never substitute production as the restore target                                              |

## What this cannot promise

This is a migration-recovery preparation tool, **not a complete Supabase project clone**. Vault secrets, excluded schemas, platform-managed extension libraries, database settings, default privileges, role passwords/settings, hosted Auth login/email, Storage API import and control-plane configuration require additional review. The helper retains default ACL inventory/reference but does not establish equivalent future-object defaults. Large objects, foreign tables and materialized views deliberately block this workflow pending specialist content checks.

A successful local SQL restore is necessary, but not sufficient if any of those items matter to ProofPak. A production restoration procedure still requires a separately approved operator plan; never use `--clean`, reset a hosted project, blindly replay roles or import fixtures.

Official references for operator review: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html). Live Supabase documentation access returned HTTP 403 in this environment; no claim is made that its current dashboard wording or managed restore instructions were independently confirmed here.
