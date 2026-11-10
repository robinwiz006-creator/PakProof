# Task 17D — Final production verification checklist

**Current decision: wait for explicit approval.** Local populated **synthetic** upgrade and security/workflow tests passed. Production database changes, actual-data restore rehearsal, Vercel deployment and real wallet transactions were not performed.

## 1. Backup and recovery evidence — manual owner/Supabase/export tooling

- [ ] Confirm project `wizlluiyhsxtsxpuwudc` and responsible operator; retain the original catalog snapshot.
- [ ] Retain a recent complete encrypted recovery set covering public data/schema/functions/policies/grants, required Auth users/identities/recovery data, used Storage bytes/metadata, role/extension/configuration inventory and original payment/proof references.
- [ ] Prove restoration with supported tools in an approved isolated recovery environment. No restore on live Supabase; Free plan automatic backups/PITR must not be assumed. A file existing or public CSV export is insufficient.
- [ ] Record backup time, checksums, manifest, tool/restore results and handling of post-backup writes/chain finalizations. No secrets or private exports in Git/chat/public reports.

## 2. Fresh read-only database preflight — manual Supabase SQL Editor

- [ ] Run `docs/PROOFPAK_PRODUCTION_DB_DIAGNOSTIC.sql` and `docs/PROOFPAK_FUNCTION_LINE_ENDING_CHECK.sql` on the confirmed project. Confirm the same nine-file baseline, ten-file gap and only known baseline bodies/CRLF differences. Any drift or partial new objects means stop and reconcile before choosing files.
- [ ] Run `docs/PROOFPAK_MIGRATION_FINAL_PREFLIGHT.sql` in the agreed quiet window. Integrity anomalies must be zero. Record exact counts and original-field fingerprints from targeted checks; counts alone do not establish unchanged content.
- [ ] Account for every unresolved payment/signed attempt and accepted agreement. Do not clear browser recovery storage or cancel/repay unknown transactions. No mainnet funds.
- [ ] Review `docs/check-legacy-client-permissions.sql` before the patch to retain the original ACL evidence; the pre-patch forbidden rights are expected to be present and are not a successful postcheck.
- [ ] Missing migration ledger: keep truthful external baseline/execution provenance. Do not run automatic `db push` or falsely mark all migrations applied.

## 3. Serving application and cutover — manual Vercel/owner

- [ ] Existing project → Deployments → Production → deployment assigned to `pak-proof.vercel.app`: record Ready/error status, full Git SHA, domain and deployment URL. Do not confuse Preview with Production.
- [ ] Confirm reviewed code containing `00fa983...`/Tasks 14–16 and earlier privacy/security work, and that this serving build uses the intended Supabase project. Current settings alone do not prove old build-time values. Share hostname/status/SHA only.
- [ ] If compatible code/configuration is already live, runtime schema updates do not inherently need a new build. Otherwise obtain separate approval for matching deployment/promotion within the controlled window. No automatic deployment here.
- [ ] Agree access/write/signing/cron controls and the friend's test pause. A single tester pausing does not restrict other users. If safe mixed-version protection cannot be enforced, stop for an approved compatibility/cutover design.
- [ ] Review the exact SQL patch/source hashes, data preflight, backup/restore evidence and recovery owner. Obtain explicit approval of all production-changing operations and any Vercel controls before acting.

## 4. Approved-only migration sequence — manual Supabase SQL Editor

**Do not perform this section until separately approved. Do not rerun the first nine.**

```text
1. 202611050001_paid_project_public_privacy.sql
2. 202611050002_issuer_trust.sql
3. 202611050003_challenge_assessments.sql
4. 202611050004_employer_discovery.sql
5. 202611050005_paid_project_lifecycle.sql
6. 202611060001_credential_revocation_privacy.sql
7. 202611060002_credential_corrections.sql
8. 202611070001_contact_handoff.sql
9. 202611070002_organization_verification.sql
10. 202611070003_assessment_transparency.sql
11. 202611090001_legacy_client_permissions.sql
```

- [ ] Use one new SQL query per complete approved file, including its BEGIN/COMMIT. Confirm the project and clear partial text selection before Run. Save outcome/time/source hash and inspect postconditions before the next file.
- [ ] Run no test/bootstrap/default-grant/fixture/seed SQL on Supabase. Do not change Auth/Storage or broad managed defaults.
- [ ] Stop on any error. If the permission patch detects inherited grants/disabled RLS, do not bypass its checks or silently edit other roles. Earlier committed files remain committed; investigate the exact stopping point.

## 5. Post-migration verification — manual read-only Supabase checks

- [ ] Full catalog diagnostic: final 19-file application objects/functions/columns/policies/constraints/indexes exist as intended; original body hashes may differ only through confirmed CRLF. Permission patch introduces no new application relation/function.
- [ ] Line-ending checker: all 88 final signatures `LATEST_BODY_MATCH`; no missing/older/unexplained body. Check function flags/owners/grants too.
- [ ] `check-legacy-client-permissions.sql`: 13 existing RLS tables, 2 client roles, SELECT retained, authenticated mutation matrix exactly matches expected values; TRUNCATE/REFERENCES/TRIGGER/MAINTAIN false and forbidden column-write counts zero. RPC anon=false, authenticated=true. NULL/missing objects are not passes.
- [ ] Private paid-worker and revoking-staff raw column access false; intended safe projection reads work. Company/worker/staff audit access remains correct through their authorized roles.
- [ ] Compare preserved counts/original-field fingerprints, including historical proof references, credentials, accepted terms and receipts. New conservative metadata defaults are expected; unexplained original-field/data changes are not.
- [ ] Confirm real PostgREST exposure/relationships/schema cache after complete transactions. Do not recreate objects or weaken RLS to fix stale cache.
- [ ] Independent administrator reviews explicit issuer categories when appropriate. Self-registered/empty-category defaults are intentional; do not bulk-grant categories or fabricate institutional trust.

## 6. Hosted acceptance and sign-off — founder/tester, reserved accounts

- [ ] Follow `docs/PROOFPAK_HOSTED_TESTING_GUIDE.md`: login/recovery, Passport/project publish/privacy, issuer reviews/category restrictions, assessment/credential consent/correction/revocation/recheck, employer contact isolation, paid offer/milestone/cancellation and safe payment status/recovery.
- [ ] Test both intended successes and unauthorized API attempts with reserved synthetic records and valid normal public/user headers, never service credentials in a browser. Do not interfere with another tester's records.
- [ ] Confirm production build/SHA/site operation; local unit/SQL/browser fixtures are not hosted proof.
- [ ] Real wallet ownership/device and tiny devnet proof/payment/recovery tests require separate authorization. No mainnet, automatic repayment, fake verification or manual mark-paid action.
- [ ] Resolve or explicitly review remaining production dependency advisories and operational support risks before pilot sign-off.

## 7. Recovery if a step fails — manual approved operator

- Keep access controlled. Confirm whether the complete transaction committed before retrying after a network/editor error.
- Failed patch transaction rolls back that patch; earlier schema files may remain applied. Fix forward from the verified stopping point; do not blindly restart all files.
- Preserve privacy boundaries, RLS, immutable facts and original signatures. Do not restore anonymous raw SELECT or disable guards to make old code work.
- Use compatible reviewed code/forward repair. Full database restoration is a separately approved incident operation accounting for newer records and chain finalizations; a database restore cannot undo a token transfer.
- Reconcile the original signed attempt after recovery. Never auto-send another transfer because an acknowledgement or database save was lost.

**Next action now:** review the patch/rehearsal report and collect the unchecked production evidence. Nothing in this checklist is authorization to execute a production operation.
