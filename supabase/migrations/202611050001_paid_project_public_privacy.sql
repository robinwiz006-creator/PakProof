-- Forward-only privacy boundary. No records or historical claims are changed.
begin;

-- Do not silently combine this boundary with unknown permissive hosted policies.
do $$ begin
 if exists (
  select 1 from pg_policies where schemaname='public'
  and tablename in ('paid_projects','paid_milestones')
  and permissive='PERMISSIVE' and cmd in ('SELECT','ALL')
  and policyname <> case tablename when 'paid_projects' then 'paid_projects_read'
                                  else 'paid_milestones_read' end
 ) then raise exception 'Unexpected paid-project read policies: review before applying this migration'; end if;
end $$;

-- These intentionally owner-executed views expose only fixed public opportunity
-- fields. The trusted migration owner must own them; security_invoker views would
-- prevent unrelated visitors from discovering opportunities under the party RLS.
create view public.public_paid_projects
with (security_barrier = true, security_invoker = false) as
select id, company_id, title, description, requirements, skills, deadline,
       budget_units, status, created_at
from public.paid_projects
where status in ('published','offered','active','completed');

create view public.public_paid_milestones
with (security_barrier = true, security_invoker = false) as
select m.id, m.project_id, m.position, m.title, m.deliverables, m.deadline,
       m.amount_units
from public.paid_milestones m
where exists (
 select 1 from public.paid_projects p where p.id = m.project_id
 and p.status in ('published','offered','active','completed')
);

revoke all on public.public_paid_projects, public.public_paid_milestones
from public, anon, authenticated, service_role;
grant select on public.public_paid_projects, public.public_paid_milestones
 to anon, authenticated, service_role;

-- Raw operational records are readable only by company members and the selected
-- worker. Existing SECURITY DEFINER workflow functions keep their own guards.
alter policy paid_projects_read on public.paid_projects
 to authenticated using (public.paid_project_party(id));
alter policy paid_milestones_read on public.paid_milestones
 to authenticated using (public.paid_milestone_party(id));
revoke all on public.paid_projects, public.paid_milestones from anon, public;

-- Table REVOKE does not remove custom column grants. Abort rather than leave
-- an anonymous bypass if the hosted installation has drifted from migrations.
do $$ begin
 if exists (
  select 1 from pg_attribute a where a.attrelid in
   ('public.paid_projects'::regclass,'public.paid_milestones'::regclass)
  and a.attnum>0 and not a.attisdropped
  and has_column_privilege('anon',a.attrelid,a.attnum,'SELECT')
 ) then raise exception 'Unexpected anonymous column grants: review and revoke explicitly before retrying'; end if;
end $$;

notify pgrst, 'reload schema';
commit;
