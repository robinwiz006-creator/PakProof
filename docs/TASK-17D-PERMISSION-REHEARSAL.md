# Task 17D — Legacy permission cleanup and local upgrade rehearsal

**Prepared:** 9 November 2026, Asia/Karachi. **Branch:** `task-17-release-readiness`, starting application/documentation commit `17b3dc8`; prior Task 17B/17C planning files retained. This task makes no hosted Supabase/Vercel change, push, merge, deployment or blockchain transaction. The new patch, test changes and reports are local and uncommitted.

## 1. Result and release decision

**Local technical result: PASS. Production execution: NOT AUTHORIZED / still gated.**

A disposable PostgreSQL 17.11 legacy database reproduced the observed schema, CRLF function bodies and broad Supabase-style client defaults. It was populated with synthetic accounts, approved work, a legacy credential, offline v1/v2/v3 references, accepted paid work, signed-attempt fixtures and two simulated finalized payment receipts. All ten pending schema migrations and the new permission patch succeeded in order. Original values were fingerprinted across all 36 application tables plus the synthetic Auth table and remained unchanged.

A separate clean local database under the same broad defaults ran 14 SQL security/workflow suites after all 20 migration files. This does not constitute restoration/rehearsal against actual production data, managed Supabase Auth/Storage, physical wallets, real RPC settlement or the serving Vercel deployment.

## 2. Permission patch

**`supabase/migrations/202611090001_legacy_client_permissions.sql`** — forward-only, after `202611070003_assessment_transparency.sql` and all preceding prerequisites. It adds no table, column, function or proof format. It has its own BEGIN/COMMIT and schema-cache notification.

Scope: `profiles`, `companies`, `company_memberships`, `skills`, `projects`, `challenges`, `challenge_submissions`, `submission_reviews`, `achievements`, `blockchain_proofs`, `achievement_claims`, `achievement_evidence`, `achievement_sharing`.

- Removes table privileges from PUBLIC/anon/authenticated on only these 13 tables, including surplus TRUNCATE, REFERENCES, TRIGGER and MAINTAIN rights.
- Separately revokes explicit column SELECT/INSERT/UPDATE/REFERENCES grants from these roles; table REVOKE alone does not remove them.
- Restores source-intended client SELECT on all 13; unchanged RLS continues to decide which rows are visible. SELECT on a table is not a public-row guarantee.
- Restores only intended authenticated mutations below; no direct client achievement/proof/membership/review issuance writes.
- Removes PUBLIC and anonymous EXECUTE from the three legacy mutation RPCs, preserving authenticated execution. Their bodies, authorization logic and signatures are untouched.
- Does not touch RLS/policies, function definitions/owners, global defaults, service-role grants, Auth/Storage schemas, records, accepted terms or historical hashes/signatures.

| Authenticated action                        | Permitted tables                                               |
| ------------------------------------------- | -------------------------------------------------------------- |
| UPDATE                                      | profiles, companies, projects, challenges, achievement_sharing |
| INSERT                                      | projects, challenges, achievement_sharing                      |
| DELETE                                      | projects                                                       |
| All other direct mutations on the 13 tables | Denied                                                         |

Anonymous direct writes and both clients' non-row dangerous privileges are denied. Existing policies still constrain ownership/company permissions for the allowed writes.

Reviewed RPCs: `create_company(text,text,text,text)`, `submit_work(uuid,text,text,text)` and `review_submission(uuid,text,text)`. The first-nine bodies were already authenticated internally; this patch removes the unnecessary anonymous execution path rather than replacing those checks. The later assessment migration's review wrapper is retained.

### Fail-closed safeguards

The patch checks expected privacy/correction views and detailed-review RPC prerequisites, then requires all target relations to be RLS-enabled tables. Its final assertions check effective table/column and function privileges, including inherited grants. If another role still gives a client forbidden rights, it aborts the **entire patch transaction** and asks for review; it does not revoke unrelated memberships or silently alter custom roles. It also refuses disabled RLS. No manual mark-paid/verified capability is introduced.

The patch intentionally leaves Supabase global default ACLs unchanged. Future migrations still need explicit REVOKE/GRANT boundaries and broad-default regression tests. Safe repeated application was tested locally, but production operators should inspect outcomes before retrying, not blindly rerun files after a lost connection.

