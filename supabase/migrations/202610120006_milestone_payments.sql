begin;
create table public.paid_payout_authorizations (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.paid_projects(id),worker_id uuid not null references public.profiles(id),
 wallet_connection_id uuid not null references public.wallet_connections(id),wallet_address text not null,created_at timestamptz not null default now()
);
alter table public.paid_projects add column payout_authorization_id uuid references public.paid_payout_authorizations(id);
create table public.payment_intents (
 id uuid primary key default gen_random_uuid(),milestone_id uuid not null references public.paid_milestones(id),offer_id uuid not null references public.paid_project_offers(id),
 approval_id uuid not null references public.paid_milestone_reviews(id),terms_hash text not null,amount_units numeric(20,0) not null check(amount_units>0),
 payer_user_id uuid not null references auth.users(id),payer_connection_id uuid not null references public.wallet_connections(id),payer_wallet text not null,source_account text not null,
 payout_authorization_id uuid not null references public.paid_payout_authorizations(id),recipient_connection_id uuid not null references public.wallet_connections(id),recipient_wallet text not null,destination_account text not null,
 nonce uuid not null default gen_random_uuid(),network text not null default 'devnet' check(network='devnet'),
 mint text not null default '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' check(mint='4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
 token_program text not null default 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' check(token_program='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),decimals integer not null default 6 check(decimals=6),
 status text not null default 'prepared' check(status in ('prepared','signed','pending','paid','failed','needs_review','cancelled')),created_at timestamptz not null default now()
);
create unique index one_live_payment_intent on public.payment_intents(milestone_id) where status not in ('failed','cancelled');
create table public.payment_attempts (
 id uuid primary key default gen_random_uuid(),intent_id uuid not null references public.payment_intents(id),
 template_base64 text not null,blockhash text not null,last_valid_block_height numeric(20,0) not null,
 signature text unique,signed_base64 text,status text not null default 'prepared' check(status in ('prepared','registered','pending','paid','failed','needs_review','cancelled')),
 status_note text not null default '',created_at timestamptz not null default now(),registered_at timestamptz,checked_at timestamptz,
 check((signature is null)=(signed_base64 is null))
);
create unique index one_live_payment_attempt on public.payment_attempts(intent_id) where status not in ('failed','cancelled');
create table public.payment_receipts (
 id uuid primary key default gen_random_uuid(),intent_id uuid not null unique references public.payment_intents(id),attempt_id uuid not null unique references public.payment_attempts(id),
 milestone_id uuid not null unique references public.paid_milestones(id),signature text not null unique,network text not null default 'devnet' check(network='devnet'),
 amount_units numeric(20,0) not null,mint text not null,payer_wallet text not null,recipient_wallet text not null,finalized_at timestamptz not null,created_at timestamptz not null default now()
);
create function public.refresh_payment_wallet_locks(p_intent uuid) returns void language sql security definer set search_path='' as $$
 update public.wallet_connections w set lock_reason=case when exists(select 1 from public.payment_intents i where (i.payer_connection_id=w.id or i.recipient_connection_id=w.id) and i.status in ('prepared','signed','pending','needs_review')) then 'An unresolved milestone payment uses this wallet. Reconcile or cancel its unsigned preparation before replacing it.' else null end
 where exists(select 1 from public.payment_intents i where i.id=p_intent and (i.payer_connection_id=w.id or i.recipient_connection_id=w.id));$$;
create function public.authorize_project_payout(p_project uuid,p_connection uuid) returns void language plpgsql security definer set search_path='' as $$
 declare p public.paid_projects;w public.wallet_connections;v_id uuid;begin
 select * into p from public.paid_projects where id=p_project for update;
 select * into w from public.wallet_connections where id=p_connection for update;
 if auth.uid() is null or p.worker_id<>auth.uid() or p.status<>'active' or w.user_id<>auth.uid() or w.id is null or w.purpose<>'account' or w.disconnected_at is not null then raise exception 'Select your verified account wallet for accepted work';end if;
 if exists(select 1 from public.payment_intents i join public.paid_milestones m on m.id=i.milestone_id where m.project_id=p.id and i.status in ('prepared','signed','pending','needs_review')) then raise exception 'An unresolved payment pins the current recipient. Resolve it before changing wallets';end if;
 insert into public.paid_payout_authorizations(project_id,worker_id,wallet_connection_id,wallet_address) values(p.id,auth.uid(),w.id,w.wallet_address) returning id into v_id;
 update public.paid_projects set payout_authorization_id=v_id where id=p.id;end;$$;
