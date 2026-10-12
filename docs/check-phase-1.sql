-- READ ONLY: run BEFORE the new migration. Never rerun the initial migration.
select 'new relation' as check_type, v.name,
       to_regclass('public.'||v.name) is not null as already_exists
from (values ('achievement_claims'),('achievement_evidence'),('achievement_sharing')) v(name)
union all
select 'new column',table_name||'.'||column_name,true
from information_schema.columns where table_schema='public' and
 (table_name,column_name) in (('projects','skills'),('profiles','passport_previewed_at'),('blockchain_proofs','claim_version'));
-- Before migration: new relations should be false, and no new-column rows.
-- If any are present, STOP and inspect; do not blindly reapply.
select count(*) as achievements_needing_integrity_review
from public.achievements a
left join public.challenge_submissions s on s.id=a.submission_id
left join public.challenges c on c.id=a.challenge_id
where s.id is null or c.id is null or s.status is distinct from 'approved'
 or s.talent_id is distinct from a.talent_id or s.challenge_id is distinct from a.challenge_id
 or c.company_id is distinct from a.company_id;
-- Must be zero. Existing mismatches cause the entire migration to roll back.
select count(*) as existing_achievements from public.achievements;
select count(*) as existing_proofs from public.blockchain_proofs;
-- AFTER applying migration, use these read-only checks:
-- select c.relname,c.relrowsecurity,(select count(*) from pg_policy p where p.polrelid=c.oid) as policies
-- from pg_class c join pg_namespace n on n.oid=c.relnamespace
-- where n.nspname='public' and c.relname in ('achievement_claims','achievement_evidence','achievement_sharing');
-- Expect RLS true; policies 1, 1, and 3 respectively.
-- select count(*) as missing_snapshots from public.achievements a
-- left join public.achievement_claims c on c.achievement_id=a.id
-- left join public.achievement_evidence e on e.achievement_id=a.id
-- where c.achievement_id is null or e.achievement_id is null;
-- Expect zero. Existing evidence is not made public automatically.
