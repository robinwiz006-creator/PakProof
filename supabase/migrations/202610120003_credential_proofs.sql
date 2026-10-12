-- General credentials use a separate v3 claim. No changes to historical achievement proofs.
begin;
create table public.credential_proofs (
 credential_id uuid primary key references public.credentials(id), claim_version integer not null default 3 check(claim_version=3),
 signature text not null unique, record_hash text not null check(record_hash ~ '^[0-9a-f]{64}$'),
 issuer_wallet text not null, network text not null default 'devnet' check(network='devnet'),
 anchored_at timestamptz not null, created_at timestamptz not null default now()
);
alter table public.credential_proofs enable row level security;
create policy credential_proofs_read on public.credential_proofs for select using(public.visible_credential(credential_id));
create trigger credential_proofs_immutable before update or delete on public.credential_proofs for each row execute function public.freeze_approved_record();
revoke all on public.credential_proofs from anon,authenticated;
grant select on public.credential_proofs to anon,authenticated;
grant select on public.credential_proofs to service_role;
-- Service-only settlement boundary. The server must first verify the actual finalized transaction.
create function public.record_credential_proof(p_credential uuid,p_signature text,p_hash text,p_wallet text,p_anchored timestamptz) returns void language plpgsql security definer set search_path='' as $$
 declare c public.credentials;begin
 select * into c from public.credentials where id=p_credential for share;
 if c.id is null or not exists(select 1 from public.organizations where id=c.organization_id and issuer_status='authorized')
 or exists(select 1 from public.credential_events where credential_id=c.id)
 or not exists(select 1 from public.credential_preferences where credential_id=c.id and acceptance='accepted')
 or c.issue_date>current_date
 or (c.expiry_date is not null and c.expiry_date<current_date)
 then raise exception 'Only accepted, current credentials from authorized issuers may be anchored';end if;
 if p_signature !~ '^[1-9A-HJ-NP-Za-km-z]{80,90}$' or p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' or p_anchored>now()+interval '1 minute' then raise exception 'Invalid proof receipt';end if;
 insert into public.credential_proofs(credential_id,signature,record_hash,issuer_wallet,anchored_at) values(c.id,p_signature,p_hash,p_wallet,p_anchored);
 end; $$;
revoke all on function public.record_credential_proof(uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.record_credential_proof(uuid,text,text,text,timestamptz) to service_role;
commit;
