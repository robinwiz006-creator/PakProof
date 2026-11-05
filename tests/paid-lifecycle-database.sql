\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000001','{"full_name":"Fixture Company"}'),
('a0000000-0000-4000-8000-000000000002','{"full_name":"Fixture Worker"}'),
('a0000000-0000-4000-8000-000000000003','{"full_name":"Other Worker"}');
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.create_company('Fixture Company','An isolated company for paid-work security tests.','https://example.com','Karachi') as company_id \gset
select public.create_paid_project(:'company_id','Dashboard project','Build and document an accessible dashboard for a fixture company.','Deliver deployed source, documentation and a clear handover.',array['React'],current_date+30,'1250000',jsonb_build_array(jsonb_build_object('title','Dashboard delivery','deliverables','Deploy an accessible responsive dashboard and public source.','deadline',current_date+20,'amount_units','1250000'))) as project_id \gset
select set_config('test.paid_project',:'project_id',true);

select set_config('test.lifecycle_project',:'project_id',true);
select jsonb_build_object('title',p.title,'description',p.description,'requirements',p.requirements,'skills',p.skills,'deadline',p.deadline,'budget_units',p.budget_units::text,'milestones',(select jsonb_agg(to_jsonb(m) order by position) from public.paid_milestones m where project_id=p.id)) as expected from public.paid_projects p where id=:'project_id' \gset
select public.edit_paid_project(:'project_id','Corrected dashboard project','A corrected accessible dashboard with complete delivery documentation.','Deliver deployed source, documentation and a clear handover.',array['React','SQL'],current_date+30,'2500000',jsonb_build_array(jsonb_build_object('title','Updated dashboard delivery','deliverables','Deploy an accessible responsive dashboard and public source.','deadline',current_date+20,'amount_units','2500000')),:'expected'::jsonb);
do $$begin
 if (select budget_units from public.paid_projects where id=current_setting('test.lifecycle_project')::uuid)<>2500000 then raise exception 'Draft edit missing';end if;
 if (select count(*) from public.paid_milestones where project_id=current_setting('test.lifecycle_project')::uuid)<>1 then raise exception 'Milestone identity changed';end if;
 begin perform public.edit_paid_project(current_setting('test.lifecycle_project')::uuid,'stale','A sufficiently long corrected description for this draft.','A sufficiently long requirement.',array['React'],current_date+30,'1000000','[]','{}');raise exception 'Stale edit allowed';exception when raise_exception then if sqlerrm='Stale edit allowed' then raise;end if;end;
 begin delete from public.paid_project_events;raise exception 'Audit delete allowed';exception when insufficient_privilege then null;end;
end$$;
select public.create_paid_project(:'company_id','Dashboard project','Build and document an accessible dashboard for a fixture company.','Deliver deployed source, documentation and a clear handover.',array['React'],current_date+30,'1250000',jsonb_build_array(jsonb_build_object('title','Dashboard delivery','deliverables','Deploy an accessible responsive dashboard and public source.','deadline',current_date+20,'amount_units','1250000'))) as cancelled_draft \gset
select public.change_paid_lifecycle(:'cancelled_draft','cancel','This unused draft is no longer needed.');
select public.publish_paid_project(:'project_id');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
do $$begin
 if exists(select 1 from public.paid_project_events) then raise exception 'Private audit leaked';end if;
 begin perform public.change_paid_lifecycle(current_setting('test.lifecycle_project')::uuid,'withdraw','Unrelated user attempts withdrawal.');raise exception 'Unauthorized withdraw allowed';exception when raise_exception then if sqlerrm='Unauthorized withdraw allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.apply_paid_project(:'project_id','I can complete the corrected dashboard and documentation.','https://example.com/portfolio');
select id as withdrawn_application from public.paid_project_applications where project_id=:'project_id' \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.select_paid_worker(:'withdrawn_application') as withdrawn_offer \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$begin
 if exists(select 1 from public.paid_project_events where action='draft_edited') then raise exception 'Worker accessed private draft negotiation history';end if;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.change_paid_lifecycle(:'project_id','withdraw','The project requirements need to be reconsidered.');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select set_config('test.withdrawn_offer',:'withdrawn_offer',true);
do $$begin
 if (select status from public.paid_projects where id=current_setting('test.lifecycle_project')::uuid)<>'withdrawn' then raise exception 'Selected worker lost closed-project record';end if;
 begin perform public.respond_paid_offer(current_setting('test.withdrawn_offer')::uuid,true);raise exception 'Withdrawn offer accepted';exception when raise_exception then if sqlerrm='Withdrawn offer accepted' then raise;end if;end;
