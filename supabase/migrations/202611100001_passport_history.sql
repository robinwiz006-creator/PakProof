begin;
create table public.passport_history (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 kind text not null check (kind in ('education','employment')),
 organization text not null check(length(trim(organization)) between 1 and 160),
 title text not null check(length(trim(title)) between 1 and 160),
 field text not null default '' check(length(field)<=160),
 start_date date not null,
 end_date date,
 ongoing boolean not null default false,
 description text not null default '' check(length(description)<=2000),
 is_public boolean not null default false,
 created_at timestamptz not null default now(),
 check ((ongoing and end_date is null) or (not ongoing and end_date is not null and end_date>=start_date))
);
create index passport_history_owner on public.passport_history(owner_id,start_date desc);
alter table public.passport_history enable row level security;
revoke all on public.passport_history from public,anon,authenticated;
grant select on public.passport_history to anon,authenticated;
grant insert,update,delete on public.passport_history to authenticated;
create policy history_read on public.passport_history for select using (
 owner_id=auth.uid() or (is_public and exists(select 1 from public.profiles p where p.id=owner_id and p.is_public))
);
create policy history_insert on public.passport_history for insert to authenticated with check(owner_id=auth.uid());
create policy history_update on public.passport_history for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy history_delete on public.passport_history for delete to authenticated using(owner_id=auth.uid());
commit;
