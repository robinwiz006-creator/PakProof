\set ON_ERROR_STOP on
begin;
insert into auth.users(id,raw_user_meta_data) values
('80000000-0000-4000-8000-000000000001','{"full_name":"Wallet Owner"}'),
('90000000-0000-4000-8000-000000000001','{"full_name":"Other Account"}');
insert into public.wallet_ownership_challenges(user_id,wallet_address,purpose,message,expires_at) values('80000000-0000-4000-8000-000000000001','fixture-public-key','account','Fixture ownership message already verified by an offline signature test',now()+interval '5 minutes') returning id as challenge_id \gset
select set_config('test.wallet_challenge',:'challenge_id',true);
set local role authenticated;
set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
do $$begin
 begin insert into public.wallet_connections(user_id,wallet_address,purpose,ownership_challenge_id,ownership_signature) values(auth.uid(),'forged','account',current_setting('test.wallet_challenge')::uuid,'forged');raise exception 'Direct ownership forgery allowed';exception when insufficient_privilege then null;end;
 begin perform public.record_wallet_connection(current_setting('test.wallet_challenge')::uuid,auth.uid(),'forged');raise exception 'User bypassed server signature check';exception when insufficient_privilege then null;end;
end$$;
set local role service_role;
select public.record_wallet_connection(:'challenge_id','80000000-0000-4000-8000-000000000001','offline-verified-fixture-signature') as wallet_id \gset
select set_config('test.wallet_id',:'wallet_id',true);
do $$begin
 begin perform public.record_wallet_connection(current_setting('test.wallet_challenge')::uuid,'80000000-0000-4000-8000-000000000001','same-signature');raise exception 'Ownership replay allowed';exception when raise_exception then if sqlerrm='Ownership replay allowed' then raise;end if;end;
end$$;
set local role authenticated;
set local request.jwt.claim.sub='90000000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from public.wallet_connections) then raise exception 'Other wallet connection leaked';end if;
 begin perform public.disconnect_wallet(current_setting('test.wallet_id')::uuid);raise exception 'Other account disconnected wallet';exception when raise_exception then if sqlerrm='Other account disconnected wallet' then raise;end if;end;
end$$;
reset role;
update public.wallet_connections set lock_reason='Fixture unresolved transfer' where id=:'wallet_id';
set local role authenticated;
set local request.jwt.claim.sub='80000000-0000-4000-8000-000000000001';
do $$begin
 begin perform public.disconnect_wallet(current_setting('test.wallet_id')::uuid);raise exception 'Locked wallet replacement allowed';exception when raise_exception then if sqlerrm='Locked wallet replacement allowed' then raise;end if;end;
end$$;
reset role;
update public.wallet_connections set lock_reason=null where id=:'wallet_id';
set local role authenticated;
select public.disconnect_wallet(:'wallet_id');
do $$begin if not exists(select 1 from public.wallet_connections where disconnected_at is not null) then raise exception 'Disconnect was not recorded';end if;end$$;
reset role;
insert into public.wallet_ownership_challenges(user_id,wallet_address,purpose,message,expires_at) values('80000000-0000-4000-8000-000000000001','fixture-key','account','Expired fixture message',now()-interval '1 minute') returning id as expired_id \gset
select set_config('test.expired_challenge',:'expired_id',true);
set local role service_role;
do $$begin
 begin perform public.record_wallet_connection(current_setting('test.expired_challenge')::uuid,'80000000-0000-4000-8000-000000000001','fixture');raise exception 'Expired challenge accepted';exception when raise_exception then if sqlerrm='Expired challenge accepted' then raise;end if;end;
end$$;
rollback;
\echo 'PASS: wallet write boundary, one-time consumption, privacy, disconnect ownership, lock guard, and expiry'
