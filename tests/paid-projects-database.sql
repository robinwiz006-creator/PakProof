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
set local role anon;
set local request.jwt.claim.sub='';
do $$begin if exists(select 1 from public.paid_projects) then raise exception 'Draft leaked publicly';end if;end$$;
set local role authenticated;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.publish_paid_project(:'project_id');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.apply_paid_project(:'project_id','I built accessible React dashboards and can deliver this work.','https://example.com/portfolio');
select id as application_id from public.paid_project_applications where project_id=:'project_id' \gset
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
do $$begin
 if exists(select 1 from public.paid_project_applications) then raise exception 'Private application leaked';end if;
 begin perform public.publish_paid_project(current_setting('test.paid_project')::uuid);raise exception 'Unauthorized publication allowed';exception when raise_exception then if sqlerrm='Unauthorized publication allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.select_paid_worker(:'application_id') as offer_id \gset
select set_config('test.paid_offer',:'offer_id',true);
select id as milestone_id from public.paid_milestones where project_id=:'project_id' \gset
select set_config('test.paid_milestone',:'milestone_id',true);
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.submit_paid_milestone(current_setting('test.paid_milestone')::uuid,'Work before I accepted the terms.','https://example.com/work');raise exception 'Unaccepted work submission allowed';exception when raise_exception then if sqlerrm='Unaccepted work submission allowed' then raise;end if;end;
end$$;
select public.respond_paid_offer(:'offer_id',true);
select public.submit_paid_milestone(:'milestone_id','The first accessible dashboard is ready for company review.','https://example.com/private-work');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000003';
do $$begin
 if exists(select 1 from public.paid_milestone_submissions) then raise exception 'Private work evidence leaked';end if;
 begin perform public.review_paid_milestone(current_setting('test.paid_milestone')::uuid,'approved','Unrelated reviewer tries approval.');raise exception 'Unauthorized approval allowed';exception when raise_exception then if sqlerrm='Unauthorized approval allowed' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.review_paid_milestone(:'milestone_id','revisions','Please include keyboard navigation and handover documentation.');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.submit_paid_milestone(:'milestone_id','Revised dashboard now includes keyboard navigation and handover docs.','https://example.com/revised');
set local request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.review_paid_milestone(:'milestone_id','approved','All agreed deliverables were reviewed and accepted.');
do $$begin
 if (select work_status from public.paid_milestones where id=current_setting('test.paid_milestone')::uuid)<>'approved' then raise exception 'Approval missing';end if;
 if (select status from public.paid_projects where id=current_setting('test.paid_project')::uuid)<>'active' then raise exception 'Approval falsely completed unpaid project';end if;
 begin update public.paid_milestones set work_status='approved';raise exception 'Direct approval allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$begin
 begin update public.paid_project_offers set terms='{}';raise exception 'Accepted terms were mutable';exception when raise_exception then if sqlerrm='Accepted terms were mutable' then raise;end if;end;
 begin update public.paid_milestones set amount_units=1;raise exception 'Agreed amount was mutable';exception when raise_exception then if sqlerrm='Agreed amount was mutable' then raise;end if;end;
end$$;
rollback;
\echo 'PASS: paid project draft/publication/application/selection/acceptance/revisions/approval, immutable terms and privacy'
