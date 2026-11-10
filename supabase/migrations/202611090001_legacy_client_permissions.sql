-- Forward-only, scoped ACL reconciliation after the complete nineteen-file chain.
-- Does not alter RLS, policies, function bodies, owners, default privileges,
-- service-role grants, Auth/Storage, records or historical proof formats.
begin;
do $$
declare t text; cols text;
 tables constant text[] := array['profiles','companies','company_memberships','skills','projects','challenges','challenge_submissions','submission_reviews','achievements','blockchain_proofs','achievement_claims','achievement_evidence','achievement_sharing'];
begin
 if to_regclass('public.public_paid_projects') is null
 or to_regclass('public.public_credential_events') is null
 or to_regclass('public.credential_correction_status') is null
 or to_regprocedure('public.review_assessed_submission_details(uuid,text,text,jsonb,uuid,jsonb)') is null then
  raise exception 'Complete the reviewed prerequisite migrations through 202611070003 before permission reconciliation';
 end if;
 foreach t in array tables loop
  if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=t and c.relkind in ('r','p') and c.relrowsecurity) then
   raise exception 'Expected RLS-protected application table missing or RLS disabled: %',t;
  end if;
 end loop;
 foreach t in array tables loop
  execute format('revoke all privileges on table public.%I from public,anon,authenticated',t);
  -- A table REVOKE does not remove explicit column ACLs.
  select string_agg(quote_ident(a.attname),',' order by a.attnum) into cols
   from pg_attribute a where a.attrelid=to_regclass('public.'||t) and a.attnum>0 and not a.attisdropped;
  execute format('revoke select (%s), insert (%s), update (%s), references (%s) on table public.%I from public,anon,authenticated',cols,cols,cols,cols,t);
  -- Preserve the original thirteen-table SELECT boundary; RLS still controls rows.
  execute format('grant select on table public.%I to anon,authenticated',t);
 end loop;
end$$;
grant update on public.profiles,public.companies,public.projects,public.challenges,public.achievement_sharing to authenticated;
grant insert on public.projects,public.challenges,public.achievement_sharing to authenticated;
grant delete on public.projects to authenticated;
-- Initial PUBLIC-only revokes did not remove Supabase's explicit anon grants.
revoke all privileges on function public.create_company(text,text,text,text),public.submit_work(uuid,text,text,text),public.review_submission(uuid,text,text) from public,anon;
grant execute on function public.create_company(text,text,text,text),public.submit_work(uuid,text,text,text),public.review_submission(uuid,text,text) to authenticated;

-- Fail closed if a custom inherited grant bypasses the scoped reset. Do not
-- silently revoke another role's privileges/membership or weaken a policy.
do $$
declare t text; r text; a record; p text; fn text;
 tables constant text[] := array['profiles','companies','company_memberships','skills','projects','challenges','challenge_submissions','submission_reviews','achievements','blockchain_proofs','achievement_claims','achievement_evidence','achievement_sharing'];
begin
 foreach t in array tables loop
  foreach r in array array['anon','authenticated'] loop
   if not has_table_privilege(r,'public.'||t,'SELECT') then raise exception 'Required SELECT missing: %.%',r,t;end if;
   foreach p in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege(r,'public.'||t,p) then raise exception 'Unexpected inherited privilege % on % for %; review grants before retrying',p,t,r;end if;
   end loop;
   if current_setting('server_version_num')::int>=170000 then
    if has_table_privilege(r,'public.'||t,'MAINTAIN') then raise exception 'Unexpected inherited MAINTAIN on % for %',t,r;end if;
   end if;
   for a in select attnum from pg_attribute where attrelid=to_regclass('public.'||t) and attnum>0 and not attisdropped loop
    if has_column_privilege(r,to_regclass('public.'||t),a.attnum,'REFERENCES')
    or ((r='anon' or t not in ('projects','challenges','achievement_sharing')) and has_column_privilege(r,to_regclass('public.'||t),a.attnum,'INSERT'))
    or ((r='anon' or t not in ('profiles','companies','projects','challenges','achievement_sharing')) and has_column_privilege(r,to_regclass('public.'||t),a.attnum,'UPDATE')) then
     raise exception 'Unexpected inherited column-write privilege on % for %; review grants before retrying',t,r;
    end if;
   end loop;
   if (r='anon' or t<>'projects') and has_table_privilege(r,'public.'||t,'DELETE') then raise exception 'Unexpected inherited DELETE on % for %',t,r;end if;
  end loop;
 end loop;
 foreach fn in array array['public.create_company(text,text,text,text)','public.submit_work(uuid,text,text,text)','public.review_submission(uuid,text,text)'] loop
  if has_function_privilege('anon',fn,'EXECUTE') or not has_function_privilege('authenticated',fn,'EXECUTE') then
   raise exception 'Unexpected effective function privilege on %; review inherited grants',fn;
  end if;
 end loop;
end$$;
notify pgrst,'reload schema';
commit;
