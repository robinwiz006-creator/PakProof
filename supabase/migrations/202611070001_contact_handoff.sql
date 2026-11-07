-- Private, bounded follow-up; no public messaging or contact-data disclosure.
begin;
alter table public.contact_requests drop constraint contact_requests_status_check;
alter table public.contact_requests add constraint contact_requests_status_check check(status in ('pending','accepted','declined','closed','withdrawn'));
create table public.contact_followups (
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.contact_requests(id),
 created_by uuid not null references auth.users(id),sender text not null check(sender in ('candidate','organization')),
 topic text not null check(topic in ('next_steps','question','response')),
 body text not null check(length(trim(body)) between 10 and 1000),client_nonce uuid not null,
 created_at timestamptz not null default clock_timestamp(),unique(request_id,client_nonce)
);
create index contact_followups_time on public.contact_followups(request_id,created_at,id);
create index contact_followups_actor_time on public.contact_followups(created_by,created_at);
alter table public.contact_followups enable row level security;
create policy followup_staff_read on public.contact_followups for select to authenticated using(exists(select 1 from public.contact_requests r where r.id=request_id and public.is_company_member(r.company_id) and public.contactable_candidate(r.candidate_id)));
revoke all on public.contact_followups from public,anon,authenticated,service_role;
grant select on public.contact_followups to authenticated,service_role;
create trigger contact_followups_immutable before update or delete on public.contact_followups for each row execute function public.freeze_approved_record();
create view public.visible_contact_followups with(security_barrier=true,security_invoker=false) as
 select m.id,m.request_id,m.sender,m.topic,m.body,m.created_at from public.contact_followups m join public.contact_requests r on r.id=m.request_id
 where r.candidate_id=auth.uid() or (public.is_company_member(r.company_id) and public.contactable_candidate(r.candidate_id));
revoke all on public.visible_contact_followups from public,anon,authenticated,service_role;
grant select on public.visible_contact_followups to authenticated,service_role;
create function public.send_contact_followup(p_request uuid,p_topic text,p_body text,p_nonce uuid) returns uuid language plpgsql security definer set search_path='' as $$
 declare r public.contact_requests;m public.contact_followups;side text;v uuid;candidate uuid;company uuid;begin
 if auth.uid() is null then raise exception 'Sign in to continue';end if;
 select candidate_id,company_id into candidate,company from public.contact_requests where id=p_request;
 if candidate is null or (candidate<>auth.uid() and not public.is_company_member(company)) then raise exception 'Contact request access required';end if;
 -- Same lock ordering as request creation: profiles, company, then request.
 perform 1 from public.profiles where id in (auth.uid(),candidate) order by id for update;
 perform 1 from public.companies where id=company for update;
 select * into r from public.contact_requests where id=p_request for update;
 if r.status<>'accepted' or not public.contactable_candidate(r.candidate_id) then raise exception 'Contact is not open. Acceptance and current contact consent are required';end if;
 if p_topic is null or p_topic not in ('next_steps','question','response') or p_body is null or length(trim(p_body)) not between 10 and 1000 or p_nonce is null then raise exception 'Choose a topic and write 10 to 1000 characters';end if;
 side=case when r.candidate_id=auth.uid() then 'candidate' else 'organization' end;
 select * into m from public.contact_followups where request_id=r.id and client_nonce=p_nonce;
 if m.id is not null then
 if m.created_by<>auth.uid() or m.body<>trim(p_body) or m.topic<>p_topic then raise exception 'This submission reference is already used';end if;return m.id;end if;
 if (select count(*) from public.contact_followups where request_id=r.id and sender=side)>=6 then raise exception 'Six follow-ups per side reached. Use the agreed next step or close contact';end if;
 if (select count(*) from public.contact_followups where created_by=auth.uid() and created_at>now()-interval '24 hours')>=20
 or (side='organization' and (select count(*) from public.contact_followups f join public.contact_requests cr on cr.id=f.request_id where cr.company_id=r.company_id and f.sender='organization' and f.created_at>now()-interval '24 hours')>=40)
 then raise exception 'Daily follow-up limit reached. Try later';end if;
 insert into public.contact_followups(request_id,created_by,sender,topic,body,client_nonce) values(r.id,auth.uid(),side,p_topic,trim(p_body),p_nonce) returning id into v;return v;end;$$;
