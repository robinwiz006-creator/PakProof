-- READ ONLY. Paste into Supabase SQL Editor before considering the initial migration.
-- Empty results for the application's tables/functions/triggers mean they are absent.
select table_name from information_schema.tables
where table_schema='public' and table_name in (
 'profiles','companies','company_memberships','skills','projects','challenges',
 'challenge_submissions','submission_reviews','achievements','blockchain_proofs'
) order by table_name;
select p.proname as function_name from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('create_company','submit_work','review_submission','new_user_profile');
select trigger_name from information_schema.triggers
where event_object_schema='auth' and event_object_table='users' and trigger_name='on_auth_user_created';
select c.relname as table_name,c.relrowsecurity as row_level_security_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'profiles','companies','company_memberships','skills','projects','challenges',
 'challenge_submissions','submission_reviews','achievements','blockchain_proofs'
);
select count(*) as existing_auth_users from auth.users;
-- After migration: this must be 0 before existing accounts can use the talent portal.
-- Only run this additional SELECT if public.profiles exists:
-- select count(*) as users_missing_profiles from auth.users u
-- left join public.profiles p on p.id=u.id where p.id is null;
