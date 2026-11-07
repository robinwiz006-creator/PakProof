\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('e0000000-0000-4000-8000-000000000001','{"full_name":"Trust Representative"}'),
('e0000000-0000-4000-8000-000000000002','{"full_name":"Trust Recipient"}'),
('e0000000-0000-4000-8000-000000000003','{"full_name":"Trust Admin"}'),
('e0000000-0000-4000-8000-000000000004','{"full_name":"Unrelated User"}');
insert into public.platform_administrators(user_id) values('e0000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
update public.profiles set is_public=true where id=auth.uid();
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.register_organization('training','Trust Fixture','Synthetic training organization for isolated testing.','https://example.com') as org \gset
select set_config('test.trust_org',:'org',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select public.review_issuer_authorization(:'org','Synthetic evidence checked for training only.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['course'],null);
select authorization_id as approval from public.organizations where id=:'org' \gset
select set_config('test.trust_approval',:'approval',true);
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','e0000000-0000-4000-8000-000000000002','Course fixture','course','A synthetic course completed for isolated trust testing.',current_date,null,'','','') as credential \gset
select set_config('test.trust_credential',:'credential',true);
do $$begin
 if not exists(select 1 from public.credential_issuance_audit where credential_id=current_setting('test.trust_credential')::uuid and representative_id=auth.uid() and authorization_id=current_setting('test.trust_approval')::uuid and authorized_credential_type='course') then raise exception 'Attribution not captured';end if;
 begin perform public.issue_credential(current_setting('test.trust_org')::uuid,'e0000000-0000-4000-8000-000000000002','Unauthorized degree','degree','Training approval must not permit issuing academic qualifications.',current_date,null,'','','');raise exception 'Degree escalation';exception when raise_exception then if sqlerrm='Degree escalation' then raise;end if;end;
 begin perform public.review_issuer_authorization(current_setting('test.trust_org')::uuid,'I approve my own organization permission scope.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['degree'],current_setting('test.trust_approval')::uuid);raise exception 'Member changed permissions';exception when raise_exception then if sqlerrm='Member changed permissions' then raise;end if;end;
 begin update public.organizations set allowed_credential_types=array['degree'];raise exception 'Direct permission forgery';exception when insufficient_privilege then null;end;
 begin insert into public.credential_issuance_audit(credential_id,organization_id,representative_id,authorization_id,authorized_credential_type) values(gen_random_uuid(),current_setting('test.trust_org')::uuid,auth.uid(),current_setting('test.trust_approval')::uuid,'degree');raise exception 'Direct attribution forgery';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.issuer_authorizations) then raise exception 'Private review notes leaked to representative';end if;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000004';
do $$begin
 if exists(select 1 from public.credential_issuance_audit) or exists(select 1 from public.credential_issuance_provenance) then raise exception 'Private attribution leaked';end if;
 begin perform public.issue_credential(current_setting('test.trust_org')::uuid,'e0000000-0000-4000-8000-000000000002','Unrelated issuer','course','An unrelated user cannot issue for this organization.',current_date,null,'','','');raise exception 'Unrelated issuance';exception when raise_exception then if sqlerrm='Unrelated issuance' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
set local role anon;
set local request.jwt.claim.sub='';
do $$declare r jsonb;begin
 select to_jsonb(p) into r from public.credential_issuance_provenance p where credential_id=current_setting('test.trust_credential')::uuid;
 if r is null or r->>'representative_recorded'<>'true' or r ?| array['representative_id','administrator_id','review_note'] then raise exception 'Unsafe public provenance';end if;
 begin perform 1 from public.credential_issuance_audit;raise exception 'Anonymous attribution access';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
do $$begin
 begin perform public.review_issuer_authorization(current_setting('test.trust_org')::uuid,'A training organization must not gain degree permission.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['degree'],current_setting('test.trust_approval')::uuid);raise exception 'Training gained academic authority';exception when raise_exception then if sqlerrm='Training gained academic authority' then raise;end if;end;
end$$;
select public.review_issuer_authorization(:'org','Training review expanded to include workshop attendance.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['course','workshop'],:'approval');
select authorization_id as expanded from public.organizations where id=:'org' \gset
select public.review_issuer_authorization(:'org','Synthetic suspension pending a renewed evidence review.',false,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['course'],:'expanded');
select authorization_id as suspended from public.organizations where id=:'org' \gset
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.issue_credential(current_setting('test.trust_org')::uuid,'e0000000-0000-4000-8000-000000000002','Suspended course','course','A suspended issuer cannot create a new course credential.',current_date,null,'','','');raise exception 'Suspended issuance';exception when raise_exception then if sqlerrm='Suspended issuance' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='e0000000-0000-4000-8000-000000000003';
select public.review_issuer_authorization(:'org','Synthetic reinstatement for workshop attendance only.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['workshop'],:'suspended');
do $$begin
 if (select count(*) from public.issuer_authorizations where organization_id=current_setting('test.trust_org')::uuid)<>4 then raise exception 'Authorization history missing';end if;
 if not exists(select 1 from public.issuer_authorizations where organization_id=current_setting('test.trust_org')::uuid and decision='reinstatement' and allowed_credential_types=array['workshop']) then raise exception 'Reinstatement scope missing';end if;
 if not exists(select 1 from public.issuer_authorizations where organization_id=current_setting('test.trust_org')::uuid and decision='permissions_changed') then raise exception 'Permission-change event missing';end if;
 if (select authorization_id from public.credentials where id=current_setting('test.trust_credential')::uuid)<>current_setting('test.trust_approval')::uuid then raise exception 'Historical issuance authorization rewritten';end if;
 begin perform public.review_issuer_authorization(current_setting('test.trust_org')::uuid,'Stale concurrent administrator decision must fail.',true,'Trust Fixture','Synthetic training organization for isolated testing.','https://example.com',array['degree'],current_setting('test.trust_approval')::uuid);raise exception 'Stale review accepted';exception when raise_exception then if sqlerrm='Stale review accepted' then raise;end if;end;
end$$;
reset role;
do $$begin
 begin update public.credential_issuance_audit set representative_id='e0000000-0000-4000-8000-000000000004';raise exception 'Attribution rewritten';exception when raise_exception then if sqlerrm='Attribution rewritten' then raise;end if;end;
 begin delete from public.issuer_authorizations;raise exception 'Audit deleted';exception when raise_exception then if sqlerrm='Audit deleted' then raise;end if;end;
end$$;
rollback;
\echo 'PASS: scoped issuing, representative attribution, private audit, public provenance, suspension, reinstatement, immutable history and stale-decision guards'
