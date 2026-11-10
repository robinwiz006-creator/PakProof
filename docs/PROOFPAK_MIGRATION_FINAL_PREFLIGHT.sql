-- TASK 17C — READ ONLY. Prepared, NOT executed against production by Codex.
-- Intended project wizlluiyhsxtsxpuwudc. Run only after confirming all first-nine
-- prerequisite relations still exist. One SELECT; counts only, no row contents.
-- Use an agreed quiet window: exact counts may scan tables. Preserve results privately.
-- Missing relation/column/error is a STOP signal, not permission to rerun migrations.
-- Use the complete Task 17B catalog diagnostic alongside this data check.
with
achievement_integrity as (
 select count(*) as mismatched_approved_sources
 from public.achievements a
 left join public.challenge_submissions s on s.id=a.submission_id
 left join public.challenges c on c.id=a.challenge_id
 where s.id is null or c.id is null or s.status is distinct from 'approved'
 or s.talent_id is distinct from a.talent_id
 or s.challenge_id is distinct from a.challenge_id
 or c.company_id is distinct from a.company_id
),
missing_snapshots as (
 select count(*) as missing_claim_or_evidence
 from public.achievements a
 left join public.achievement_claims c on c.achievement_id=a.id
 left join public.achievement_evidence e on e.achievement_id=a.id
 where c.achievement_id is null or e.achievement_id is null
),
missing_credential_records as (
 select count(*) as missing_preferences_or_evidence
 from public.credentials c
 left join public.credential_preferences p on p.credential_id=c.id
 left join public.credential_evidence e on e.credential_id=c.id
 where p.credential_id is null or e.credential_id is null
)
select jsonb_build_object(
 'checked_at_utc',to_char(current_timestamp at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'required_zero_anomalies',jsonb_build_object(
  'achievements_with_inconsistent_sources',(select mismatched_approved_sources from achievement_integrity),
  'achievements_missing_claim_or_evidence',(select missing_claim_or_evidence from missing_snapshots),
  'credentials_missing_preferences_or_evidence',(select missing_preferences_or_evidence from missing_credential_records),
  'projects_with_status_outside_planned_superset',(select count(*) from public.paid_projects where status is null or status not in ('draft','published','offered','active','completed','withdrawn','cancelled'))),
 'record_counts_for_comparison_not_a_backup',jsonb_build_object(
  'auth_users',(select count(*) from auth.users),
  'auth_identities',(select count(*) from auth.identities),
  'skills',(select count(*) from public.skills),
  'platform_administrators',(select count(*) from public.platform_administrators),
  'qualification_requests',(select count(*) from public.qualification_requests),
  'wallet_ownership_challenges',(select count(*) from public.wallet_ownership_challenges),
  'profiles',(select count(*) from public.profiles),
  'companies',(select count(*) from public.companies),
  'memberships',(select count(*) from public.company_memberships),
  'projects',(select count(*) from public.projects),
  'challenges',(select count(*) from public.challenges),
  'submissions',(select count(*) from public.challenge_submissions),
  'reviews',(select count(*) from public.submission_reviews),
  'achievements',(select count(*) from public.achievements),
  'achievement_claims',(select count(*) from public.achievement_claims),
  'achievement_evidence',(select count(*) from public.achievement_evidence),
  'achievement_sharing',(select count(*) from public.achievement_sharing),
  'v1_v2_proofs',(select count(*) from public.blockchain_proofs),
  'organizations',(select count(*) from public.organizations),
  'issuer_authorizations',(select count(*) from public.issuer_authorizations),
  'credentials',(select count(*) from public.credentials),
  'credential_evidence',(select count(*) from public.credential_evidence),
  'credential_preferences',(select count(*) from public.credential_preferences),
  'credential_events',(select count(*) from public.credential_events),
  'v3_proofs',(select count(*) from public.credential_proofs),
  'wallet_connections',(select count(*) from public.wallet_connections),
  'paid_projects',(select count(*) from public.paid_projects),
  'paid_milestones',(select count(*) from public.paid_milestones),
  'paid_applications',(select count(*) from public.paid_project_applications),
  'paid_offers',(select count(*) from public.paid_project_offers),
  'milestone_submissions',(select count(*) from public.paid_milestone_submissions),
  'milestone_reviews',(select count(*) from public.paid_milestone_reviews),
  'payout_authorizations',(select count(*) from public.paid_payout_authorizations),
  'payment_intents',(select count(*) from public.payment_intents),
  'payment_attempts',(select count(*) from public.payment_attempts),
  'payment_receipts',(select count(*) from public.payment_receipts),
  'work_history',(select count(*) from public.paid_work_history),
  'work_evidence',(select count(*) from public.paid_work_evidence)),
 'operational_review_required',jsonb_build_object(
  'payment_intents_by_status',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.payment_intents group by status) s),
  'payment_attempts_by_status',(select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) from (select status,count(*) n from public.payment_attempts group by status) s),
  'unresolved_payment_intents',(select count(*) from public.payment_intents where status not in ('paid','failed','cancelled')),
  'unresolved_signed_attempts',(select count(*) from public.payment_attempts where signature is not null and status not in ('paid','failed','cancelled')),
  'approved_milestones_without_receipt',(select count(*) from public.paid_milestones m where work_status='approved' and not exists(select 1 from public.payment_receipts r where r.milestone_id=m.id)),
  'organizations_with_current_authorized_status',(select count(*) from public.organizations where issuer_status='authorized')),
 'interpretation','Anomaly counts must be zero; unresolved operations require explicit accounting, not deletion/cancellation/repayment. Counts are not a restorable backup or proof of unchanged contents.'
) as release_preflight;
