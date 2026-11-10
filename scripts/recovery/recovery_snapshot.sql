-- Backup-helper internal read-only inventory. Output is PRIVATE backup material.
-- Run inside the same exported snapshot as pg_dump, never print to the console.
with scopes as (
 select n.oid,n.nspname from pg_namespace n
 where n.nspname in ('public','auth','storage','extensions','supabase_migrations')
), rels as (
 select c.*,n.nspname from pg_class c join scopes n on n.oid=c.relnamespace
 where c.relkind in ('r','p','v','m','S') and not exists(
 select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e')
), row_docs as (
 select r.oid,x.payload::jsonb as data from rels r cross join lateral xmltable('/table/row'
 passing query_to_xml(format(
 'select jsonb_build_object(''rows'',count(*),''sha256'',encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex''),'''' order by encode(sha256(convert_to(to_jsonb(t)::text,''UTF8'')),''hex'')),''''),''UTF8'')),''hex''))::text as payload from %I.%I t',r.nspname,r.relname),true,false,'')
 columns payload text path 'payload') x where r.relkind in ('r','p')
), sequence_docs as (
 select r.oid,x.payload::jsonb as data from rels r cross join lateral xmltable('/table/row'
 passing query_to_xml(format('select jsonb_build_object(''last_value'',last_value::text,''is_called'',is_called)::text as payload from %I.%I',r.nspname,r.relname),true,false,'')
 columns payload text path 'payload') x where r.relkind='S'
), funcs as (
 select p.*,n.nspname from pg_proc p join scopes n on n.oid=p.pronamespace
 where p.prokind='f' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
)
select jsonb_build_object(
 'inventory_version',1,
 'server_version',current_setting('server_version'),
 'server_major',current_setting('server_version_num')::int/10000,
 'captured_at',current_timestamp,
 'schemas',(select jsonb_agg(nspname order by nspname) from scopes),
 'required_relations',jsonb_build_object('auth_users',to_regclass('auth.users') is not null,'auth_identities',to_regclass('auth.identities') is not null,'storage_buckets',to_regclass('storage.buckets') is not null,'storage_objects',to_regclass('storage.objects') is not null),
 'tables',coalesce((select jsonb_agg(jsonb_build_object(
  'schema',r.nspname,'name',r.relname,'kind',r.relkind,'owner',pg_get_userbyid(r.relowner),
  'rls',r.relrowsecurity,'force_rls',r.relforcerowsecurity,'data',d.data,
  'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(v.adbin,v.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef v on v.adrelid=a.attrelid and v.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
  'acl',(select coalesce(jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type,a.grantor::regrole::text),'[]') from aclexplode(coalesce(r.relacl,acldefault('r',r.relowner))) a)
 ) order by r.nspname,r.relname) from rels r join row_docs d on d.oid=r.oid),'[]'),
 'sequences',coalesce((select jsonb_agg(jsonb_build_array(r.nspname,r.relname,d.data) order by r.nspname,r.relname) from rels r join sequence_docs d on d.oid=r.oid),'[]'),
 'relation_acls',coalesce((select jsonb_agg(jsonb_build_object('schema',r.nspname,'name',r.relname,'owner',pg_get_userbyid(r.relowner),'acl',(select coalesce(jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type,a.grantor::regrole::text),'[]') from aclexplode(coalesce(r.relacl,acldefault(case when r.relkind='S' then 'S'::"char" else 'r'::"char" end,r.relowner))) a)) order by r.nspname,r.relname) from rels r),'[]'),
 'functions',coalesce((select jsonb_agg(jsonb_build_object('schema',f.nspname,'name',f.proname,'arguments',pg_get_function_identity_arguments(f.oid),'owner',pg_get_userbyid(f.proowner),'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(f.oid),'UTF8')),'hex'),
 'acl',(select coalesce(jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type,a.grantor::regrole::text),'[]') from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a)) order by f.nspname,f.proname,pg_get_function_identity_arguments(f.oid)) from funcs f),'[]'),
 'views',coalesce((select jsonb_agg(jsonb_build_object('schema',r.nspname,'name',r.relname,'kind',r.relkind,'owner',pg_get_userbyid(r.relowner),'definition',pg_get_viewdef(r.oid,true),'options',r.reloptions) order by r.nspname,r.relname) from rels r where r.relkind in ('v','m')),'[]'),
 'policies',coalesce((select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where p.schemaname in (select nspname from scopes)),'[]'),
 'triggers',coalesce((select jsonb_agg(jsonb_build_array(r.nspname,r.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true)) order by r.nspname,r.relname,t.tgname) from rels r join pg_trigger t on t.tgrelid=r.oid and not t.tgisinternal),'[]'),
 'constraints',coalesce((select jsonb_agg(jsonb_build_array(r.nspname,r.relname,c.conname,c.contype,c.convalidated,pg_get_constraintdef(c.oid,true)) order by r.nspname,r.relname,c.conname) from rels r join pg_constraint c on c.conrelid=r.oid),'[]'),
 'indexes',coalesce((select jsonb_agg(jsonb_build_array(r.nspname,r.relname,c.relname,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) order by r.nspname,r.relname,c.relname) from rels r join pg_index i on i.indrelid=r.oid join pg_class c on c.oid=i.indexrelid),'[]'),
 'schema_acls',coalesce((select jsonb_agg(jsonb_build_object('name',s.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',(select coalesce(jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type,a.grantor::regrole::text),'[]') from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a)) order by s.nspname) from scopes s join pg_namespace n on n.oid=s.oid),'[]'),
 'column_acls',coalesce((select jsonb_agg(jsonb_build_array(r.nspname,r.relname,c.attname,case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable) order by r.nspname,r.relname,c.attname,a.grantee::regrole::text,a.privilege_type,a.grantor::regrole::text) from rels r join pg_attribute c on c.attrelid=r.oid and c.attnum>0 and not c.attisdropped cross join lateral aclexplode(c.attacl) a),'[]'),
 'extensions',coalesce((select jsonb_agg(jsonb_build_array(e.extname,e.extversion,n.nspname) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),'[]'),
 'roles',coalesce((select jsonb_agg(jsonb_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass_rls',rolbypassrls,'setting_names',(select jsonb_agg(split_part(v,'=',1)) from unnest(rolconfig) v)) order by rolname) from pg_roles where rolname !~ '^pg_'),'[]'),
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('member',m.rolname,'role',r.rolname,'admin',a.admin_option,'inherit',a.inherit_option,'set',a.set_option) order by m.rolname,r.rolname) from pg_auth_members a join pg_roles m on m.oid=a.member join pg_roles r on r.oid=a.roleid),'[]'),
 'default_acl_inventory_only',coalesce((select jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype,d.defaclacl) order by d.defaclrole::regrole::text,n.nspname,d.defaclobjtype) from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace),'[]'),
 'unsupported_relation_count',(select count(*) from pg_class c join scopes s on s.oid=c.relnamespace where c.relkind in ('f','m')),
 'large_object_count',(select count(*) from pg_largeobject_metadata),
 'excluded_schemas',coalesce((select jsonb_agg(nspname order by nspname) from pg_namespace where nspname !~ '^pg_' and nspname<>'information_schema' and nspname not in (select nspname from scopes)),'[]'),
 'auth_orphan_identity_count',(select count(*) from auth.identities i left join auth.users u on u.id=i.user_id where u.id is null),
 'storage',jsonb_build_object(
  'buckets',coalesce((select jsonb_agg(to_jsonb(b) order by b.id) from storage.buckets b),'[]'),
  'objects',coalesce((select jsonb_agg(jsonb_build_object('bucket_id',o.bucket_id,'name',o.name,'metadata',to_jsonb(o)->'metadata','updated_at',to_jsonb(o)->'updated_at') order by o.bucket_id,o.name) from storage.objects o),'[]'))
) as recovery_snapshot;
