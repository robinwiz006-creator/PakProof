-- LOCAL REHEARSAL SUPPORT ONLY: exact original-row fingerprints, including receipts.
create schema rehearsal_private;
revoke all on schema rehearsal_private from public,anon,authenticated,service_role;
create table rehearsal_private.baseline(relation_name text primary key,columns text[],row_count bigint,digest text);
do $$declare t record;cols text[];expr text;n bigint;h text;begin
 for t in select n.nspname,c.relname,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relkind='r') or (n.nspname='auth' and c.relname='users') loop
  select array_agg(attname order by attnum),string_agg(format('%L,t.%I',attname,attname),',' order by attnum) into cols,expr from pg_attribute where attrelid=t.oid and attnum>0 and not attisdropped;
  execute format('select count(*),md5(coalesce(string_agg(md5(jsonb_build_object(%s)::text),'''' order by md5(jsonb_build_object(%s)::text)),'''')) from %I.%I t',expr,expr,t.nspname,t.relname) into n,h;
  insert into rehearsal_private.baseline values(format('%I.%I',t.nspname,t.relname),cols,n,h);
 end loop;
end$$;
