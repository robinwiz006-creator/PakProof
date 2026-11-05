-- Synthetic local-only fixtures. All statuses deliberately contain worker IDs.
insert into auth.users(id,raw_user_meta_data) values
('a0000000-0000-4000-8000-000000000001','{"full_name":"Fixture Owner"}'),
('a0000000-0000-4000-8000-000000000002','{"full_name":"Fixture Worker"}'),
('a0000000-0000-4000-8000-000000000003','{"full_name":"Fixture Stranger"}'),
('a0000000-0000-4000-8000-000000000004','{"full_name":"Fixture Reviewer"}');
set role authenticated;
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select public.create_company('Privacy Fixture','Disposable local privacy test organization.','https://example.com','Karachi') as company_id \gset
reset role;
insert into public.company_memberships(company_id,user_id,role) values (:'company_id','a0000000-0000-4000-8000-000000000004','reviewer');
insert into public.paid_projects(company_id,title,description,requirements,skills,deadline,budget_units,status,worker_id)
select :'company_id', 'Privacy '||s, 'Synthetic project description with sufficient detail.', 'Synthetic project requirements for a safe test.',array['SQL'],current_date+30,1000000,s,'a0000000-0000-4000-8000-000000000002'
from unnest(array['draft','published','offered','active','completed']) s;
insert into public.paid_milestones(project_id,position,title,deliverables,deadline,amount_units)
select id,1,'Fixture delivery','Synthetic deliverables for local privacy tests.',current_date+20,1000000 from public.paid_projects;
insert into public.paid_project_applications(project_id,worker_id,applicant_name,pitch,evidence_url)
select id,'a0000000-0000-4000-8000-000000000002','Fixture Worker','Synthetic private application with sufficient detail.','https://example.com/private-application' from public.paid_projects;
insert into public.paid_milestone_submissions(milestone_id,worker_id,explanation,evidence_url)
select id,'a0000000-0000-4000-8000-000000000002','Synthetic private work explanation for security testing.','https://example.com/private-evidence' from public.paid_milestones;