## 3. Rehearsal implementation and fidelity

Run **`npm run test:upgrade`**. The runner uses Docker only and never reads hosted database connection variables. PostgreSQL containers have no published database port and are removed on exit. No production dump is read or restored, and no SQL seed/fixture is sent to hosted services.

### Populated legacy database

1. Local bootstrap supplies minimal synthetic Supabase-style Auth roles/schema. `tests/supabase-legacy-defaults.sql` reproduces observed postgres-owned public default grants and installs pgcrypto in `extensions`.
2. Apply the first nine source migrations locally. Convert stored public function definitions to CRLF without changing bodies' logic/ACLs, then assert **36 tables, 296 columns, 58 compatible functions, 44 policies**, RLS and the original excess grants.
3. Verify the new patch rejects missing newer prerequisites and leaves old privileges intact on failure.
4. Populate synthetic historical records. Offline payment fixtures use the trusted SQL boundary to model verified results, not an actual token transfer. Full post-upgrade payment tests separately retain their original cancellation/privacy assertions.
5. Snapshot original columns, row counts and content fingerprints for all 36 public application tables plus synthetic Auth users. This excludes later added metadata when comparing original values.
6. Apply the ten pending files in filename order, then `202611090001_legacy_client_permissions.sql` — **11 successful ordered upgrade transactions**.
7. Verify all original values remain, including accepted credential/evidence/proof references, v1/v2 receipt flags, agreements, wallet/nonce state, signed attempts, two payment receipts and completed work history. Existing issuers gain neither automatic category scope nor institutional trust.
8. Compare policies, RLS flags, function bodies/owners/settings, default ACLs and server-table access before/after the patch. They remain unchanged.
9. Test direct denied TRUNCATE/forged mutations, explicit PUBLIC/column-grant cleanup, inherited column-write/TRUNCATE/EXECUTE rejection and rollback, disabled-RLS rejection and safe fixture reapplication.
10. Run the exact prepared operator read-only SQL and validate its expected matrix.

### Separate final-schema workflow database

Creates a second **local-only** database with broad defaults, applies all 20 migrations and runs the 13 existing application workflow suites plus the new ACL suite. Coverage includes assessments/issuer review, credentials/consent/corrections/revocation, challenges, employer search/contact privacy, paid offers/milestone review/cancellation, wallet locks, settlement authorization, duplicate receipts and private work-history publication.

This local Auth table is deliberately minimal; it does not emulate hosted email, identities/password recovery, Storage, Supabase-managed operational roles or all extensions/configuration. PostgreSQL major/minor 17.11 matched the supplied catalog during this run, but synthetic content is not the real database. The historical offline references do not represent verified live blockchain transactions.

## 4. Exact automated results

| Final check                                |    Passed | Failed | Skipped |
| ------------------------------------------ | --------: | -----: | ------: |
| Unit tests                                 |       105 |      0 |       0 |
| Standard database suites                   | 19 suites |      0 |       0 |
| Full direct local PostgREST security suite |        80 |      0 |       0 |
| Desktop/mobile browser tests               |       204 |      0 |       0 |
| Rehearsal focused checks                   |        12 |      0 |       0 |
| Rehearsal final-schema workflow suites     | 14 suites |      0 |       0 |

Rehearsal suite executions overlap the standard database suite; do not sum them as distinct product features or hosted journeys. All 11 ordered populated-upgrade transactions succeeded in completed runs. Deliberately rejected migration attempts are passing fail-closed tests, not unexpected migration failures.

Lint, TypeScript, repository formatting, production build and shell syntax checks passed. The full browser suite passed its first Task 17D run without retries; it uses blank hosted credentials/offline fixtures and does not itself test the new database grant boundary. The database/REST/rehearsal suites exercise that boundary directly.

### Initial failures and corrections