create function public.prepare_milestone_payment(p_milestone uuid,p_connection uuid,p_source text,p_destination text) returns uuid language plpgsql security definer set search_path='' as $$
 declare m public.paid_milestones;p public.paid_projects;o public.paid_project_offers;w public.wallet_connections;r public.wallet_connections;a public.paid_payout_authorizations;v_id uuid;begin
 select * into m from public.paid_milestones where id=p_milestone for update;
 select * into p from public.paid_projects where id=m.project_id for update;
 if m.id is null or not public.is_company_owner(p.company_id) or p.status<>'active' or m.work_status<>'approved' then raise exception 'Only the owning company may pay approved accepted work';end if;
 if exists(select 1 from public.payment_receipts where milestone_id=m.id) then raise exception 'This milestone is already paid';end if;
 select id into v_id from public.payment_intents where milestone_id=m.id and status not in ('failed','cancelled');
 if v_id is not null then return v_id;end if;
 select * into w from public.wallet_connections where id=p_connection for update;
 select * into a from public.paid_payout_authorizations where id=p.payout_authorization_id;
 select * into r from public.wallet_connections where id=a.wallet_connection_id for update;
 select * into o from public.paid_project_offers where id=p.current_offer_id;
 if w.id is null or w.user_id<>auth.uid() or w.purpose<>'company_payer' or w.disconnected_at is not null or not exists(select 1 from public.organizations where id=w.organization_id and company_id=p.company_id) then raise exception 'Link an owned company payer wallet';end if;
 if a.id is null or a.worker_id<>p.worker_id or r.id is null or r.user_id<>p.worker_id or r.purpose<>'account' or r.disconnected_at is not null or r.wallet_address<>a.wallet_address or o.response<>'accepted' then raise exception 'The worker must authorize a verified payout wallet';end if;
 if w.wallet_address=r.wallet_address then raise exception 'Payer and recipient wallets must differ';end if;
 insert into public.payment_intents(milestone_id,offer_id,approval_id,terms_hash,amount_units,payer_user_id,payer_connection_id,payer_wallet,source_account,payout_authorization_id,recipient_connection_id,recipient_wallet,destination_account)
 values(m.id,o.id,m.approval_id,o.terms_hash,m.amount_units,auth.uid(),w.id,w.wallet_address,p_source,a.id,r.id,r.wallet_address,p_destination) returning id into v_id;
 perform public.refresh_payment_wallet_locks(v_id);return v_id;end;$$;
-- Only the verified server may store a template or signed attempt, or settle a receipt.
create function public.store_payment_template(p_intent uuid,p_user uuid,p_template text,p_blockhash text,p_height numeric) returns uuid language plpgsql security definer set search_path='' as $$
 declare i public.payment_intents;p public.paid_projects;v_id uuid;begin
 select * into i from public.payment_intents where id=p_intent for update;
 select p0.* into p from public.paid_projects p0 join public.paid_milestones m on m.project_id=p0.id where m.id=i.milestone_id;
 if i.id is null or i.payer_user_id<>p_user or i.status<>'prepared' or not exists(select 1 from public.company_memberships where company_id=p.company_id and user_id=p_user and role='owner') or not exists(select 1 from public.wallet_connections where id=i.payer_connection_id and disconnected_at is null) then raise exception 'This payment cannot be prepared for signing';end if;
 update public.payment_attempts set status='cancelled' where intent_id=i.id and status='prepared';
 insert into public.payment_attempts(intent_id,template_base64,blockhash,last_valid_block_height) values(i.id,p_template,p_blockhash,p_height) returning id into v_id;return v_id;end;$$;
create function public.register_signed_payment(p_attempt uuid,p_user uuid,p_signature text,p_signed text) returns void language plpgsql security definer set search_path='' as $$
 declare a public.payment_attempts;i public.payment_intents;v_company uuid;begin
 select i0.* into i from public.payment_intents i0 join public.payment_attempts a0 on a0.intent_id=i0.id where a0.id=p_attempt for update of i0;
 select * into a from public.payment_attempts where id=p_attempt for update;
 if a.signature=p_signature and a.signed_base64=p_signed then return;end if;
 select p.company_id into v_company from public.paid_projects p join public.paid_milestones m on m.project_id=p.id where m.id=i.milestone_id;
 if a.id is null or a.status<>'prepared' or i.status<>'prepared' or i.payer_user_id<>p_user or not exists(select 1 from public.company_memberships where company_id=v_company and user_id=p_user and role='owner') or not exists(select 1 from public.wallet_connections where id=i.payer_connection_id and disconnected_at is null) then raise exception 'Payment signing permission changed';end if;
 if p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$' then raise exception 'Invalid transaction signature';end if;
 update public.payment_attempts set signature=p_signature,signed_base64=p_signed,status='registered',registered_at=now() where id=a.id;
 update public.payment_intents set status='signed' where id=i.id;end;$$;
create function public.cancel_unsigned_payment(p_intent uuid) returns void language plpgsql security definer set search_path='' as $$
 declare i public.payment_intents;v_company uuid;begin
 select * into i from public.payment_intents where id=p_intent for update;
 select p.company_id into v_company from public.paid_projects p join public.paid_milestones m on m.project_id=p.id where m.id=i.milestone_id;
 if i.id is null or not public.is_company_owner(v_company) or i.status<>'prepared' or exists(select 1 from public.payment_attempts where intent_id=i.id and signature is not null) then raise exception 'Only unsigned preparations can be cancelled';end if;
 update public.payment_attempts set status='cancelled' where intent_id=i.id and status='prepared';
 update public.payment_intents set status='cancelled' where id=i.id;
 perform public.refresh_payment_wallet_locks(i.id);end;$$;
