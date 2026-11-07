\set ON_ERROR_STOP on
begin;
-- Synthetic identities only, including enough opted-in profiles for real paging.
insert into auth.users(id,raw_user_meta_data)
select ('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,jsonb_build_object('full_name','Directory Fixture '||lpad(n::text,2,'0')) from generate_series(1,35) n;
insert into public.platform_administrators(user_id) values('d1000000-0000-4000-8000-000000000006');
do $$begin if exists(select 1 from public.profiles where is_discoverable or allow_contact_requests) then raise exception 'Default consent not conservative';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
select public.create_company('Discovery Company One','Synthetic employer for privacy and contact tests.','https://example.com','Karachi') as company \gset
select set_config('test.discovery_company',:'company',true);
select public.register_organization('company','Discovery Company One','Synthetic employer for privacy and contact tests.','https://example.com',:'company') as org \gset
select set_config('test.discovery_org',:'org',true);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
select public.create_company('Discovery Company Two','Another synthetic employer for isolation tests.','https://example.com/two','Lahore') as company2 \gset
select set_config('test.discovery_company2',:'company2',true);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
update public.profiles set full_name='Visible Candidate',headline='Public professional headline',skills=array['React'],is_public=true where id=auth.uid();
insert into public.projects(talent_id,title,description,demo_url) values(auth.uid(),'Accessible energy dashboard','Public project work with keyboard accessibility.','https://example.com/public-project');
-- Public URL alone is not directory consent.
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$begin if (public.search_passports(current_setting('test.discovery_company')::uuid)->>'total')::int<>0 then raise exception 'Public profile implicitly discoverable';end if;end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
select public.set_discovery_preferences(true,true);

set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Contact challenge fixture','description','Build an accessible project for a synthetic challenge.','skills',jsonb_build_array('React'),'difficulty','Beginner','deadline',current_date+10,'deliverables','Deliver a working interface with source code.'),'[]') as challenge \gset
select public.create_contact_request(:'company','d1000000-0000-4000-8000-000000000002','Discuss this accessible interface challenge.',:'challenge',null) as request \gset
select set_config('test.handoff',:'request',true);
do $$begin
 begin perform public.send_contact_followup(current_setting('test.handoff')::uuid,'question','Pending cannot receive a message.',gen_random_uuid());raise exception 'Pending write bypass';exception when raise_exception then if sqlerrm='Pending write bypass' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
select public.respond_contact_request(:'request','accepted');
select public.send_contact_followup(:'request','next_steps','Please explain the next step for the project.','11111111-1111-4111-8111-111111111111') as note \gset
select set_config('test.handoff_note',:'note',true);
do $$begin
 if public.send_contact_followup(current_setting('test.handoff')::uuid,'next_steps','Please explain the next step for the project.','11111111-1111-4111-8111-111111111111')<>current_setting('test.handoff_note')::uuid then raise exception 'Retry duplicated note';end if;
 if (public.contact_request_opportunity(current_setting('test.handoff')::uuid)->>'status')<>'Open' then raise exception 'Linked opportunity missing';end if;
 if exists(select 1 from public.contact_followups) then raise exception 'Candidate saw private staff attribution';end if;
 if (select count(*) from public.visible_contact_followups)<>1 then raise exception 'Candidate lost safe notes';end if;
 begin insert into public.contact_followups(request_id,created_by,sender,topic,body,client_nonce) values(current_setting('test.handoff')::uuid,auth.uid(),'organization','question','Direct writes must be denied.',gen_random_uuid());raise exception 'Direct write';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
do $$begin
 if exists(select 1 from public.visible_contact_followups) or exists(select 1 from public.contact_followups) then raise exception 'Cross organization leak';end if;
 begin perform public.send_contact_followup(current_setting('test.handoff')::uuid,'question','Unrelated company must be denied.',gen_random_uuid());raise exception 'Company bypass';exception when raise_exception then if sqlerrm='Company bypass' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
select public.send_contact_followup(:'request','response','Review the deliverables and submit through the challenge.',gen_random_uuid());
update public.challenges set status='closed' where id=:'challenge';
do $$begin
 if (public.contact_request_opportunity(current_setting('test.handoff')::uuid)->>'status')<>'Closed' then raise exception 'Closed opportunity advertised open';end if;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
do $$begin
 for i in 1..5 loop perform public.send_contact_followup(current_setting('test.handoff')::uuid,'question','Another short question for the employer.',gen_random_uuid());end loop;
 begin perform public.send_contact_followup(current_setting('test.handoff')::uuid,'question','The seventh note must be blocked.',gen_random_uuid());raise exception 'Quota bypass';exception when raise_exception then if sqlerrm='Quota bypass' then raise;end if;end;
end$$;
select public.set_discovery_preferences(false,false);
do $$begin
 begin perform public.send_contact_followup(current_setting('test.handoff')::uuid,'question','Privacy withdrawal prevents further follow-up.',gen_random_uuid());raise exception 'Privacy bypass';exception when raise_exception then if sqlerrm='Privacy bypass' then raise;end if;end;
end$$;
select public.close_contact_request(:'request');
select public.set_discovery_preferences(true,true);
do $$begin
 begin perform public.respond_contact_request(current_setting('test.handoff')::uuid,'accepted');raise exception 'Closed reopened';exception when raise_exception then if sqlerrm='Closed reopened' then raise;end if;end;
 if (select count(*) from public.visible_contact_followups)<>7 then raise exception 'Closed history lost';end if;
end$$;

-- Company-wide cap must hold across several representatives, below actor caps.
reset role;
insert into public.company_memberships(company_id,user_id,role) values
(:'company','d1000000-0000-4000-8000-000000000005','reviewer'),
(:'company','d1000000-0000-4000-8000-000000000006','reviewer');
update public.profiles set is_public=true,is_discoverable=true,allow_contact_requests=true where id between 'd1000000-0000-4000-8000-000000000007' and 'd1000000-0000-4000-8000-000000000013';
set local role authenticated;
do $$declare r uuid;n integer=1;actor uuid;recipient uuid;begin
 for person in 7..13 loop
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
 recipient=('d1000000-0000-4000-8000-'||lpad(person::text,12,'0'))::uuid;
 r=public.create_contact_request(current_setting('test.discovery_company')::uuid,recipient,'Discuss a concrete next step for synthetic work.');
 perform set_config('request.jwt.claim.sub',recipient::text,true);perform public.respond_contact_request(r,'accepted');
 for item in 1..6 loop
 actor=case when n<18 then 'd1000000-0000-4000-8000-000000000001'::uuid when n<36 then 'd1000000-0000-4000-8000-000000000005'::uuid else 'd1000000-0000-4000-8000-000000000006'::uuid end;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 if n<40 then perform public.send_contact_followup(r,'question','A bounded organization follow-up for quota testing.',gen_random_uuid());n=n+1;
 else begin perform public.send_contact_followup(r,'question','The company-wide quota must reject this message.',gen_random_uuid());raise exception 'Company quota bypass';exception when raise_exception then if sqlerrm='Company quota bypass' then raise;end if;end;end if;
 end loop;end loop;
 if n<>40 then raise exception 'Company quota fixture incomplete';end if;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin
 begin perform 1 from public.visible_contact_followups;raise exception 'Public followups';exception when insufficient_privilege then null;end;
end$$;
rollback;
\echo 'PASS: bounded private contact handoff, consent, original retries, membership, opportunity lifecycle, quotas and closure'