- Initial standard database and 76-case REST runs passed with the patch.
- First new rehearsal attempt stopped before the pending chain because its pre-upgrade fixture called the later-only cancellation RPC. The fixture now excludes that later-only block; the original complete payment test still runs after upgrade.
- Second attempt hit Docker's temporary PostgreSQL startup socket. Readiness now waits for the final TCP listener, rather than the temporary initialization server.
- Third attempt encountered a fixture ordering assumption: an existing credential made the standalone payment fixture's “payment did not issue a credential” assertion fail. The legacy credential is now populated after payment-fixture completion, and post-privacy-only fixture checks run only after the privacy schema exists. No application assertion was weakened.
- The subsequent full rehearsal passed. Further complete runs passed after adding v2 preservation, inherited TRUNCATE and the operator checker. The final complete run above includes all changes.
- First expanded REST run: **79 passed, 1 failed, 0 skipped** because the new positive project fixture omitted every required evidence URL. A valid synthetic demo URL fixed the fixture; final **80/0/0**. The database constraint was not relaxed.

Temporary evidence: `/tmp/task17d-{unit,db-final,rest-final,browser,rehearsal-verified,lint,types,format,build}.log`. Earlier attempt logs are retained separately in `/tmp`. They are local evidence, not production sign-off.

## 5. Test and operator files

- New migration: `supabase/migrations/202611090001_legacy_client_permissions.sql`.
- Runner: `scripts/rehearse-legacy-upgrade.sh`; script entry `npm run test:upgrade`.
- Local-only support: `tests/supabase-legacy-defaults.sql`, `legacy-permissions-baseline.sql`, `legacy-upgrade-preservation.sql`, `legacy-upgrade-preservation-after.sql`, `legacy-v2-rehearsal-fixture.sql`.
- Security suite: `tests/legacy-permissions-database.sql`; four new cases in `tests/paid-project-privacy-rest.mjs`.
- Existing database/REST runners now apply the patch at the correct final-schema point. Intermediate historical test schemas defer it until prerequisites exist. REST also runs under the reproduced broad defaults.
- Operator verification: `docs/check-legacy-client-permissions.sql` (read only, validated locally, not run hosted).
- Release checklist: `docs/TASK-17D-PRODUCTION-CHECKLIST.md`.
- README now documents the twentieth migration and local rehearsal command. No application feature implementation or previously applied migration file is modified.

**Never run test bootstrap/default/fixture/rehearsal SQL against Supabase.** The new forward migration is the only prepared schema/permission operation for production, after the ten pending application migrations and explicit approval.

## 6. Remaining risks and exact release gates

| Item                                                 | Status / required action                                                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Permission patch and synthetic upgrade compatibility | Locally tested, ready for review; not hosted applied.                                                                                                                                                            |
| Actual production records and customizations         | Only the supplied catalog was analyzed. Fresh data preflight, backup and preservation baseline still needed.                                                                                                     |
| Verified recoverable backup                          | Not available/verified here. Must include required public/Auth/Storage recovery data and a demonstrated restore.                                                                                                 |
| Rehearsal of an actual production backup             | Not performed. If required by the release owner, conduct it in an approved isolated recovery environment without exposing personal data; this task's synthetic success is not a substitute.                      |
| Current production SHA/build-time target             | Not verified; manual Vercel check required before cutover.                                                                                                                                                       |
| Controlled window and pending signatures/cron        | Owner must account for existing work/payments, coordinate current tester and authorize actual access/deployment controls.                                                                                        |
| Global Supabase defaults                             | Intentionally unchanged. Future objects can inherit broad grants unless their migrations explicitly constrain them.                                                                                              |
| Unexpected inherited privileges                      | Patch will abort, not silently fix unrelated roles. Investigate and approve any scoped reconciliation before retrying.                                                                                           |
| Dependency advisories                                | Fresh `npm audit --omit=dev`: **15 high affected production entries, 0 critical/moderate/low**. These are not fixed by an ACL patch; exposure/remediation decision remains separate. No blind upgrade performed. |
| Physical wallet, RPC recovery, SMTP, hosted RLS      | Not tested in this task. Require the reserved-account hosted guide and separately authorized devnet tests.                                                                                                       |
| Production approval                                  | Not granted. No production operation is performed or implied by local success.                                                                                                                                   |

**Recommended next action:** review the exact permission patch and local evidence, then complete the manual backup/restore, fresh preflight and Vercel deployment checks. Approve a concrete cutover packet listing the ten pending migrations plus this patch only after those gates pass. See the concise checklist; do not apply anything yet.
