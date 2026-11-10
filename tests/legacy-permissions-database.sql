-- LOCAL SECURITY REGRESSION. No real chain transaction or hosted data.
\set ON_ERROR_STOP on
begin;
do $$declare t text;r text;a record;p text;begin
 foreach t in array array['profiles','companies','company_memberships','skills','projects','challenges','challenge_submissions','submission_reviews','achievements','blockchain_proofs','achievement_claims','achievement_evidence','achievement_sharing'] loop
  if not (select relrowsecurity from pg_class where oid=to_regclass('public.'||t)) then raise exception 'RLS weakened';end if;
  if exists(select 1 from aclexplode(coalesce((select relacl from pg_class where oid=to_regclass('public.'||t)),'{}'::aclitem[])) where grantee=0) then raise exception 'PUBLIC table ACL remains';end if;
  foreach r in array array['anon','authenticated'] loop
   if not has_table_privilege(r,'public.'||t,'SELECT') then raise exception 'Legitimate SELECT missing';end if;
   foreach p in array array['TRUNCATE','TRIGGER','REFERENCES','MAINTAIN'] loop
    if has_table_privilege(r,'public.'||t,p) then raise exception 'Forbidden effective privilege %.% %',r,t,p;end if;
   end loop;
   if has_table_privilege(r,'public.'||t,'INSERT') is distinct from (r='authenticated' and t in ('projects','challenges','achievement_sharing')) then raise exception 'Wrong INSERT matrix %.%',r,t;end if;
   if has_table_privilege(r,'public.'||t,'UPDATE') is distinct from (r='authenticated' and t in ('profiles','companies','projects','challenges','achievement_sharing')) then raise exception 'Wrong UPDATE matrix %.%',r,t;end if;
   if has_table_privilege(r,'public.'||t,'DELETE') is distinct from (r='authenticated' and t='projects') then raise exception 'Wrong DELETE matrix %.%',r,t;end if;
   for a in select attnum,attacl from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped loop
    if a.attacl is not null then raise exception 'Explicit legacy column ACL remains';end if;
   end loop;
  end loop;
 end loop;
 if has_column_privilege('anon','public.paid_projects','worker_id','SELECT') or has_column_privilege('anon','public.credential_events','actor_id','SELECT') then raise exception 'Privacy regression';end if;
 foreach t in array array['public.create_company(text,text,text,text)','public.submit_work(uuid,text,text,text)','public.review_submission(uuid,text,text)'] loop
  if has_function_privilege('anon',t,'EXECUTE') or not has_function_privilege('authenticated',t,'EXECUTE') then raise exception 'Wrong mutation RPC rights';end if;
 end loop;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 begin truncate public.skills;raise exception 'Anonymous truncate succeeded';exception when insufficient_privilege then null;end;
 begin perform public.create_company('Forbidden','No anonymous mutation','https://example.com','');raise exception 'Anonymous RPC succeeded';exception when insufficient_privilege then null;end;
 begin perform public.submit_work(gen_random_uuid(),'https://example.com','','Anonymous write must fail');raise exception 'Anonymous submission RPC succeeded';exception when insufficient_privilege then null;end;
 begin perform public.review_submission(gen_random_uuid(),'approved','Anonymous approval must fail');raise exception 'Anonymous review RPC succeeded';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
do $$begin
 begin truncate public.skills;raise exception 'User truncate succeeded';exception when insufficient_privilege then null;end;
 begin insert into public.achievements(submission_id,challenge_id,talent_id,company_id,title) values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),'Forged');raise exception 'Direct achievement write succeeded';exception when insufficient_privilege then null;end;
end$$;
rollback;
\echo 'PASS: legacy effective table/column/RPC matrix, real denied TRUNCATE/mutation attempts, retained RLS and privacy projections'
