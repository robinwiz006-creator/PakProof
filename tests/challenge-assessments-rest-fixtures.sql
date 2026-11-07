-- Synthetic approved-work candidate; no credential is automatically issued.
set role authenticated;
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000001';
select company_id from public.organizations limit 1 \gset
select public.create_challenge_with_rubric(jsonb_build_object('company_id',:'company_id','title','REST assessed work fixture','description','Build an accessible interface and document its behavior.','skills',jsonb_build_array('React'),'difficulty','Beginner','deadline',current_date+30,'deliverables','Provide source code and a keyboard navigation walkthrough.'),'[{"title":"Keyboard support","description":"Every control is keyboard accessible."}]') as challenge \gset
set request.jwt.claim.sub='a0000000-0000-4000-8000-000000000002';
select public.submit_work(:'challenge','https://example.com/private-assessment-evidence','','Private submission text that must never enter public assessment results.');
reset role;
