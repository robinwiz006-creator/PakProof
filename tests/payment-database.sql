-- Isolated SQL fixtures test the trusted-server write boundary, NOT real onchain settlement.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('b0000000-0000-4000-8000-000000000001','{"full_name":"Payment Company Fixture"}'),
('b0000000-0000-4000-8000-000000000002','{"full_name":"Payment Worker Fixture"}'),
('b0000000-0000-4000-8000-000000000003','{"full_name":"Unrelated Fixture"}');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select public.create_company('Payment fixture company','An isolated company testing payment permissions, not sending money.','https://example.com','Karachi') as company_id \gset
select public.register_organization('company','','','',:'company_id') as organization_id \gset
select public.create_paid_project(:'company_id','Payment fixture work','Build an accessible interface and deliver all source and documentation.','A deployed demo, source code and documented handover are required.',array['React'],current_date+30,'1500000',jsonb_build_array(jsonb_build_object('title','Interface','deliverables','Deliver the complete working accessible interface and source.','deadline',current_date+20,'amount_units','1250000'),jsonb_build_object('title','Handover','deliverables','Deliver documentation and handover the completed interface.','deadline',current_date+25,'amount_units','250000'))) as project_id \gset
select public.publish_paid_project(:'project_id');
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
select public.apply_paid_project(:'project_id','I have relevant interface work and can complete this project.','https://example.com/portfolio');
select id as application_id from public.paid_project_applications where project_id=:'project_id' \gset
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select public.select_paid_worker(:'application_id') as offer_id \gset
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
select public.respond_paid_offer(:'offer_id',true);
select id as milestone_id from public.paid_milestones where project_id=:'project_id' and position=1 \gset
select id as second_milestone from public.paid_milestones where project_id=:'project_id' and position=2 \gset
select public.submit_paid_milestone(:'milestone_id','The interface and source are ready for fixture review.','https://example.com/work');
select public.submit_paid_milestone(:'second_milestone','The documentation and handover are ready for fixture review.','https://example.com/docs');
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select public.review_paid_milestone(:'milestone_id','approved','All interface deliverables are accepted for this fixture.');
select public.review_paid_milestone(:'second_milestone','approved','All handover deliverables are accepted for this fixture.');
reset role;
insert into public.wallet_ownership_challenges(user_id,wallet_address,purpose,organization_id,message,expires_at) values('b0000000-0000-4000-8000-000000000001','11111111111111111111111111111111','company_payer',:'organization_id','Offline signature fixture, not a production signature',now()+interval '5 minutes') returning id as payer_challenge \gset
insert into public.wallet_ownership_challenges(user_id,wallet_address,purpose,message,expires_at) values('b0000000-0000-4000-8000-000000000002','So11111111111111111111111111111111111111112','account','Offline recipient ownership fixture',now()+interval '5 minutes') returning id as recipient_challenge \gset
set local role service_role;
select public.record_wallet_connection(:'payer_challenge','b0000000-0000-4000-8000-000000000001','offline-fixture') as payer_connection \gset
select public.record_wallet_connection(:'recipient_challenge','b0000000-0000-4000-8000-000000000002','offline-fixture') as recipient_connection \gset
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
select public.authorize_project_payout(:'project_id',:'recipient_connection');
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select public.prepare_milestone_payment(:'milestone_id',:'payer_connection','fixture-source','fixture-destination') as intent_id \gset
select set_config('test.payment_intent',:'intent_id',true);
select set_config('test.payment_milestone',:'milestone_id',true);
select set_config('test.payment_wallet',:'recipient_connection',true);
select set_config('test.payment_project',:'project_id',true);
select set_config('test.payment_payer',:'payer_connection',true);
do $$begin
 if public.prepare_milestone_payment(current_setting('test.payment_milestone')::uuid,current_setting('test.payment_payer')::uuid,'fixture-source','fixture-destination')<>current_setting('test.payment_intent')::uuid then raise exception 'Duplicate preparation created a second intent';end if;
 begin perform public.record_payment_result(gen_random_uuid(),'paid','Forged receipt',now());raise exception 'Client could bypass settlement verification';exception when insufficient_privilege then null;end;
 begin insert into public.payment_receipts(intent_id,attempt_id,milestone_id,signature,amount_units,mint,payer_wallet,recipient_wallet,finalized_at) values(gen_random_uuid(),gen_random_uuid(),current_setting('test.payment_milestone')::uuid,'forged',1250000,'mint','payer','recipient',now());raise exception 'Client could forge receipt';exception when insufficient_privilege then null;end;