create function public.close_contact_request(p_request uuid,p_withdraw boolean default false) returns void language plpgsql security definer set search_path='' as $$
 declare r public.contact_requests;begin
 select * into r from public.contact_requests where id=p_request for update;
 if r.id is null or auth.uid() is null or p_withdraw is null then raise exception 'Contact request access required';end if;
 if p_withdraw then
  if not public.is_company_member(r.company_id) then raise exception 'Company membership required';end if;
  if r.status='withdrawn' then return;end if;
  if r.status not in ('pending','accepted') then raise exception 'This request is already ended';end if;
  update public.contact_requests set status='withdrawn',responded_at=clock_timestamp() where id=r.id;
 else
  if r.candidate_id<>auth.uid() then raise exception 'Only the candidate can close contact';end if;
  if r.status='closed' then return;end if;
  if r.status<>'accepted' then raise exception 'Only accepted contact can be closed';end if;
  update public.contact_requests set status='closed',responded_at=clock_timestamp() where id=r.id;
 end if;end;$$;
-- Preserve old withdrawal-as-decline semantics; ended channels cannot reopen.
create or replace function public.respond_contact_request(p_request uuid,p_decision text) returns void language plpgsql security definer set search_path='' as $$
 declare r public.contact_requests;begin
 select * into r from public.contact_requests where id=p_request for update;
 if r.id is null or auth.uid() is null or r.candidate_id<>auth.uid() or p_decision is null or p_decision not in ('accepted','declined') then raise exception 'Only the recipient can accept or decline';end if;
 if r.status=p_decision then return;end if;
 if r.status not in ('pending','accepted') then raise exception 'This contact request has ended';end if;
 if p_decision='accepted' and not public.contactable_candidate(r.candidate_id) then raise exception 'Enable discovery and contact requests before accepting';end if;
 update public.contact_requests set status=p_decision,responded_at=now() where id=r.id;end;$$;
create function public.contact_request_opportunity(p_request uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare r public.contact_requests;t text;s text;d date;k text;v uuid;begin
 select * into r from public.contact_requests where id=p_request and (candidate_id=auth.uid() or (public.is_company_member(company_id) and public.contactable_candidate(candidate_id)));
 if r.id is null then raise exception 'Contact request access required';end if;
 if r.challenge_id is not null then
 k='challenge';v=r.challenge_id;select title,status,deadline into t,s,d from public.challenges where id=v and company_id=r.company_id;
 elsif r.paid_project_id is not null then
 k='paid-project';v=r.paid_project_id;select title,status,deadline into t,s,d from public.paid_projects where id=v and company_id=r.company_id;
 else return null;end if;
 if s is null or s in ('draft','withdrawn','cancelled') then return jsonb_build_object('kind',k,'status','Unavailable','title',null,'href',null,'deadline',null);end if;
 return jsonb_build_object('kind',k,'title',case when s='closed' then null else t end,'deadline',d,'status',case when s='published' and d>=current_date then 'Open' else 'Closed' end,'href',case when s='published' and d>=current_date then case when k='challenge' then '/challenges/' else '/paid-projects/' end||v::text end);
 end;$$;
revoke all on function public.send_contact_followup(uuid,text,text,uuid),public.close_contact_request(uuid,boolean),public.contact_request_opportunity(uuid) from public,anon,authenticated,service_role;
grant execute on function public.send_contact_followup(uuid,text,text,uuid),public.close_contact_request(uuid,boolean),public.contact_request_opportunity(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
