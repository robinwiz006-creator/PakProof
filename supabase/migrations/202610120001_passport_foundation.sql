begin;
alter table public.profiles add column passport_previewed_at timestamptz;
-- Apply once, AFTER the initial migration. No existing facts or proof hashes are rewritten.
alter table public.projects add column skills text[] not null default '{}';
alter table public.blockchain_proofs add column claim_version integer not null default 1 check (claim_version in (1,2));

create table public.achievement_claims (
 achievement_id uuid primary key references public.achievements(id),
 claim_type text not null default 'company_challenge' check(claim_type='company_challenge'),
 issuer_name text not null,
 legacy_eligible boolean not null default false,
 evidence_digest text not null check(evidence_digest ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
create table public.achievement_evidence (
 achievement_id uuid primary key references public.achievements(id),
 challenge_title text not null,
 challenge_description text not null,
 deliverables text not null,
 project_url text not null,
 github_url text not null,
 explanation text not null,
 digest_salt text not null,
 created_at timestamptz not null default now()
);
create table public.achievement_sharing (
 achievement_id uuid primary key references public.achievements(id),
 share_evidence boolean not null default false,
 project_id uuid references public.projects(id) on delete set null,
 updated_at timestamptz not null default now()
);
alter table public.achievement_claims enable row level security;
alter table public.achievement_evidence enable row level security;
alter table public.achievement_sharing enable row level security;
create policy claims_read on public.achievement_claims for select using(public.visible_achievement(achievement_id));
create policy sharing_read on public.achievement_sharing for select using(public.visible_achievement(achievement_id));
create policy sharing_insert on public.achievement_sharing for insert to authenticated with check(exists(select 1 from public.achievements a where a.id=achievement_id and a.talent_id=auth.uid()));
create policy sharing_update on public.achievement_sharing for update to authenticated using(exists(select 1 from public.achievements a where a.id=achievement_id and a.talent_id=auth.uid())) with check(exists(select 1 from public.achievements a where a.id=achievement_id and a.talent_id=auth.uid()));
create policy evidence_read on public.achievement_evidence for select using(exists(
 select 1 from public.achievements a where a.id=achievement_id and (
 a.talent_id=auth.uid() or public.is_company_member(a.company_id) or
 (public.public_talent(a.talent_id) and exists(select 1 from public.achievement_sharing sh where sh.achievement_id=a.id and sh.share_evidence))
 )));

create function public.check_achievement_sharing() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.project_id is not null and not exists(
  select 1 from public.projects p join public.achievements a on a.talent_id=p.talent_id
  where p.id=new.project_id and a.id=new.achievement_id
 ) then raise exception 'Choose a project owned by the achievement recipient'; end if;
 new.updated_at=now(); return new;
end; $$;
create trigger achievement_sharing_check before insert or update on public.achievement_sharing for each row execute function public.check_achievement_sharing();

create function public.freeze_approved_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Approved facts and evidence snapshots cannot be changed'; end; $$;
create trigger achievements_immutable before update or delete on public.achievements for each row execute function public.freeze_approved_record();
create trigger claims_immutable before update or delete on public.achievement_claims for each row execute function public.freeze_approved_record();
create trigger evidence_immutable before update or delete on public.achievement_evidence for each row execute function public.freeze_approved_record();

create function public.snapshot_achievement(p_id uuid,p_legacy boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare ch public.challenges; a public.achievements; s public.challenge_submissions; c public.companies; salt text; ev_digest text;
begin
 select * into a from public.achievements where id=p_id;
 select * into s from public.challenge_submissions where id=a.submission_id;
 select * into c from public.companies where id=a.company_id;
 select * into ch from public.challenges where id=a.challenge_id;
 if a.id is null or s.id is null or ch.id is null or c.id is null or s.status is distinct from 'approved' or s.talent_id is distinct from a.talent_id or s.challenge_id is distinct from a.challenge_id or ch.company_id is distinct from a.company_id then
  raise exception 'Achievement snapshot needs matching approved work';
 end if;
 if exists(select 1 from public.achievement_claims where achievement_id=a.id) then return; end if;
 salt=gen_random_uuid()::text;
 -- SQL JSONB text is the documented evidence encoding; salt prevents guessing private URLs.
 ev_digest=encode(sha256(convert_to(jsonb_build_array(salt,a.title,ch.description,ch.deliverables,s.project_url,s.github_url,s.explanation)::text,'UTF8')),'hex');
 insert into public.achievement_claims(achievement_id,issuer_name,evidence_digest,legacy_eligible) values(a.id,c.name,ev_digest,p_legacy);
 insert into public.achievement_evidence(achievement_id,challenge_title,challenge_description,deliverables,project_url,github_url,explanation,digest_salt)
 values(a.id,a.title,ch.description,ch.deliverables,s.project_url,s.github_url,s.explanation,salt);
end; $$;
revoke all on function public.snapshot_achievement(uuid,boolean) from public,anon,authenticated;
create function public.snapshot_new_achievement() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.snapshot_achievement(new.id); return new; end; $$;
create trigger achievement_snapshot after insert on public.achievements for each row execute function public.snapshot_new_achievement();
-- Backfill NEW snapshot rows only. Existing achievements, submissions and v1 proofs stay unchanged.
do $$ declare r record; begin for r in select id from public.achievements loop perform public.snapshot_achievement(r.id,true); end loop; end; $$;

grant select on public.achievement_claims,public.achievement_evidence,public.achievement_sharing to anon,authenticated;
grant insert,update on public.achievement_sharing to authenticated;
grant all on public.achievement_claims,public.achievement_evidence,public.achievement_sharing to service_role;
-- Portfolio privacy means unrelated private projects are no longer exposed to challenge reviewers.
alter policy projects_read on public.projects using(talent_id=auth.uid() or public.public_talent(talent_id));
create function public.freeze_approved_submission() returns trigger language plpgsql set search_path='' as $$
begin if old.status='approved' then raise exception 'Approved submissions cannot be changed'; end if; return new; end; $$;
create trigger approved_submission_immutable before update on public.challenge_submissions for each row execute function public.freeze_approved_submission();
commit;