end$$;
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if exists(select 1 from public.public_paid_projects where id=current_setting('test.lifecycle_project')::uuid) then raise exception 'Withdrawn opportunity advertised';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.create_paid_project(:'company_id','Mutual cancellation project','Build and document an accessible dashboard for a fixture company.','Deliver deployed source, documentation and a clear handover.',array['React'],current_date+30,'1250000',jsonb_build_array(jsonb_build_object('title','Dashboard delivery','deliverables','Deploy an accessible responsive dashboard and public source.','deadline',current_date+20,'amount_units','1250000'))) as active_project \gset
select set_config('test.lifecycle_active',:'active_project',true);
select public.publish_paid_project(:'active_project');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.apply_paid_project(:'active_project','I can complete this practical dashboard project.','https://example.com/evidence');
select id as application_id from public.paid_project_applications where project_id=:'active_project' \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.select_paid_worker(:'application_id') as offer_id \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.respond_paid_offer(:'offer_id',true);
select id as milestone_id from public.paid_milestones where project_id=:'active_project' \gset
select public.submit_paid_milestone(:'milestone_id','The first dashboard version is ready to review.','https://example.com/private');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.change_paid_lifecycle(:'active_project','request','We propose ending this project by mutual agreement.');
do $$begin
 begin perform public.change_paid_lifecycle(current_setting('test.lifecycle_active')::uuid,'accept','The company cannot accept its own request.');raise exception 'Same side accepted';exception when raise_exception then if sqlerrm='Same side accepted' then raise;end if;end;
 begin perform public.change_paid_lifecycle(current_setting('test.lifecycle_active')::uuid,'cancel','Attempt a unilateral accepted cancellation.');raise exception 'Unilateral cancellation allowed';exception when raise_exception then if sqlerrm='Unilateral cancellation allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.change_paid_lifecycle(current_setting('test.lifecycle_active')::uuid,'accept','I agree to end this project with submitted work.');raise exception 'Submitted work cancellation allowed';exception when raise_exception then if sqlerrm='Submitted work cancellation allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.review_paid_milestone(:'milestone_id','approved','Deliverables have been reviewed and approved.');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.change_paid_lifecycle(current_setting('test.lifecycle_active')::uuid,'accept','I agree but this approved work remains unpaid.');raise exception 'Unpaid approval cancellation allowed';exception when raise_exception then if sqlerrm='Unpaid approval cancellation allowed' then raise;end if;end;
end$$;
select public.change_paid_lifecycle(:'active_project','decline','Please pay the approved work instead of cancelling.');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.create_paid_project(:'company_id','No work cancellation project','Build and document an accessible dashboard for a fixture company.','Deliver deployed source, documentation and a clear handover.',array['React'],current_date+30,'1250000',jsonb_build_array(jsonb_build_object('title','Dashboard delivery','deliverables','Deploy an accessible responsive dashboard and public source.','deadline',current_date+20,'amount_units','1250000'))) as empty_project \gset
select public.publish_paid_project(:'empty_project');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.apply_paid_project(:'empty_project','I can complete this practical dashboard project.','https://example.com/evidence');
select id as empty_application from public.paid_project_applications where project_id=:'empty_project' \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.select_paid_worker(:'empty_application') as empty_offer \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.respond_paid_offer(:'empty_offer',true);
select public.change_paid_lifecycle(:'empty_project','request','We agree to cancel before work starts.');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.change_paid_lifecycle(:'empty_project','accept','The organization agrees to end this accepted project.');
select set_config('test.lifecycle_cancelled',:'empty_project',true);
do $$begin
 if (select status from public.paid_projects where id=current_setting('test.lifecycle_cancelled')::uuid)<>'cancelled' then raise exception 'Mutual cancellation missing';end if;
 if not exists(select 1 from public.paid_project_offers where project_id=current_setting('test.lifecycle_cancelled')::uuid and response='accepted') then raise exception 'Accepted terms lost';end if;
end$$;

do $$begin
 if exists(select 1 from public.paid_work_history) then raise exception 'Cancelled or unpaid work became completed history';end if;
end$$;
rollback;
\echo 'PASS: lifecycle draft editing, stale writes, withdrawal, private audit, bilateral authorization, submitted-work and unpaid-approval cancellation guards'
