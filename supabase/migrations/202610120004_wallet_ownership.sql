begin;
create table public.wallet_ownership_challenges (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 wallet_address text not null,purpose text not null check(purpose in ('account','credential_issuer','company_payer')),
 organization_id uuid references public.organizations(id),message text not null,
 expires_at timestamptz not null,consumed_at timestamptz,
 check((purpose='account')=(organization_id is null))
);
create table public.wallet_connections (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),wallet_address text not null,
 purpose text not null check(purpose in ('account','credential_issuer','company_payer')),organization_id uuid references public.organizations(id),
 ownership_challenge_id uuid not null unique references public.wallet_ownership_challenges(id),ownership_signature text not null,
 created_at timestamptz not null default now(),disconnected_at timestamptz,lock_reason text,
 check((purpose='account')=(organization_id is null))
);
create unique index wallet_connections_active_scope on public.wallet_connections(user_id,purpose,coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)) where disconnected_at is null;
create unique index wallet_connections_active_address on public.wallet_connections(wallet_address,purpose,coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)) where disconnected_at is null;
alter table public.wallet_ownership_challenges enable row level security;
alter table public.wallet_connections enable row level security;
create policy wallets_read_own on public.wallet_connections for select to authenticated using(user_id=auth.uid());
revoke all on public.wallet_ownership_challenges,public.wallet_connections from anon,authenticated;
grant select on public.wallet_connections to authenticated;
grant select,insert,update on public.wallet_ownership_challenges to service_role;
grant select on public.wallet_connections to service_role;
create function public.record_wallet_connection(p_challenge uuid,p_user uuid,p_signature text) returns uuid language plpgsql security definer set search_path='' as $$
 declare c public.wallet_ownership_challenges;v_id uuid;begin
 select * into c from public.wallet_ownership_challenges where id=p_challenge for update;
 if c.id is null or c.user_id<>p_user or c.consumed_at is not null or c.expires_at<=now() then raise exception 'Ownership challenge expired or already used';end if;
 if c.purpose<>'account' and not exists(select 1 from public.organizations o join public.company_memberships m on m.company_id=o.company_id where o.id=c.organization_id and m.user_id=p_user and (c.purpose<>'company_payer' or m.role='owner') and (c.purpose<>'credential_issuer' or o.issuer_status='authorized')) then raise exception 'Wallet purpose permission required';end if;
 insert into public.wallet_connections(user_id,wallet_address,purpose,organization_id,ownership_challenge_id,ownership_signature) values(c.user_id,c.wallet_address,c.purpose,c.organization_id,c.id,p_signature) returning id into v_id;
 update public.wallet_ownership_challenges set consumed_at=now() where id=c.id;
 return v_id;end; $$;
create function public.disconnect_wallet(p_connection uuid) returns void language plpgsql security definer set search_path='' as $$
 declare c public.wallet_connections;begin
 select * into c from public.wallet_connections where id=p_connection for update;
 if auth.uid() is null or c.id is null or c.user_id<>auth.uid() then raise exception 'Only the owner can disconnect';end if;
 if c.lock_reason is not null then raise exception 'This wallet is locked while a payment is unresolved';end if;
 update public.wallet_connections set disconnected_at=coalesce(disconnected_at,now()) where id=c.id;
 end; $$;
revoke all on function public.record_wallet_connection(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.record_wallet_connection(uuid,uuid,text) to service_role;
revoke all on function public.disconnect_wallet(uuid) from public,anon;
grant execute on function public.disconnect_wallet(uuid) to authenticated;
commit;
