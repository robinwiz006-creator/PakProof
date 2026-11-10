-- READ ONLY. Intended project wizlluiyhsxtsxpuwudc. Prepared, not run hosted.
-- Run before/after separately approved 202611090001 reconciliation.
-- Afterward: 13 existing RLS tables, SELECT retained, zero forbidden column writes,
-- no TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, correct intended mutation matrix;
-- anon RPC execute=false, authenticated=true. Missing objects/NULLs are failures.
with names as (
 select unnest(array['profiles','companies','company_memberships','skills','projects','challenges','challenge_submissions','submission_reviews','achievements','blockchain_proofs','achievement_claims','achievement_evidence','achievement_sharing']) as name
), tables as (
 select n.name,c.oid,c.relrowsecurity from names n left join pg_class c on c.oid=to_regclass('public.'||n.name)
), roles as (select oid,rolname from pg_roles where rolname in ('anon','authenticated')),
functions as (
 select unnest(array['public.create_company(text,text,text,text)','public.submit_work(uuid,text,text,text)','public.review_submission(uuid,text,text)']) as signature
)
select jsonb_build_object(
 'checked_at',current_timestamp,
 'expected_table_count',13,
 'existing_table_count',(select count(*) from tables where oid is not null),
 'expected_client_role_count',2,
 'existing_client_role_count',(select count(*) from roles),
 'table_matrix',(select jsonb_agg(jsonb_build_object(
  'table',t.name,'role',r.rolname,'rls',t.relrowsecurity,
  'select',has_table_privilege(r.oid,t.oid,'SELECT'),
  'insert',has_table_privilege(r.oid,t.oid,'INSERT'),
  'expected_insert',r.rolname='authenticated' and t.name in ('projects','challenges','achievement_sharing'),
  'update',has_table_privilege(r.oid,t.oid,'UPDATE'),
  'expected_update',r.rolname='authenticated' and t.name in ('profiles','companies','projects','challenges','achievement_sharing'),
  'delete',has_table_privilege(r.oid,t.oid,'DELETE'),
  'expected_delete',r.rolname='authenticated' and t.name='projects',
  'truncate',has_table_privilege(r.oid,t.oid,'TRUNCATE'),
  'references',has_table_privilege(r.oid,t.oid,'REFERENCES'),
  'trigger',has_table_privilege(r.oid,t.oid,'TRIGGER'),
  'maintain',has_table_privilege(r.oid,t.oid,'MAINTAIN'),
  'forbidden_effective_column_write_count',(select count(*) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped and (
   has_column_privilege(r.oid,t.oid,a.attnum,'REFERENCES')
   or ((r.rolname='anon' or t.name not in ('projects','challenges','achievement_sharing')) and has_column_privilege(r.oid,t.oid,a.attnum,'INSERT'))
   or ((r.rolname='anon' or t.name not in ('profiles','companies','projects','challenges','achievement_sharing')) and has_column_privilege(r.oid,t.oid,a.attnum,'UPDATE'))))
 ) order by t.name,r.rolname) from tables t cross join roles r),
 'rpc_execute',(select jsonb_agg(jsonb_build_object('signature',f.signature,
  'exists',to_regprocedure(f.signature) is not null,
  'anon',has_function_privilege('anon',to_regprocedure(f.signature),'EXECUTE'),
  'authenticated',has_function_privilege('authenticated',to_regprocedure(f.signature),'EXECUTE')) order by signature) from functions f),
 'privacy_regression_check',jsonb_build_object(
  'anon_paid_worker_select',has_column_privilege('anon','public.paid_projects','worker_id','SELECT'),
  'anon_revoking_staff_select',has_column_privilege('anon','public.credential_events','actor_id','SELECT'),
  'public_paid_projection_exists',to_regclass('public.public_paid_projects') is not null,
  'public_revocation_projection_exists',to_regclass('public.public_credential_events') is not null)
) as legacy_permission_check;
