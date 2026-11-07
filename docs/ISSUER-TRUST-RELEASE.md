# Issuer trust and accountability release

## Scope and existing foundation

This focused task builds on `25fa920` on `fix-wallet-specific-connection`. Previously implemented: independent platform administrators; membership-based organizations; pending/authorized/suspended status; identity-change locks; private immutable authorization notes; immutable credential facts and evidence; recipient acceptance and separate publication/evidence consent; revocation; private qualification requests; real server-verified Solana v3 Memo receipts. None was rebuilt. Challenge-to-credential conversion and employer discovery are outside this task.

The specific gaps were blanket credential-type authority, missing direct issuing-representative attribution, and authorization records lacking explicit outcomes/scope. Files inspected include the product audit, migrations 002–004, credential actions/data/claim/verification code, admin detail and organization pages, and existing SQL/unit/browser tests.

## New permission model

Administrators explicitly approve a subset of the **existing** eight credential types. No new credential taxonomy or claims format is introduced.

| Existing type             | Review meaning                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `course`                  | Training/course completion                                                                                               |
| `workshop`                | Workshop participation                                                                                                   |
| `bootcamp`                | Bootcamp completion                                                                                                      |
| `certification`           | Professional certification / skill assessment; review the actual program and authority, not just the label               |
| `hackathon_participation` | Participation in a reviewed event                                                                                        |
| `hackathon_achievement`   | Awards/results for a reviewed event                                                                                      |
| `company_achievement`     | Company-issued recognition                                                                                               |
| `degree`                  | Academic qualification; only a university organization can be considered, with separate manual academic-authority review |

Registration and organization type grant **no** categories. Being a university does not automatically authorize degrees. Degree restrictions exist in SQL and the admin UI. An administrator must still check the claimed institution and representative authority externally; the app has no official accreditation/database integration. A self-selected university type is not proof of legal identity or accreditation. Support for other degree-granting institution classes requires a separately reviewed policy change; the current conservative default does not infer that authority.

`organizations.allowed_credential_types` defaults to an empty array for **all** existing organizations. Their authorized/pending/suspended status is unchanged. Existing authorized issuers must receive a new administrator category review before issuing anything new. No permissions are inferred from historical degrees, previous approval, wallet links or organization names.

Admin review uses `review_issuer_authorization` with the authorization reference seen when the form loaded. The database rejects stale concurrent decisions, changed identity, non-admin calls and an admin's own organization. Each approval or permission change writes an immutable authorization snapshot and updates the current reference. Suspension clears all category permissions; reinstatement requires explicit selections. Empty selections leave no issuance permissions. The old six-argument `authorize_issuer` remains callable for compatibility, but cannot grant categories; old approval calls conservatively clear them and still log a decision. Do not use the old UI to configure permissions after migration.

Issuance remains through `issue_credential` and qualification review. A database insert trigger checks current organization membership, non-self issuance, authorized status, type permission in both current scope and its immutable authorization snapshot, issuer name, and matching organization/authorization references. This also protects privileged direct inserts: merely bypassing the frontend or supplying a representative ID does not grant authority. Client roles still have no credential/audit write grants. Degree verification requests are offered/accepted only for authorized universities with degree permission; approving one still goes through the same issuance checks.

Existing owner/reviewer membership semantics are preserved: both may issue only allowed categories; this task does not add per-employee issuing roles or team invitations. Payer wallet permission remains owner-only and separate from credential signing.

## Authorization and issuance history

The existing `issuer_authorizations` table is retained, including every historical row. New nullable fields record:

- Decision: approval, suspension, reinstatement, permissions_changed or review.
- Previous and resulting status.
- Previous and approved credential-type arrays.
- Existing administrator ID, server timestamp, identity digest and private review note/reference.

Historical decision/category fields remain NULL: the migration does not invent old outcomes. History remains append-only under the existing immutable trigger and administrator-only RLS. Organizations can see their current permitted categories, but not private administrator notes. The admin detail page shows explicit outcomes and categories while labeling old undecoded decisions honestly.

