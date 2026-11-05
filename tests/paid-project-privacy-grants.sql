-- Confirm that anonymous column privileges are absent even before reading rows.
do $$begin
 if has_column_privilege('anon','public.paid_projects','worker_id','select') then raise exception 'Anonymous worker column grant'; end if;
 if has_column_privilege('anon','public.paid_milestones','approval_id','select') then raise exception 'Anonymous approval column grant'; end if;
 if has_table_privilege('anon','public.public_paid_projects','insert,update,delete') or has_table_privilege('authenticated','public.public_paid_projects','insert,update,delete') or has_table_privilege('authenticated','public.public_paid_milestones','insert,update,delete') then raise exception 'Public view has mutation grants'; end if;
 if not exists(select 1 from pg_class where oid='public.public_paid_projects'::regclass and reloptions @> array['security_barrier=true','security_invoker=false']) then raise exception 'Public view options missing'; end if;
end$$;
