-- Read-only: run before and after migration. No user data or keys are returned.
select to_regclass('public.paid_project_events') as lifecycle_events,
       to_regclass('public.paid_cancellation_requests') as cancellation_requests;
select status,count(*) as projects from public.paid_projects group by status order by status;
select 'projects' as record_type,count(*) from public.paid_projects
union all select 'milestones',count(*) from public.paid_milestones
union all select 'offers',count(*) from public.paid_project_offers
union all select 'submissions',count(*) from public.paid_milestone_submissions
union all select 'receipts',count(*) from public.payment_receipts;
select c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('paid_project_events','paid_cancellation_requests');
select tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in ('paid_project_events','paid_cancellation_requests');
select p.proname, p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('edit_paid_project','change_paid_lifecycle');
select table_name,grantee,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in ('paid_project_events','paid_cancellation_requests')
 and grantee in ('anon','authenticated','service_role','PUBLIC') order by table_name,grantee;
select tgname,pg_get_triggerdef(oid) from pg_trigger
where tgrelid=to_regclass('public.paid_project_events') and not tgisinternal;
