\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('23000000-0000-4000-8000-000000000001','issuer@example.test',now(),'{"full_name":"Issuer fixture"}'),
('23000000-0000-4000-8000-000000000002','recipient@example.test',now(),'{"full_name":"Recipient fixture"}'),
('23000000-0000-4000-8000-000000000003','admin@example.test',now(),'{"full_name":"Admin fixture"}'),
('23000000-0000-4000-8000-000000000004','wrong@example.test',null,'{"full_name":"Wrong fixture"}');
insert into public.platform_administrators(user_id) values('23000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000001';
select public.register_organization('training','Invitation fixture','Synthetic organization used only for invitation tests.','https://example.test') as org \gset
select set_config('test.invorg',:'org',true);
do $$begin
 begin perform public.prepare_credential_invitation(current_setting('test.invorg')::uuid,'recipient@example.test',repeat('a',64),'Course invitation','course','A course invitation with synthetic evidence.',current_date,null,'','','');raise exception 'Unapproved issuer';exception when raise_exception then if sqlerrm='Unapproved issuer' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000003';
select public.review_issuer_authorization(:'org','Synthetic evidence reviewed for training permission.',true,'Invitation fixture','Synthetic organization used only for invitation tests.','https://example.test',array['course'],null);
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000001';
select public.prepare_credential_invitation(:'org','recipient@example.test',encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex'),'Course invitation','course','A course invitation with synthetic evidence.',current_date,null,'Program','','https://example.test/evidence') as invite \gset
select set_config('test.invite',:'invite',true);
do $$begin
 begin perform public.prepare_credential_invitation(current_setting('test.invorg')::uuid,'recipient@example.test',repeat('c',64),'Degree invitation','degree','An unauthorized degree cannot be invited.',current_date,null,'','','');raise exception 'Category bypass';exception when raise_exception then if sqlerrm='Category bypass' then raise;end if;end;
 begin perform token_hash from public.credential_invitations;raise exception 'Hash leaked';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.credential_invitation_inbox) then raise exception 'Issuer dashboard leaks recipient action';end if;
end$$;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000004';
do $$begin
 if exists(select 1 from public.credential_invitations) then raise exception 'Wrong account sees invite';end if;
 if public.resolve_credential_invitation(repeat('b',64)) is not null then raise exception 'Token bypasses identity';end if;
 begin perform public.decide_credential_invitation(current_setting('test.invite')::uuid,'accepted');raise exception 'Wrong account accepted';exception when raise_exception then if sqlerrm='Wrong account accepted' then raise;end if;end;
end$$;
reset role;
update auth.users set email_confirmed_at=null where id='23000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.decide_credential_invitation(current_setting('test.invite')::uuid,'accepted');raise exception 'Unverified accepted';exception when raise_exception then if sqlerrm='Unverified accepted' then raise;end if;end;
end$$;
reset role;
update auth.users set email_confirmed_at=now() where id='23000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000002';
do $$begin
 if public.resolve_credential_invitation(repeat('b',64)) is distinct from current_setting('test.invite')::uuid then raise exception 'Link resolution failed';end if;
 if (select count(*) from public.credential_invitation_inbox)<>1 then raise exception 'Inbox failed';end if;
 begin update public.credential_invitations set status='accepted';raise exception 'Direct mutation';exception when insufficient_privilege then null;end;
end$$;
select public.decide_credential_invitation(:'invite','accepted') as credential \gset
select set_config('test.invcredential',:'credential',true);
do $$begin
 if not exists(select 1 from public.credential_preferences where credential_id=current_setting('test.invcredential')::uuid and acceptance='accepted' and not is_public and not share_evidence) then raise exception 'Acceptance privacy failed';end if;
 if exists(select 1 from public.profiles where id=auth.uid() and is_public) then raise exception 'Auto published Passport';end if;
 begin perform public.decide_credential_invitation(current_setting('test.invite')::uuid,'accepted');raise exception 'Duplicate acceptance';exception when raise_exception then if sqlerrm='Duplicate acceptance' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000001';
do $$begin
 if not exists(select 1 from public.credential_issuance_audit where credential_id=current_setting('test.invcredential')::uuid and representative_id=auth.uid()) then raise exception 'Representative lost';end if;
end$$;
select public.revoke_credential(:'credential','Synthetic test revocation reason.');
select public.prepare_credential_invitation(:'org','recipient@example.test',repeat('d',64),'Decline invitation','course','A separate invitation to decline in tests.',current_date,null,'','','') as declined \gset
select public.prepare_credential_invitation(:'org','recipient@example.test',repeat('e',64),'Cancel invitation','course','A separate invitation to cancel in tests.',current_date,null,'','','') as cancelled \gset
select public.decide_credential_invitation(:'cancelled','cancelled');
select set_config('test.cancelled',:'cancelled',true);
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000002';
select public.decide_credential_invitation(:'declined','declined');
do $$begin
 begin perform public.decide_credential_invitation(current_setting('test.cancelled')::uuid,'accepted');raise exception 'Cancelled accepted';exception when raise_exception then if sqlerrm='Cancelled accepted' then raise;end if;end;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 begin perform id from public.credential_invitations;raise exception 'Anonymous exposure';exception when insufficient_privilege then null;end;
end$$;

reset role;
update public.credential_invitations set expires_at=now()-interval '1 day' where title='Decline invitation';
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000001';
select public.prepare_credential_invitation(:'org','recipient@example.test',repeat('f',64),'Expired invitation','course','A separate invitation to expire in tests.',current_date,null,'','','') as expired \gset
select set_config('test.expired',:'expired',true);
do $$begin
 begin perform public.prepare_credential_invitation(current_setting('test.invorg')::uuid,'recipient@example.test',repeat('a',64),'Expired invitation','course','A separate invitation to expire in tests.',current_date,null,'','','');raise exception 'Duplicate pending creation';exception when raise_exception then if sqlerrm='Duplicate pending creation' then raise;end if;end;
end$$;
reset role;
update public.credential_invitations set expires_at=now()-interval '1 day' where id=:'expired';
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.decide_credential_invitation(current_setting('test.expired')::uuid,'accepted');raise exception 'Expired accepted';exception when raise_exception then if sqlerrm='Expired accepted' then raise;end if;end;
 begin perform representative_id from public.credential_invitations;raise exception 'Staff leaked';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000001';
select public.prepare_credential_invitation(:'org','recipient@example.test',repeat('1',64),'Suspended invitation','course','A separate invitation with suspended issuer.',current_date,null,'','','') as suspended_invite \gset
select set_config('test.suspended_invite',:'suspended_invite',true);
reset role;
update public.organizations set issuer_status='suspended' where id=:'org';
set local role authenticated;
set local request.jwt.claim.sub='23000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.decide_credential_invitation(current_setting('test.suspended_invite')::uuid,'accepted');raise exception 'Suspended issuer acceptance';exception when raise_exception then if sqlerrm='Suspended issuer acceptance' then raise;end if;end;
end$$;
rollback;
