do $$ declare r record; data jsonb; additions text[]; begin
 for r in select * from public.test_preservation_baseline loop
 additions=case r.name when 'profiles' then array['passport_previewed_at'] when 'projects' then array['skills'] when 'blockchain_proofs' then array['claim_version'] else array[]::text[] end;
 execute format('select coalesce(jsonb_agg(to_jsonb(t)-%L::text[] order by (to_jsonb(t)-%L::text[])::text),''[]''::jsonb) from public.%I t',additions,additions,r.name) into data;
 if data<>(select jsonb_agg(value-additions order by (value-additions)::text) from jsonb_array_elements(r.data)) then raise exception 'Existing data changed in %',r.name;end if;
 end loop;
 if (select claim_version from public.blockchain_proofs limit 1)<>1 then raise exception 'Historical proof version changed';end if;
 if not (select legacy_eligible from public.achievement_claims limit 1) then raise exception 'Historical transaction recovery disabled';end if;
 if exists(select 1 from public.achievement_sharing where share_evidence) then raise exception 'Migration published evidence';end if;
end $$;
-- Versioned snapshot backfill must preserve frozen original content.
do $$ begin if (select project_url from public.achievement_evidence limit 1)<>'https://example.com/approved' then raise exception 'Wrong snapshot evidence';end if;end $$;
\echo 'PASS: all existing table rows and v1 proof fields preserved; snapshots remain private'
