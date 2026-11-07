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
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000003';
update public.profiles set full_name='Private Search Probe',is_discoverable=true,skills=array['HiddenSkill'] where id=auth.uid();
insert into public.projects(talent_id,title,description,demo_url) values(auth.uid(),'HiddenProjectProbe','Private project information must not be searchable.','https://example.com/private-project');
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000004';
update public.profiles set full_name='Opted Out Public Probe',is_public=true where id=auth.uid();
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$declare r jsonb;begin
 r=public.search_passports(current_setting('test.discovery_company')::uuid,'energy','react');
 if (r->>'total')::int<>1 or r->'items'->0->>'full_name'<>'Visible Candidate' then raise exception 'Public project/skill search failed';end if;
 if (public.search_passports(current_setting('test.discovery_company')::uuid,'HiddenProjectProbe')->>'total')::int<>0 or (public.search_passports(current_setting('test.discovery_company')::uuid,'Opted Out')->>'total')::int<>0 then raise exception 'Search leaked hidden profiles/projects';end if;
 if (public.search_passports(current_setting('test.discovery_company')::uuid,'%')->>'total')::int<>0 then raise exception 'Wildcard widened search';end if;
 if (public.search_passports(current_setting('test.discovery_company')::uuid,'','',true)->>'total')::int<>0 then raise exception 'Credential filter false positive';end if;
end$$;
select public.save_candidate(:'company','d1000000-0000-4000-8000-000000000002','Private company one note');
select public.save_candidate(:'company','d1000000-0000-4000-8000-000000000002','Updated private note');
do $$begin if (select count(*) from public.employer_shortlists)<>1 then raise exception 'Shortlist duplicated';end if;end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
do $$begin
 if exists(select 1 from public.employer_shortlists) then raise exception 'Cross-company shortlist leaked';end if;
 begin perform public.save_candidate(current_setting('test.discovery_company')::uuid,'d1000000-0000-4000-8000-000000000002','Forged note');raise exception 'Cross-company shortlist write';exception when raise_exception then if sqlerrm='Cross-company shortlist write' then raise;end if;end;
end$$;
select public.save_candidate(:'company2','d1000000-0000-4000-8000-000000000002','Company two private note');
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000006';
select public.review_issuer_authorization(:'org','Synthetic scope approval for credential filter tests.',true,'Discovery Company One','Synthetic employer for privacy and contact tests.','https://example.com',array['company_achievement'],null);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
select public.issue_credential(:'org','d1000000-0000-4000-8000-000000000002','Unpublished Credential Probe','company_achievement','Synthetic private credential not included in directory results.',current_date,null,'','','') as credential \gset
do $$begin if (public.search_passports(current_setting('test.discovery_company')::uuid,'','',true)->>'total')::int<>0 then raise exception 'Private credential existence leaked';end if;end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
select public.respond_credential(:'credential','accepted',true,false);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$begin if (public.search_passports(current_setting('test.discovery_company')::uuid,'','',true)->>'total')::int<>1 then raise exception 'Published credential filter missing';end if;end$$;
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company','title','Directory assessed work','description','Synthetic accessible work used to test assessment publication.','skills',jsonb_build_array('React'),'difficulty','Beginner','deadline',current_date+20,'deliverables','Provide source code and keyboard navigation evidence.'),'[{"title":"Accessibility","description":"All controls support keyboard use."}]') as challenge \gset
select id as rubric from public.challenge_rubrics where challenge_id=:'challenge' \gset
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
select public.submit_work(:'challenge','https://example.com/private-evidence','','Private submission explanation must not be copied into a shortlist.') as submission \gset
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
select public.review_assessed_submission(:'submission','approved','Private reviewer feedback must not leak through discovery.','["met"]',:'rubric') as achievement \gset
do $$begin if (public.search_passports(current_setting('test.discovery_company')::uuid,'','',false,true)->>'total')::int<>0 then raise exception 'Hidden assessment revealed by filter';end if;end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
insert into public.achievement_sharing(achievement_id,share_assessment) values(:'achievement',true);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$declare r jsonb;begin
 r=public.search_passports(current_setting('test.discovery_company')::uuid,'','',false,true);
 if (r->>'total')::int<>1 or r->'items'->0->'achievements'->0->>'assessed'<>'true' then raise exception 'Consented assessed summary missing';end if;
 if position('Private reviewer' in r::text)>0 or position('private-evidence' in r::text)>0 or position('Company two' in r::text)>0 then raise exception 'Directory projection leaked private content';end if;
end$$;
select public.create_contact_request(:'company','d1000000-0000-4000-8000-000000000002','We would like to discuss your accessible interface work.',:'challenge',null) as request \gset
select set_config('test.discovery_request',:'request',true);
do $$begin
 begin perform public.create_contact_request(current_setting('test.discovery_company')::uuid,'d1000000-0000-4000-8000-000000000002','Duplicate requests must be rejected by the server.');raise exception 'Duplicate contact allowed';exception when raise_exception then if sqlerrm='Duplicate contact allowed' then raise;end if;end;
 begin update public.contact_requests set status='accepted';raise exception 'Company accepted itself';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
