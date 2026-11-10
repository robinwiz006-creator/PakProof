"""Synthetic-only helper checks. Never reads application environment or hosted credentials."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('recovery', ROOT / 'scripts/recovery/proofpak_recovery.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)

class Safety(unittest.TestCase):
    def test_exact_project(self):
        r.validate_endpoint('db.' + r.PROJECT + '.supabase.co', 5432, 'postgres')
        with self.assertRaises(r.SafeError): r.validate_endpoint('db.other.supabase.co',5432,'postgres')
    def test_no_transaction_pooler(self):
        with self.assertRaises(r.SafeError): r.validate_endpoint('aws.pooler.supabase.com',6543,'postgres.'+r.PROJECT)
    def test_no_git_output(self):
        with self.assertRaises(r.SafeError): r.outside_git(ROOT / 'private-backup')
    def test_no_path_traversal(self):
        with self.assertRaises(r.SafeError): r.object_path('private','../secret')
    def test_escaped_storage_key(self):
        self.assertIn('a%20b',r.object_path('private','a b'))
    def test_no_redirect(self):
        with self.assertRaises(r.SafeError): r.NoRedirect().redirect_request(None,None,302,'',{},'https://example.com')
    def test_sanitized_error(self):
        with self.assertRaises(r.SafeError) as e:
            r.run(['python3','-c','import sys; sys.stderr.write("synthetic-private-value");sys.exit(1)'])
        self.assertNotIn('synthetic-private-value',str(e.exception))
    def test_incomplete_bundle(self):
        with tempfile.TemporaryDirectory() as p:
            with self.assertRaises(r.SafeError): r.load_bundle(p)
    def test_restore_network_guard(self):
        with self.assertRaises(r.SafeError): r.Docker(network='bridge',server=True)

class SyntheticRestore(unittest.TestCase):
    def synthetic_path(self, path, root):
        # Cloud sandbox places sentinel .git folders in both writable roots.
        # Test-only exception is bounded to this ephemeral synthetic fixture folder.
        resolved = Path(path).resolve()
        r.check(resolved.is_relative_to(Path(root).resolve()), "Synthetic fixture path escaped")
        return resolved

    def test_roundtrip_and_corruption(self):
        # Source and destination are both fresh helper-created containers, no host ports/network.
        with tempfile.TemporaryDirectory(prefix='proofpak-synthetic-') as p, patch.object(r, 'outside_git', side_effect=lambda path: self.synthetic_path(path, p)), r.docker(network='none',server=True) as source:
            sql = '''create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key, encrypted_password text);
create table auth.identities(id int primary key,user_id uuid references auth.users);
insert into auth.users values ('00000000-0000-0000-0000-000000000001','synthetic-not-a-password');
insert into auth.identities values(1,'00000000-0000-0000-0000-000000000001');
create table storage.buckets(id text primary key,public boolean);
create table storage.objects(id int primary key,bucket_id text references storage.buckets,name text,metadata jsonb,updated_at timestamptz);
insert into storage.buckets values('private',false);
insert into storage.objects values(1,'private','synthetic/file.txt','{"size":7}',now());
create table public.records(id serial primary key,credential_reference text,payment_signature text);
insert into public.records(credential_reference,payment_signature) values('synthetic-credential','synthetic-signature');
alter table public.records enable row level security;
create policy readable on public.records for select to authenticated using(true);
grant usage on schema public to authenticated;
grant select on public.records to authenticated;
create function public.guard() returns trigger language plpgsql as $$begin return new; end$$;
create trigger guard before update on public.records for each row execute function public.guard();
'''
            source.execute(['psql','-X','-U','postgres','-v','ON_ERROR_STOP=1'],data=sql.encode())
            # Loopback inside the synthetic container only. Production CLI never enables fixture mode.
            source.configure('127.0.0.1',5432,'postgres','',fixture=True)
            bundle = r.export_bundle(source,Path(p),lambda b,n: io.BytesIO(b'fixture'))
            self.assertTrue(r.archive_verify(bundle)['archive_integrity_verified'])
            result = r.rehearse(bundle)
            self.assertTrue(result['restore_completed'])
            self.assertTrue(result['recovery_checks_passed'])
            self.assertEqual(result['storage_files_recovered'],1)
            self.assertFalse(result['full_supabase_project_recovery_verified'])
            # Empty Storage is captured truthfully, without prompting for any key.
            source.execute(['psql','-X','-U','postgres'],data=b'delete from storage.objects; revoke usage on schema public from PUBLIC;')
            empty = r.export_bundle(source,Path(p))
            self.assertEqual(json.loads((empty/'manifest.json').read_text())['storage']['object_count'],0)
            self.assertTrue(r.rehearse(empty)['recovery_checks_passed'])
            with (bundle/'database.pgdump').open('ab') as f: f.write(b'corruption')
            with self.assertRaises(r.SafeError): r.archive_verify(bundle)

if __name__ == '__main__': unittest.main()
