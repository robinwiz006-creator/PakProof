\set ON_ERROR_STOP on
-- Same fixture records after migration: no event/claim/audit rewrites allowed.
do $$begin
 if revocation_fixture.fingerprint()<>(select digest from revocation_fixture.before_snapshot) then raise exception 'Migration rewrote historical records';end if;
 if exists(select 1 from public.issuer_authorizations where previous_trust_review_id is not null or trust_decision is not null or previous_trust_level is not null or resulting_trust_level is not null or resulting_trust_suspended is not null or verification_request_id is not null) then raise exception 'Historical trust review invented';end if;
 if has_table_privilege('anon','public.credential_events','SELECT') or has_any_column_privilege('anon','public.credential_events','SELECT') then raise exception 'Anonymous raw audit grant retained';end if;
end$$;
begin;
set local role anon;
set local request.jwt.claim.sub='';
do $$declare e jsonb;begin
 select to_jsonb(t) into e from public.public_credential_events t;
 if e is null or e->>'event_type'<>'revoked' or e->>'reason'<>'Public fixture explanation: the issued record was corrected.' or e->>'created_at' is null then raise exception 'Public revocation status lost';end if;
 if e ?| array['actor_id','id','administrator_id','review_note','representative_id'] then raise exception 'Public view leaked audit metadata';end if;
 begin perform actor_id from public.credential_events;raise exception 'Anonymous staff read allowed';exception when insufficient_privilege then null;end;
 begin perform actor_id from public.public_credential_events;raise exception 'Public actor column exists';exception when undefined_column then null;end;
 begin perform 1 from public.issuer_authorizations;raise exception 'Private investigation readable';exception when insufficient_privilege then null;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='d9000000-0000-4000-8000-000000000003';
do $$begin
 if exists(select 1 from public.credential_events) then raise exception 'Unrelated user read staff audit';end if;
 if (select count(*) from public.public_credential_events)<>1 then raise exception 'Public status unavailable to unrelated user';end if;
 begin insert into public.credential_events(credential_id,actor_id,event_type,reason) select credential_id,auth.uid(),'revoked','Forged event is not allowed.' from public.public_credential_events;raise exception 'Raw event insertion allowed';exception when insufficient_privilege then null;end;
end$$;
-- Recipient sees their own private status history, not private staff attribution.
set local request.jwt.claim.sub='d9000000-0000-4000-8000-000000000002';
do $$begin
 if exists(select 1 from public.credential_events) then raise exception 'Recipient read staff audit';end if;
 if (select count(*) from public.public_credential_events)<>1 then raise exception 'Recipient status missing';end if;
end$$;
update public.profiles set is_public=false where id=auth.uid();
do $$begin if (select count(*) from public.public_credential_events)<>1 then raise exception 'Private owner lost own history';end if;end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if exists(select 1 from public.public_credential_events) then raise exception 'Private passport history leaked';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='d9000000-0000-4000-8000-000000000003';
do $$begin if exists(select 1 from public.public_credential_events) then raise exception 'Unrelated user read private history';end if;end$$;
set local request.jwt.claim.sub='d9000000-0000-4000-8000-000000000001';
do $$begin
 if (select count(*) from public.credential_events where actor_id=auth.uid())<>1 then raise exception 'Issuer audit access lost';end if;
 if (select count(*) from public.public_credential_events)<>1 then raise exception 'Issuer private status access lost';end if;
end$$;
set local request.jwt.claim.sub='d9000000-0000-4000-8000-000000000004';
do $$begin
 if (select count(*) from public.credential_events)<>1 then raise exception 'Administrator private audit access lost';end if;
 if not exists(select 1 from public.issuer_authorizations where review_note like 'PRIVATE review fixture:%') then raise exception 'Administrator review notes missing';end if;
end$$;
reset role;
do $$begin
 begin update public.credential_events set reason='Overwriting an immutable event is forbidden.';raise exception 'Event rewrite allowed';exception when raise_exception then if sqlerrm='Event rewrite allowed' then raise;end if;end;
 if revocation_fixture.fingerprint()<>(select digest from revocation_fixture.before_snapshot) then raise exception 'Audit changed during access tests';end if;
end$$;
rollback;
\echo 'PASS: revocation public projection, raw audit isolation, issuer/admin attribution, private recipient status, immutable historical events and unchanged claims'