create function public.record_payment_result(p_attempt uuid,p_status text,p_note text,p_finalized timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
 declare a public.payment_attempts;i public.payment_intents;v_project uuid;begin
 select i0.* into i from public.payment_intents i0 join public.payment_attempts a0 on a0.intent_id=i0.id where a0.id=p_attempt for update of i0;
 select * into a from public.payment_attempts where id=p_attempt for update;
 if a.id is null or a.signature is null then raise exception 'A registered signed attempt is required';end if;
 if a.status='paid' then return;end if;
 if a.status='failed' then return;end if;
 if p_status not in ('paid','pending','failed','needs_review') then raise exception 'Invalid verified outcome';end if;
 if p_status='paid' then
  if p_finalized is null or not exists(select 1 from public.paid_milestones m join public.paid_projects p on p.id=m.project_id join public.paid_project_offers o on o.id=i.offer_id where m.id=i.milestone_id and m.work_status='approved' and m.approval_id=i.approval_id and m.amount_units=i.amount_units and p.current_offer_id=o.id and o.response='accepted' and o.terms_hash=i.terms_hash) then raise exception 'Approved accepted terms do not match settlement';end if;
  insert into public.payment_receipts(intent_id,attempt_id,milestone_id,signature,amount_units,mint,payer_wallet,recipient_wallet,finalized_at) values(i.id,a.id,i.milestone_id,a.signature,i.amount_units,i.mint,i.payer_wallet,i.recipient_wallet,p_finalized);
 end if;
 update public.payment_attempts set status=p_status,status_note=left(p_note,2000),checked_at=now() where id=a.id;
 update public.payment_intents set status=p_status where id=i.id;
 select project_id into v_project from public.paid_milestones where id=i.milestone_id;
 if p_status='paid' and not exists(select 1 from public.paid_milestones m where m.project_id=v_project and not exists(select 1 from public.payment_receipts r where r.milestone_id=m.id)) then update public.paid_projects set status='completed' where id=v_project;end if;
 perform public.refresh_payment_wallet_locks(i.id);end;$$;
create function public.protect_payment_intent() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then raise exception 'Payment destination and obligation are immutable';end if;return new;end;$$;
create function public.protect_payment_attempt() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.intent_id,new.template_base64,new.blockhash,new.last_valid_block_height,new.created_at) is distinct from row(old.intent_id,old.template_base64,old.blockhash,old.last_valid_block_height,old.created_at) or (old.signature is not null and row(new.signature,new.signed_base64,new.registered_at) is distinct from row(old.signature,old.signed_base64,old.registered_at)) then raise exception 'Signed attempts cannot be rewritten';end if;return new;end;$$;
create trigger payment_intent_immutable before update on public.payment_intents for each row execute function public.protect_payment_intent();
create trigger payment_attempt_immutable before update on public.payment_attempts for each row execute function public.protect_payment_attempt();
create trigger payment_receipt_immutable before update or delete on public.payment_receipts for each row execute function public.freeze_approved_record();
create trigger payout_authorization_immutable before update or delete on public.paid_payout_authorizations for each row execute function public.freeze_approved_record();
alter table public.paid_payout_authorizations enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_receipts enable row level security;
create policy payout_read_parties on public.paid_payout_authorizations for select to authenticated using(public.paid_project_party(project_id));
create policy payment_intents_read on public.payment_intents for select to authenticated using(public.paid_milestone_party(milestone_id));
create policy payment_attempts_read on public.payment_attempts for select to authenticated using(exists(select 1 from public.payment_intents i where i.id=intent_id and public.paid_milestone_party(i.milestone_id)));
create policy payment_receipts_read on public.payment_receipts for select to authenticated using(public.paid_milestone_party(milestone_id));
revoke all on public.paid_payout_authorizations,public.payment_intents,public.payment_attempts,public.payment_receipts from anon,authenticated;
grant select on public.paid_payout_authorizations,public.payment_intents,public.payment_attempts,public.payment_receipts to authenticated,service_role;
revoke all on function public.refresh_payment_wallet_locks(uuid),public.store_payment_template(uuid,uuid,text,text,numeric),public.register_signed_payment(uuid,uuid,text,text),public.record_payment_result(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.store_payment_template(uuid,uuid,text,text,numeric),public.register_signed_payment(uuid,uuid,text,text),public.record_payment_result(uuid,text,text,timestamptz) to service_role;
revoke all on function public.authorize_project_payout(uuid,uuid),public.prepare_milestone_payment(uuid,uuid,text,text),public.cancel_unsigned_payment(uuid) from public,anon;
grant execute on function public.authorize_project_payout(uuid,uuid),public.prepare_milestone_payment(uuid,uuid,text,text),public.cancel_unsigned_payment(uuid) to authenticated;
commit;
