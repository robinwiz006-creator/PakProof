do $$begin
 if (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from public.contact_requests r)<>(select fingerprint from test_handoff_snapshot) then raise exception 'Historical contact request changed';end if;
 if (select count(distinct status) from public.contact_requests)<>3 or exists(select 1 from public.contact_followups) then raise exception 'Legacy state lost or invented notes';end if;
end$$;
set role authenticated;
set request.jwt.claim.sub='f3000000-0000-4000-8000-000000000003';
select public.send_contact_followup((select id from public.visible_contact_requests where candidate_id=auth.uid()),'next_steps','An existing accepted request can now continue safely.',gen_random_uuid());
set request.jwt.claim.sub='f3000000-0000-4000-8000-000000000004';
do $$begin
 begin perform public.send_contact_followup((select id from public.visible_contact_requests where candidate_id=auth.uid()),'question','A previously declined request cannot continue.',gen_random_uuid());raise exception 'Legacy declined reopened';exception when raise_exception then if sqlerrm='Legacy declined reopened' then raise;end if;end;
end$$;
reset role;
\echo 'PASS: populated pending/accepted/declined requests unchanged; legacy accepted handoff works and declined remains closed'
