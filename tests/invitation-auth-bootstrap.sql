alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz;