end$$;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000002';
do $$begin
 begin perform public.disconnect_wallet(current_setting('test.payment_wallet')::uuid);raise exception 'Unresolved recipient wallet could disconnect';exception when raise_exception then if sqlerrm='Unresolved recipient wallet could disconnect' then raise;end if;end;
 begin perform public.authorize_project_payout(current_setting('test.payment_project')::uuid,current_setting('test.payment_wallet')::uuid);raise exception 'Prepared payment destination could change';exception when raise_exception then if sqlerrm='Prepared payment destination could change' then raise;end if;end;
end$$;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000003';
do $$begin if exists(select 1 from public.payment_intents) or exists(select 1 from public.payment_receipts) then raise exception 'Payment details leaked to unrelated user';end if;end$$;
set local role service_role;
select public.store_payment_template(:'intent_id','b0000000-0000-4000-8000-000000000001','offline-unsigned-template','offline-blockhash',1000) as attempt_id \gset
select set_config('test.payment_attempt',:'attempt_id',true);
select public.register_signed_payment(:'attempt_id','b0000000-0000-4000-8000-000000000001',repeat('1',88),'offline-signed-bytes');
-- A refresh retries the same registration, rather than generating a new attempt.
select public.register_signed_payment(:'attempt_id','b0000000-0000-4000-8000-000000000001',repeat('1',88),'offline-signed-bytes');
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.cancel_unsigned_payment(current_setting('test.payment_intent')::uuid);raise exception 'Signed payment could be cancelled';exception when raise_exception then if sqlerrm='Signed payment could be cancelled' then raise;end if;end;
end$$;
set local role service_role;
select public.record_payment_result(:'attempt_id','pending','Fixture pending transaction, not a real transfer');
select public.record_payment_result(:'attempt_id','paid','Offline settlement verifier fixture',now());
select public.record_payment_result(:'attempt_id','paid','Repeated settlement is idempotent',now());
do $$begin
 if (select count(*) from public.payment_receipts)<>1 then raise exception 'Duplicate receipt credited';end if;
 if (select status from public.paid_projects where id=current_setting('test.payment_project')::uuid)<>'active' then raise exception 'Partially paid project prematurely completed';end if;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='b0000000-0000-4000-8000-000000000001';
select public.prepare_milestone_payment(:'second_milestone',:'payer_connection','fixture-source','fixture-destination') as second_intent \gset
set local role service_role;
select public.store_payment_template(:'second_intent','b0000000-0000-4000-8000-000000000001','offline-second-template','offline-blockhash',1000) as second_attempt \gset
select set_config('test.second_attempt',:'second_attempt',true);
do $$begin
 begin perform public.register_signed_payment(current_setting('test.second_attempt')::uuid,'b0000000-0000-4000-8000-000000000001',repeat('1',88),'offline-second-signed');raise exception 'Signature reused for another milestone';exception when unique_violation then null;end;
end$$;
select public.register_signed_payment(:'second_attempt','b0000000-0000-4000-8000-000000000001',repeat('2',88),'offline-second-signed');
select public.record_payment_result(:'second_attempt','paid','Offline second settlement verifier fixture',now());
do $$begin
 if (select count(*) from public.payment_receipts)<>2 then raise exception 'Second receipt missing';end if;
 if (select status from public.paid_projects where id=current_setting('test.payment_project')::uuid)<>'completed' then raise exception 'Fully settled project not completed';end if;
 if exists(select 1 from public.wallet_connections where lock_reason is not null) then raise exception 'Resolved wallet locks not released';end if;
 if exists(select 1 from public.credentials) then raise exception 'Payment incorrectly issued a credential';end if;
end$$;
rollback;
\echo 'PASS: payment trust boundary, pinned payout, wallet locks, duplicate prevention, receipt uniqueness and project completion (offline fixtures only)'
