-- Read-only metadata and counts. Run before and after the forward migration.
select name, to_regclass('public.' || name) as existing_object
from unnest(array['paid_projects','paid_milestones','public_paid_projects','public_paid_milestones']) name;
select c.relname, c.relkind, c.relrowsecurity, c.reloptions,
       pg_get_userbyid(c.relowner) as owner
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
 ('paid_projects','paid_milestones','public_paid_projects','public_paid_milestones');
select tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in
 ('paid_projects','paid_milestones','paid_project_applications','paid_project_offers',
  'paid_milestone_submissions','paid_milestone_reviews','paid_payout_authorizations',
  'payment_intents','payment_attempts','payment_receipts') order by tablename,policyname;
select table_name,column_name,ordinal_position from information_schema.columns
where table_schema='public' and table_name in ('public_paid_projects','public_paid_milestones')
order by table_name,ordinal_position;
select grantee,table_name,privilege_type from information_schema.table_privileges
where table_schema='public' and table_name in
 ('paid_projects','paid_milestones','public_paid_projects','public_paid_milestones')
order by table_name,grantee,privilege_type;
select grantee,table_name,column_name,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name in ('paid_projects','paid_milestones')
 and grantee in ('anon','PUBLIC') order by table_name,column_name;
select has_column_privilege('anon','public.paid_projects','worker_id','SELECT') as anon_worker_select,
 has_column_privilege('anon','public.paid_projects','current_offer_id','SELECT') as anon_offer_select,
 has_column_privilege('anon','public.paid_projects','payout_authorization_id','SELECT') as anon_payout_select,
 has_column_privilege('anon','public.paid_milestones','approval_id','SELECT') as anon_approval_select;
select 'paid_projects' as table_name,count(*) as records from public.paid_projects
union all select 'paid_milestones',count(*) from public.paid_milestones
union all select 'paid_project_applications',count(*) from public.paid_project_applications
union all select 'paid_project_offers',count(*) from public.paid_project_offers
union all select 'paid_milestone_submissions',count(*) from public.paid_milestone_submissions
union all select 'paid_milestone_reviews',count(*) from public.paid_milestone_reviews
union all select 'payment_intents',count(*) from public.payment_intents
union all select 'payment_attempts',count(*) from public.payment_attempts
union all select 'payment_receipts',count(*) from public.payment_receipts;
