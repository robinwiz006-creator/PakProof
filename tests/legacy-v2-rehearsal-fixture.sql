-- LOCAL SYNTHETIC DATA ONLY. This stored v2 reference is NOT a real chain proof.
insert into public.challenges(id,company_id,title,description,difficulty,deadline,deliverables) values
('91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','Synthetic v2 challenge','Preserve a synthetic v2 record across an upgrade.','Beginner',current_date+20,'Synthetic approved evidence only.');
insert into public.challenge_submissions(id,challenge_id,talent_id,project_url,explanation,status) values
('91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','https://example.com/v2','Synthetic approved explanation for v2 preservation.','approved');
insert into public.submission_reviews(submission_id,reviewer_id,decision,feedback) values
('91000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000002','approved','Synthetic approval, not an actual assessment.');
insert into public.achievements(id,submission_id,challenge_id,talent_id,company_id,title) values
('91000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','Synthetic v2 achievement');
insert into public.blockchain_proofs(achievement_id,signature,record_hash,issuer_wallet,anchored_at,claim_version) values
('91000000-0000-4000-8000-000000000004','offline-v2-fixture-not-a-transaction',repeat('b',64),'offline-wallet',now(),2);
