-- Read-only; retain privately before and after an authorized release.
select name,to_regclass('public.'||name) as relation from unnest(array['contact_requests','visible_contact_requests','contact_followups','visible_contact_followups']) name;
select to_regprocedure('public.send_contact_followup(uuid,text,text,uuid)') as send_rpc,
 to_regprocedure('public.close_contact_request(uuid,boolean)') as close_rpc,
 to_regprocedure('public.contact_request_opportunity(uuid)') as opportunity_rpc;
select count(*) as request_count,md5(coalesce(jsonb_agg(to_jsonb(r) order by id)::text,'')) as request_fingerprint from public.contact_requests r;
select status,count(*) from public.contact_requests group by status order by status;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='contact_followups';
select tablename,policyname,roles,cmd,qual from pg_policies where schemaname='public' and tablename in ('contact_requests','contact_followups');
select grantee,table_name,privilege_type from information_schema.role_table_grants where table_schema='public' and table_name in ('contact_followups','visible_contact_followups') order by table_name,grantee,privilege_type;
select routine_name,grantee,privilege_type from information_schema.role_routine_grants where specific_schema='public' and routine_name in ('send_contact_followup','close_contact_request','contact_request_opportunity');
select pg_get_constraintdef(oid) as status_constraint from pg_constraint where conrelid='public.contact_requests'::regclass and conname='contact_requests_status_check';
