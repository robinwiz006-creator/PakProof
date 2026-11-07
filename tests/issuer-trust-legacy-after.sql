do $$begin
 if (select to_jsonb(c) from public.credentials c limit 1) is distinct from (select credential from public.test_issuer_baseline) then raise exception 'Historical credential changed';end if;
 if (select to_jsonb(p) from public.credential_proofs p limit 1) is distinct from (select proof from public.test_issuer_baseline) then raise exception 'Historical proof changed';end if;
 if (select to_jsonb(a)-array['decision','previous_status','resulting_status','previous_credential_types','allowed_credential_types','previous_trust_review_id','trust_decision','previous_trust_level','resulting_trust_level','resulting_trust_suspended','verification_request_id'] from public.issuer_authorizations a limit 1) is distinct from (select authorization_snapshot from public.test_issuer_baseline) then raise exception 'Historical authorization changed';end if;
 if exists(select 1 from public.issuer_authorizations where previous_trust_review_id is not null or trust_decision is not null or previous_trust_level is not null or resulting_trust_level is not null or resulting_trust_suspended is not null or verification_request_id is not null) then raise exception 'Historical institutional review invented';end if;
 if exists(select 1 from public.organizations where trust_level<>'self_registered' or trust_suspended) then raise exception 'Historical issuers automatically promoted';end if;
 if exists(select 1 from public.organizations where allowed_credential_types<>'{}' or issuer_status<>'authorized') then raise exception 'Legacy issuer silently changed status or gained scope';end if;
 if exists(select 1 from public.credential_issuance_audit) or exists(select 1 from public.credential_issuance_provenance) then raise exception 'Historical attribution invented';end if;
 if exists(select 1 from public.issuer_authorizations where decision is not null) then raise exception 'Historical decision invented';end if;
end$$;
set role anon;
set request.jwt.claim.sub='';
do $$begin if (select count(*) from public.credentials)<>1 then raise exception 'Legacy public credential unavailable';end if;end$$;
reset role;
\echo 'PASS: populated historical credential, authorization and v3 receipt unchanged; no invented staff/category history; conservative scope default'
set role authenticated;
set request.jwt.claim.sub='f0000000-0000-4000-8000-000000000001';
do $$declare org uuid;begin
 select id into org from public.organizations limit 1;
 begin perform public.issue_credential(org,'f0000000-0000-4000-8000-000000000002','Legacy authority retry','course','Old generic approval cannot silently permit new issuance.',current_date,null,'','','');raise exception 'Legacy issuer gained implicit category permission';exception when raise_exception then if sqlerrm='Legacy issuer gained implicit category permission' then raise;end if;end;
end$$;
reset role;