do $$begin if exists(select 1 from public.visible_contact_requests) then raise exception 'Unrelated company read contact';end if;end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
do $$declare r jsonb;begin
 if (select count(*) from public.visible_contact_requests)<>1 or exists(select 1 from public.contact_requests) then raise exception 'Recipient contact projection broken';end if;
 select to_jsonb(t) into r from public.visible_contact_requests t limit 1;
 if r ?| array['created_by','email','phone'] then raise exception 'Contact exposed private details';end if;
end$$;
select public.respond_contact_request(:'request','accepted');
select public.respond_contact_request(:'request','declined');
select public.set_discovery_preferences(false,false);
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$begin
 if (public.search_passports(current_setting('test.discovery_company')::uuid,'','',false,false,true)->>'total')::int<>0 or exists(select 1 from public.employer_shortlists) or exists(select 1 from public.visible_contact_requests) then raise exception 'Withdrawal failed to hide candidate in saved/contact views';end if;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000002';
select public.set_discovery_preferences(true,true);
update public.profiles set is_public=false where id=auth.uid();
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$begin if (public.search_passports(current_setting('test.discovery_company')::uuid)->>'total')::int<>0 then raise exception 'Private Passport appeared';end if;end$$;
reset role;
-- Explicit local pagination fixture opt-ins, never a migration/data backfill.
update public.profiles set is_public=true,is_discoverable=true,allow_contact_requests=true where id::text like 'd1000000%' and id::text>='d1000000-0000-4000-8000-000000000010';
set local role authenticated;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000001';
do $$declare a jsonb;b jsonb;n integer;begin
 a=public.search_passports(current_setting('test.discovery_company')::uuid);b=public.search_passports(current_setting('test.discovery_company')::uuid,'','',false,false,false,2);
 if (a->>'total')::int<>26 or jsonb_array_length(a->'items')<>20 or jsonb_array_length(b->'items')<>6 then raise exception 'Server pagination/count incorrect';end if;
 if exists(select 1 from jsonb_array_elements(a->'items') x join jsonb_array_elements(b->'items') y on x->>'id'=y->>'id') then raise exception 'Pages overlap';end if;
 for n in 10..18 loop perform public.create_contact_request(current_setting('test.discovery_company')::uuid,('d1000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Synthetic invitation for bounded contact quota tests.');end loop;
 begin perform public.create_contact_request(current_setting('test.discovery_company')::uuid,'d1000000-0000-4000-8000-000000000019','The eleventh request must fail the daily limit.');raise exception 'Organization quota bypass';exception when raise_exception then if sqlerrm='Organization quota bypass' then raise;end if;end;
end$$;
select public.create_company('Additional Fixture Company','Another owned company for per-actor limit tests.','https://example.com','Karachi') as company3 \gset
select set_config('test.discovery_company3',:'company3',true);
do $$begin
 begin perform public.create_contact_request(current_setting('test.discovery_company3')::uuid,'d1000000-0000-4000-8000-000000000020','A new company must not bypass the actor daily limit.');raise exception 'Actor quota bypass';exception when raise_exception then if sqlerrm='Actor quota bypass' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000004';
do $$begin
 begin perform public.search_passports(current_setting('test.discovery_company')::uuid);raise exception 'Nonmember search';exception when raise_exception then if sqlerrm='Nonmember search' then raise;end if;end;
 begin perform public.respond_contact_request(current_setting('test.discovery_request')::uuid,'accepted');raise exception 'Other recipient responded';exception when raise_exception then if sqlerrm='Other recipient responded' then raise;end if;end;
end$$;
reset role;
-- A second legitimate reviewer cannot bypass a company's daily cap.
insert into public.company_memberships(company_id,user_id,role) values(:'company','d1000000-0000-4000-8000-000000000005','reviewer');
set local role authenticated;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
do $$begin
 begin perform public.create_contact_request(current_setting('test.discovery_company')::uuid,'d1000000-0000-4000-8000-000000000021','Another company member must not bypass the company daily limit.');raise exception 'Cross-member quota bypass';exception when raise_exception then if sqlerrm='Cross-member quota bypass' then raise;end if;end;
end$$;
reset role;
-- Seed a full pending inbox in the disposable DB to test a different sender's cap.
update public.profiles set is_public=true where id='d1000000-0000-4000-8000-000000000002';
insert into public.companies(id,name,description) select ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Inbox cap fixture '||n,'Synthetic inbox capacity fixture.' from generate_series(1,20) n;
insert into public.contact_requests(company_id,candidate_id,created_by,purpose)
select ('d2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'d1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000001','Synthetic existing pending request for recipient capacity.' from generate_series(1,20) n;
set local role authenticated;
set local request.jwt.claim.sub='d1000000-0000-4000-8000-000000000005';
do $$begin
 begin perform public.create_contact_request(current_setting('test.discovery_company2')::uuid,'d1000000-0000-4000-8000-000000000002','An eligible new company must respect the recipient pending inbox cap.');raise exception 'Recipient pending cap bypass';exception when raise_exception then if sqlerrm='Recipient pending cap bypass' then raise;end if;end;
end$$;
reset role;
rollback;
\echo 'PASS: opt-in public search, hidden filters, paging, organization-isolated notes, consent-safe requests, duplicate and daily quotas, withdrawal and existing record privacy'
