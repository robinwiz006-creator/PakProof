begin;
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 full_name text not null check(length(full_name) between 2 and 100), headline text not null default '',
 university text not null default '', location text not null default '', bio text not null default '',
 skills text[] not null default '{}', is_public boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.companies (id uuid primary key default gen_random_uuid(), name text not null, description text not null, website text not null default '', location text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.company_memberships (company_id uuid references public.companies(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, role text not null check(role in ('owner','reviewer')), created_at timestamptz not null default now(), primary key(company_id,user_id));
create table public.skills (id uuid primary key default gen_random_uuid(), name text unique not null);
insert into public.skills(name) values ('React'),('TypeScript'),('Python'),('Data analysis'),('Product design'),('Accessibility'),('Communication');
create table public.projects (id uuid primary key default gen_random_uuid(), talent_id uuid not null references public.profiles(id) on delete cascade, title text not null, description text not null, github_url text not null default '', demo_url text not null default '', evidence_url text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (github_url <> '' or demo_url <> '' or evidence_url <> ''), check (github_url='' or github_url ~ '^https?://'), check(demo_url='' or demo_url ~ '^https?://'), check(evidence_url='' or evidence_url ~ '^https?://'));
create table public.challenges (id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), title text not null, description text not null, skills text[] not null default '{}', difficulty text not null check(difficulty in ('Beginner','Intermediate','Advanced')), deadline date not null, deliverables text not null, status text not null default 'published' check(status in ('published','closed')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.challenge_submissions (id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.challenges(id), talent_id uuid not null references public.profiles(id), project_url text not null default '', github_url text not null default '', explanation text not null check(length(explanation)>=30), status text not null default 'pending' check(status in ('pending','approved','needs_improvement')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(challenge_id,talent_id), check(project_url<>'' or github_url<>''), check(project_url='' or project_url ~ '^https?://'), check(github_url='' or github_url ~ '^https?://'));
create table public.submission_reviews (id uuid primary key default gen_random_uuid(), submission_id uuid not null references public.challenge_submissions(id), reviewer_id uuid not null references auth.users(id), decision text not null check(decision in ('approved','needs_improvement')), feedback text not null check(length(feedback)>=10), created_at timestamptz not null default now());
create table public.achievements (id uuid primary key default gen_random_uuid(), submission_id uuid not null unique references public.challenge_submissions(id), challenge_id uuid not null references public.challenges(id), talent_id uuid not null references public.profiles(id), company_id uuid not null references public.companies(id), title text not null, issued_at timestamptz not null default now());
create table public.blockchain_proofs (id uuid primary key default gen_random_uuid(), achievement_id uuid not null unique references public.achievements(id), signature text not null unique, record_hash text not null check(record_hash ~ '^[a-f0-9]{64}$'), issuer_wallet text not null, network text not null default 'devnet' check(network='devnet'), anchored_at timestamptz not null, created_at timestamptz not null default now());
create index on public.challenges(company_id);
create index on public.projects(talent_id);
create index on public.challenge_submissions(talent_id);
create index on public.challenge_submissions(challenge_id,status);
create index on public.achievements(talent_id);
create index on public.submission_reviews(submission_id);

create function public.is_company_member(p_company_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid()); $$;
create function public.is_company_owner(p_company_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.company_memberships m where m.company_id=p_company_id and m.user_id=auth.uid() and m.role='owner'); $$;
create function public.owns_submission(p_submission_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.challenge_submissions s where s.id=p_submission_id and s.talent_id=auth.uid()); $$;
create function public.reviews_submission(p_submission_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.challenge_submissions s join public.challenges c on c.id=s.challenge_id where s.id=p_submission_id and public.is_company_member(c.company_id)); $$;
create function public.can_review_profile(p_talent_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.challenge_submissions s join public.challenges c on c.id=s.challenge_id where s.talent_id=p_talent_id and public.is_company_member(c.company_id)); $$;
create function public.public_talent(p_talent_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.profiles p where p.id=p_talent_id and p.is_public); $$;
create function public.visible_achievement(p_achievement_id uuid) returns boolean language sql stable security definer set search_path = '' as $$ select exists(select 1 from public.achievements a where a.id=p_achievement_id and (public.public_talent(a.talent_id) or a.talent_id=auth.uid() or public.is_company_member(a.company_id))); $$;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_memberships enable row level security;
alter table public.skills enable row level security;
alter table public.projects enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_submissions enable row level security;
alter table public.submission_reviews enable row level security;
alter table public.achievements enable row level security;
alter table public.blockchain_proofs enable row level security;
create policy profiles_read on public.profiles for select using(is_public or id=auth.uid() or public.can_review_profile(id));
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy companies_read on public.companies for select using(true);
create policy companies_update on public.companies for update to authenticated using(public.is_company_owner(id)) with check(public.is_company_owner(id));
create policy memberships_read on public.company_memberships for select to authenticated using(user_id=auth.uid());
create policy skills_read on public.skills for select using(true);
create policy projects_read on public.projects for select using(talent_id=auth.uid() or public.public_talent(talent_id) or public.can_review_profile(talent_id));
create policy projects_insert on public.projects for insert to authenticated with check(talent_id=auth.uid());
create policy projects_update on public.projects for update to authenticated using(talent_id=auth.uid()) with check(talent_id=auth.uid());
create policy projects_delete on public.projects for delete to authenticated using(talent_id=auth.uid());
create policy challenges_read on public.challenges for select using(status='published' or public.is_company_member(company_id) or exists(select 1 from public.challenge_submissions s where s.challenge_id=challenges.id and s.talent_id=auth.uid()));
create policy challenges_insert on public.challenges for insert to authenticated with check(public.is_company_member(company_id));
create policy challenges_update on public.challenges for update to authenticated using(public.is_company_member(company_id)) with check(public.is_company_member(company_id));
create policy submissions_read on public.challenge_submissions for select to authenticated using(talent_id=auth.uid() or public.reviews_submission(id));
create policy reviews_read on public.submission_reviews for select to authenticated using(public.owns_submission(submission_id) or public.reviews_submission(submission_id));
create policy achievements_read on public.achievements for select using(public.public_talent(talent_id) or talent_id=auth.uid() or public.is_company_member(company_id));
create policy proofs_read on public.blockchain_proofs for select using(public.visible_achievement(achievement_id));
-- No client write policies for memberships, submissions, reviews, achievements, or proofs.
-- Protected transitions are performed by the functions below. Proofs are server-written after RPC verification.

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger companies_updated before update on public.companies for each row execute function public.touch_updated_at();
create trigger projects_updated before update on public.projects for each row execute function public.touch_updated_at();
create function public.keep_challenge_company() returns trigger language plpgsql set search_path = '' as $$ begin if new.company_id<>old.company_id then raise exception 'A challenge cannot be moved to another company';end if;return new;end; $$;
create trigger challenges_company_immutable before update on public.challenges for each row execute function public.keep_challenge_company();
create trigger challenges_updated before update on public.challenges for each row execute function public.touch_updated_at();
create trigger submissions_updated before update on public.challenge_submissions for each row execute function public.touch_updated_at();
create function public.new_user_profile() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles(id,slug,full_name) values(new.id,'talent-'||replace(new.id::text,'-',''),left(coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'New member'),100)); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_user_profile();

create function public.create_company(p_name text,p_description text,p_website text,p_location text) returns uuid language plpgsql security definer set search_path = '' as $$ declare v_id uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(p_name)) not between 2 and 120 or length(p_description)<20 then raise exception 'Invalid company profile'; end if;
 if p_website<>'' and p_website !~ '^https?://' then raise exception 'Invalid website URL'; end if;
 insert into public.companies(name,description,website,location) values(p_name,p_description,p_website,p_location) returning id into v_id;
 insert into public.company_memberships(company_id,user_id,role) values(v_id,auth.uid(),'owner');return v_id;
end; $$;

create function public.submit_work(p_challenge_id uuid,p_project_url text,p_github_url text,p_explanation text) returns uuid language plpgsql security definer set search_path = '' as $$ declare c public.challenges; s public.challenge_submissions; v_id uuid; begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into c from public.challenges where id=p_challenge_id for share;
 if c.id is null or c.status<>'published' or ((c.deadline+1)::timestamp at time zone 'UTC')<=now() then raise exception 'Challenge is closed';end if;
 if public.is_company_member(c.company_id) then raise exception 'Company members cannot submit to their own challenge'; end if;
 select * into s from public.challenge_submissions where challenge_id=p_challenge_id and talent_id=auth.uid() for update;
 if s.id is not null then
  if s.status<>'needs_improvement' then raise exception 'This submission cannot be resubmitted';end if;
  update public.challenge_submissions set project_url=p_project_url,github_url=p_github_url,explanation=p_explanation,status='pending' where id=s.id returning id into v_id;
 else
  insert into public.challenge_submissions(challenge_id,talent_id,project_url,github_url,explanation) values(p_challenge_id,auth.uid(),p_project_url,p_github_url,p_explanation) returning id into v_id;
 end if;return v_id;
end; $$;

create function public.review_submission(p_submission_id uuid,p_decision text,p_feedback text) returns uuid language plpgsql security definer set search_path = '' as $$ declare s public.challenge_submissions; c public.challenges; v_achievement uuid; begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into s from public.challenge_submissions where id=p_submission_id for update;
 select * into c from public.challenges where id=s.challenge_id;
 if s.id is null or not public.is_company_member(c.company_id) or s.talent_id=auth.uid() then raise exception 'You cannot review this submission';end if;
 if s.status<>'pending' then raise exception 'Only pending submissions can be reviewed';end if;
 if p_decision not in ('approved','needs_improvement') or length(trim(p_feedback))<10 then raise exception 'Decision and feedback are required';end if;
 insert into public.submission_reviews(submission_id,reviewer_id,decision,feedback) values(s.id,auth.uid(),p_decision,p_feedback);
 update public.challenge_submissions set status=p_decision where id=s.id;
 if p_decision='approved' then
  insert into public.achievements(submission_id,challenge_id,talent_id,company_id,title) values(s.id,c.id,s.talent_id,c.company_id,c.title) returning id into v_achievement;
 end if;return v_achievement;
end; $$;
revoke all on function public.create_company(text,text,text,text) from public;
revoke all on function public.submit_work(uuid,text,text,text) from public;
revoke all on function public.review_submission(uuid,text,text) from public;
grant execute on function public.create_company(text,text,text,text) to authenticated;
grant execute on function public.submit_work(uuid,text,text,text) to authenticated;
grant execute on function public.review_submission(uuid,text,text) to authenticated;
-- Explicit grants; RLS still restricts rows and transitions.
grant usage on schema public to anon,authenticated;
grant select on all tables in schema public to anon,authenticated;
grant update on public.profiles,public.companies,public.projects,public.challenges to authenticated;
grant insert on public.projects,public.challenges to authenticated;
grant delete on public.projects to authenticated;
grant all on all tables in schema public to service_role;
commit;
