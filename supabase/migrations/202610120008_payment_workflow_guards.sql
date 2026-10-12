begin;
-- Selecting one worker becomes final only on acceptance; other applicants then see a clear result.
create function public.finalize_paid_applications() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='active' and old.status='offered' then
  update public.paid_project_applications set status='rejected' where project_id=new.id and worker_id<>new.worker_id and status='applied';
 end if;return new;end;$$;
create trigger paid_worker_accepted after update on public.paid_projects for each row execute function public.finalize_paid_applications();
-- Either party can release an unsigned/unregistered preparation. A registered signature can never be cancelled here.
create or replace function public.cancel_unsigned_payment(p_intent uuid) returns void language plpgsql security definer set search_path='' as $$
 declare i public.payment_intents;p public.paid_projects;begin
 select * into i from public.payment_intents where id=p_intent for update;
 select p0.* into p from public.paid_projects p0 join public.paid_milestones m on m.project_id=p0.id where m.id=i.milestone_id;
 if auth.uid() is null or i.id is null or not (public.is_company_owner(p.company_id) or p.worker_id=auth.uid()) or i.status<>'prepared' or exists(select 1 from public.payment_attempts where intent_id=i.id and signature is not null) then raise exception 'Only unsigned preparations may be cancelled by a project party';end if;
 update public.payment_attempts set status='cancelled' where intent_id=i.id and status='prepared';
 update public.payment_intents set status='cancelled' where id=i.id;
 perform public.refresh_payment_wallet_locks(i.id);end;$$;
revoke all on function public.cancel_unsigned_payment(uuid) from public,anon;
grant execute on function public.cancel_unsigned_payment(uuid) to authenticated;
commit;