A new immutable, RLS-protected `credential_issuance_audit` row is created atomically for **every new credential**:

- Credential and organization IDs.
- `representative_id` from the authenticated `auth.uid()`, never a form field.
- Server `issued_at` timestamp (actual issuance, separate from a qualification's issue date).
- Authorization reference and approved credential type at issuance.

Only organization members and platform administrators can read staff attribution; no ordinary client may write it. The issued-credentials workspace provides a private representative-details expander. No personal staff names, email addresses or IDs are added to public credentials.

The read-only `credential_issuance_provenance` view exposes only credential ID, approval reference, approved type, issuance time and a representative-recorded flag. It applies the existing `visible_credential` consent/access test, including acceptance, publication and public passport. It deliberately executes as the trusted database owner with fixed columns and a security barrier, since the underlying staff-audit table is private. Generic definer-view warnings must be assessed against this design, not fixed by granting public access to the audit table. Real local PostgREST tests verify nesting in `credentialSelect`, raw audit denial and public field boundaries.

## Compatibility and trust labels

No historical credential, proof, signature, evidence digest or serializer is edited. New metadata is stored outside `credentials`, so v3 serialization/hashes remain byte-for-byte under the existing rules. V1/v2 are unchanged. A new unit test verifies adding provenance cannot change a v3 claim/hash. A populated pre-upgrade fixture proves existing credential, authorization facts and v3 receipt contents survive unchanged; its offline receipt is not a real transaction.

New public labels distinguish category approval at issuance from current organization approval, credential validity, recipient acceptance and independently verified blockchain integrity. Historical credentials state that category review and representative attribution were not recorded. Suspension/removal of a category prevents new issuance; it does not automatically revoke past credentials. Revocation remains an explicit immutable credential event. Previously issued current/accepted credentials can still be anchored by a currently authorized issuer under existing proof rules even if new issuance scope is empty. Existing recorded proofs continue to be checked, regardless of current scope.

**New staff attribution and permission snapshot details are server/database audit evidence, not additional v3 onchain fields.** V3 still commits its original authorization reference and credential facts. Do not claim the chain independently proves the staff attribution, legal issuer identity, government accreditation, truth of an achievement, or present validity. Recipient consent and real finalized chain checks remain separate.

## Manual migration and release — not performed

Migration: `supabase/migrations/202611050002_issuer_trust.sql`, after all existing migrations through `202611050001_paid_project_public_privacy.sql` for the matching application release. Do not rewrite or rerun historical files.

1. First rehearse in the dedicated test project described by `PROOFPAK_PREVIEW_TEST_PLAN.md`. Confirm its identity. Production setup/migration remains separately unapproved.
2. Before any later production migration, retain a usable backup/export/recovery point and record current deployment SHA. Run `docs/check-issuer-trust.sql` in read-only mode and inspect actual hosted state. Before first application expect new relation/view and organization permission column absent. Existing organizations/credentials/authorization/proof counts are a baseline, not permission to overwrite data.
3. Unexpected objects/columns mean stop and inspect previous successful migration history. Do not rerun initial SQL, delete records, disable RLS/triggers, or invent historical representatives.
4. After explicit authorization, run the complete new migration once as the trusted migration owner (normally Supabase SQL Editor postgres). It runs inside BEGIN/COMMIT. Record success; inspect after an interrupted connection before retrying.
5. Run the check query again: permission arrays are empty unless a later real administrator review occurred; all historical decision fields remain NULL; original credential/proof counts/content are unchanged; private audit is empty for preexisting credentials; RLS and immutable trigger exist. View columns must not include staff/admin IDs or review notes. Recording trigger/function must not be client-callable.
6. Coordinate matching code release. New `credentialSelect` requires the provenance view; do not deploy code before SQL. SQL applied before old code conservatively blocks new issuance through legacy approval/empty scope; historical reads/proofs persist, but use a short maintenance window to avoid old UI presenting all types. Do not grant broad permissions to smooth the rollout.
7. An independent administrator opens each organization detail, reviews relevant authority, explicitly selects categories and records a truthful private reason. Keep old approval notes intact. Academic approvals require a documented separate review; unresolved identity/accreditation remains unapproved.
8. Manually verify: permitted issue succeeds; forbidden degree fails via direct API; representative is captured; private notes/IDs remain private; recipient acceptance/publication still required; suspension blocks issuance; category reduction leaves historical facts/proofs intact; reinstatement restores only selected categories.
9. Confirm actual Vercel deployment and hosted results separately. This task does not push, migrate remotely, merge, deploy or broadcast any transaction.

### Recovery

Migration errors roll back the transaction. Check actual state before retrying if the SQL Editor connection is lost. Keep records and signatures; never drop new tables/columns to undo a deployment. If code release fails, fix forward or restore a compatible deployment while preserving the stricter SQL permission boundary. Old code cannot manage categories safely; new issuance may remain paused until an administrator uses the updated UI. Do not remove the insert trigger or regrant blanket issuance as a rollback. Publication, revocation and historical proof data remain intact.

## Validation evidence

Final results are recorded below after tests finish. Local SQL uses disposable PostgreSQL only. Direct API tests use real local PostgREST, not hosted production. Browser tests use gated explicit UI fixtures and auth guards; physical wallets and hosted real-account acceptance remain postponed. No real institution, credential, staff identity or transaction is fabricated.

| Check                                                     | Passed   | Failed | Skipped |
| --------------------------------------------------------- | -------- | ------ | ------- |
| Unit tests (`npm test`)                                   | 63       | 0      | 0       |
| Database workflow/preservation suites (`npm run test:db`) | 8 suites | 0      | 0       |
| Direct REST security tests (`npm run test:privacy`)       | 21       | 0      | 0       |
| Browser tests (`npm run test:e2e`, desktop/mobile)        | 130      | 0      | 0       |

Lint, TypeScript, formatting and production build passed. An additional focused browser rerun against the final credential markup/labels passed 8 cases (0 failed, 0 skipped); these are a subset of the 130 cases, not eight additional unique tests. Direct REST includes 14 prior payment/privacy regressions and 7 issuer-trust tests; database checks include both populated legacy v1 and v3 preservation. Browser checks include four new desktop/mobile cases for issuer choices and honest historical labels. The isolated migration's earlier rejection/preservation checks also pass. Source claim serializers, proof verifiers, transaction signing and settlement logic are unchanged. Final counts refer to the successful final runs, not intermediate test-development failures.

Local logs: `/tmp/task4-lint.log`, `/tmp/task4-types.log`, `/tmp/task4-unit.log`, `/tmp/task4-format.log`, `/tmp/task4-build.log`, `/tmp/task4-db.log`, `/tmp/task4-rest.log`, `/tmp/task4-browser.log`, `/tmp/task4-browser-focused.log`. These are workspace-local and not hosted acceptance evidence.

## Remaining limitations / next task

- Platform review is manual, not automatic accreditation or legal identity verification. A clear human evidence/review standard and periodic review policy are still needed. No credential-level assessment rubric or appeals workflow is added.
- Permissions are per existing credential type and organization, not program-specific, per-staff or time-limited. Membership still carries existing issuing/revocation powers within scope.
- Old issuance actors cannot be reliably recovered; no backfill is attempted. Historical credentials remain readable, not retroactively claimed to have scoped approval.
- Existing v3 integrity is tamper evidence for its original claim, not a portable signature over new audit metadata. A future portable-credential/key-governance task needs its own versioned design.
- Remaining dependency advisories from the focused security report are not resolved by this task.
- Hosted accounts, real mail, issuer review practice, and real wallets/devnet transactions still need founder-led acceptance. The preview test plan must include this new migration after the privacy migration and explicit administrator category selection.

**Next recommended task:** complete the isolated hosted preview setup and repeatable real-account acceptance test, adding category restrictions and representative privacy to its evidence. Keep physical-wallet steps gated until the founder is available. Do not build challenge-to-credential conversion or employer discovery before selecting those as separate tasks.
