do $$declare t record;expr text;n bigint;h text;begin
 for t in select * from rehearsal_private.baseline loop
  select string_agg(format('%L,t.%I',c,c),',') into expr from unnest(t.columns) c;
  execute format('select count(*),md5(coalesce(string_agg(md5(jsonb_build_object(%s)::text),'''' order by md5(jsonb_build_object(%s)::text)),'''')) from %s t',expr,expr,t.relation_name) into n,h;
  if n<>t.row_count or h<>t.digest then raise exception 'Original records changed: %',t.relation_name;end if;
 end loop;
 if exists(select 1 from public.organizations where allowed_credential_types<>'{}' or trust_level<>'self_registered' or trust_suspended) then raise exception 'Legacy issuer gained scope or trust';end if;
 if exists(select 1 from public.credential_issuance_audit) then raise exception 'Historical representative attribution invented';end if;
 if (select count(*) from public.payment_receipts)<>2 or not exists(select 1 from public.paid_projects where status='completed') then raise exception 'Populated receipt/paid work fixture missing';end if;
 if not exists(select 1 from public.credential_proofs) or not exists(select 1 from public.blockchain_proofs where claim_version=1) or not exists(select 1 from public.blockchain_proofs where claim_version=2) then raise exception 'Populated historical proof fixture missing';end if;
end$$;
\echo 'PASS: all 36 baseline application tables plus synthetic Auth rows retain exact original values; credentials, v1/v2/v3 references, receipts and paid work preserved'
