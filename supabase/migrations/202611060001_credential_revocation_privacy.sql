-- Forward-only public/private revocation boundary. No event or claim is rewritten.
begin;

-- Unknown permissive policies could reopen the raw staff audit. Fail closed.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public'
 and tablename='credential_events' and policyname='credential_events_read' and cmd='SELECT') then
  raise exception 'Expected credential event SELECT policy missing: review before applying';
 end if;
 if exists(select 1 from pg_policies where schemaname='public'
 and tablename='credential_events' and permissive='PERMISSIVE'
 and cmd in ('SELECT','ALL') and policyname<>'credential_events_read') then
  raise exception 'Unexpected credential event read policies: review before applying';
 end if;
end $$;

-- Owner-executed, fixed projection: preserve publication/recipient/issuer consent
-- rules without exposing event IDs, staff IDs or future operational columns.
-- reason is the EXISTING PUBLIC explanation, not a private investigation note.
create view public.public_credential_events
with(security_barrier=true,security_invoker=false) as
 select credential_id,event_type,reason,created_at
 from public.credential_events
 where event_type='revoked' and public.visible_credential(credential_id);
revoke all on public.public_credential_events from public,anon,authenticated,service_role;
grant select on public.public_credential_events to anon,authenticated,service_role;

-- Full audit attribution is for staff and platform administrators, including
-- private/unpublished events. Recipients read their own history via the view.
alter policy credential_events_read on public.credential_events to authenticated
 using(public.is_platform_administrator() or exists(
  select 1 from public.credentials c where c.id=credential_id
  and public.organization_member(c.organization_id)
 ));
revoke all on public.credential_events from public,anon,authenticated;
grant select on public.credential_events to authenticated;
-- Existing service-role permissions and immutable-event trigger remain intact.

-- Table REVOKE does not revoke custom column grants or inherited privileges.
-- Abort rather than silently retain a hosted anonymous access path.
do $$ begin
 if exists(select 1 from pg_attribute a where a.attrelid='public.credential_events'::regclass
 and a.attnum>0 and not a.attisdropped
 and has_column_privilege('anon',a.attrelid,a.attnum,'SELECT')) then
  raise exception 'Unexpected anonymous credential event column grants: review and revoke explicitly before retrying';
 end if;
end $$;

notify pgrst,'reload schema';
commit;
