# Paid-project privacy fix (P0.2)

## Confirmed cause and scope

Migrations `202610120005_paid_projects.sql` and `202610120006_milestone_payments.sql` grant anonymous SELECT on the raw projects and milestones tables. Their old SELECT policies allow every non-draft project. RLS filters rows, not columns: a direct REST client can request `worker_id`, `current_offer_id`, `payout_authorization_id`, `current_submission_id`, and `approval_id`. Narrow frontend selects do not protect these fields.

The forward migration `202611050001_paid_project_public_privacy.sql` adds two fixed-column public projections and restricts raw SELECT to company members and the selected worker. It makes no record changes, no claim/hash changes, and no new service-role access. No hosted migration has been applied during this task.

| Reader                               | Public opportunity views                            | Raw project/milestone records | Other private records                            |
| ------------------------------------ | --------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| Anonymous                            | Published, offered, active, completed; never drafts | No permission                 | Existing permissions deny access                 |
| Unrelated signed-in person/applicant | Same safe public fields                             | No rows                       | Own application/offer only; existing RLS remains |
| Company member                       | Public views plus company drafts through raw tables | Own company's rows            | Existing membership and payment permissions      |
| Selected worker                      | Public views plus their selected project's raw rows | Selected project only         | Existing worker permissions                      |
| Server service role                  | Existing privileged access                          | Existing privileged access    | Existing guarded settlement operations           |

Public project fields: id, company_id, title, description, requirements, skills, deadline, budget_units, status, created_at. Public milestone fields: id, project_id, position, title, deliverables, deadline, amount_units. Budgets, scope and milestone amounts remain intentionally public opportunity information; submissions, offers, payout destinations and receipts do not become public.

Views deliberately run with their trusted owner's rights (`security_invoker=false`), using explicit field lists, status predicates and `security_barrier=true`. This is necessary because unrelated visitors cannot read raw party records. Apply as the trusted migration/database owner (normally Supabase SQL Editor's postgres role), never as a client role. Do not grant view mutation rights, change their owner to a client role, add private columns, or replace their predicates with arbitrary client input. Supabase's generic security-definer-view linter may flag these intentional public projections; do not blindly switch to invoker views without redesigning this boundary.

## Manual release sequence — approval required

1. Confirm the target Supabase project is the project used by the intended deployment. Do not assume local and production environment settings match. Retain a usable backup/recovery export.
2. In its SQL Editor, run `docs/check-paid-project-privacy.sql`. Before applying, expect original project/milestone tables with RLS enabled and **no** `public_paid_projects` / `public_paid_milestones` views. Review any unexpected policies, column grants, roles or existing objects first. The migration aborts if extra permissive read policies or surviving anonymous column grants would bypass the intended boundary. The repository proves intended permissions; it does not prove the hosted database matches.
3. Rehearse on an isolated staging project with migrations through `202610120008_payment_workflow_guards.sql`. This patch requires those earlier migrations. Do not rerun initial or historical migrations on production.
4. Coordinate the migration and matching code release in a short maintenance window. Old public readers stop working after raw-table access is removed; new public readers require the views. There is intentionally **no unsafe fallback** to the old raw-table public reads. Review and authorize the migration before releasing this code. Do not merge/deploy merely because local tests passed.
5. Paste the **complete** new migration into SQL Editor and run once as the trusted owner. Its BEGIN/COMMIT transaction creates both views, changes SELECT policies/grants and requests PostgREST schema reload atomically. Do not rerun if the views already exist; inspect state instead.
6. Run the check SQL again. Expect both views, fixed public columns, `security_barrier=true`, `security_invoker=false`, a trusted owner, no anonymous raw-table column SELECT privileges, and authenticated-only raw policies using `paid_project_party` / `paid_milestone_party`. Record counts before/after must match absent concurrent legitimate activity. The script prints counts and metadata, not private records.
7. Release the matching application build only after approval. Verify anonymous homepage/discovery/detail, signed-in unrelated applicant, company member, selected worker, offer acceptance/decline, milestone submission/review, and payment/history access using two or more staging accounts. Check direct REST requests too: anon raw tables denied; unrelated authenticated raw reads empty; restricted columns absent from views and explicit requests rejected. Test company-name embedding after schema reload.
8. Confirm deployment and production behavior separately; this commit alone does not confirm a live fix. No transactions are needed for this access-control rollout; real settlement testing requires separate authorization.

## Recovery

A failed migration rolls back its transaction. If a client loses the SQL Editor connection, inspect objects/policies before retrying: the transaction might already have committed. Do not recreate or reset tables.

If deployment fails after the migration, keep the privacy boundary and fix forward/redeploy compatible code. Rolling application code back to a raw public reader will break discovery; restoring the old permissive policies would reopen the vulnerability and is not a safe recovery. Existing records, agreements, proofs, signatures, wallets and receipts remain in place. If unexpected custom policies or grants exist, stop and review them before migration rather than broadening permissions.

## Local verification

- `npm run test:db`: disposable PostgreSQL 17, complete application workflow/security suites and populated legacy proof-preservation checks.
- `npm run test:privacy`: disposable PostgreSQL 17 + official PostgREST 12.2.3; synthetic users only; checks direct REST row/column access, projections, drafts/all public statuses, company/worker access, denied writes, private evidence/payment permissions, and real publish/select/decline/accept RPC transitions. Fingerprints fixture records before/after the forward migration.
- Existing unit/browser tests cover opportunity rendering, search, application UI, and offline transaction verification. They do not prove production authentication, real wallets or hosted settlement.

Docker must be available and may download the official PostgreSQL/PostgREST images. The test authenticator/password and signing secret in the runner are disposable local fixtures, never production credentials. Containers and network are removed on exit.

## Limits

Previously retrieved identifiers cannot be recalled. This fix prevents future unauthorized database reads; it does not rewrite public blockchain history. Review any external caches/logs separately if there is evidence they contain exposed data. Additional permissive hosted policies/roles could undermine RLS, so inspect the preflight output. Real production validation and deployment are not performed by this task.

## Results for this implementation

- Lint, TypeScript, repository formatting check, and production build: passed.
- `npm test`: 60 passed, 0 failed, 0 skipped.
- `npm run test`: 60 passed, 0 failed, 0 skipped (same suite, separately executed).
- Existing Playwright browser suite: 126 passed, 0 failed, 0 skipped, desktop/mobile; uses the repository's explicitly configured local UI fixtures and authentication guards, not live hosted accounts.
- `npm run test:db`: 6 SQL workflow/preservation suites passed, 0 failed, 0 skipped. Includes populated finalized receipt privacy, authorized receipt access, completed opportunity projection and historical record preservation.
- `npm run test:privacy`: 14 real local REST tests passed, 0 failed, 0 skipped; additionally, 2 unsafe-schema migration rejection scenarios passed, and the populated-record fingerprint comparison passed. No real blockchain transaction was sent.

Production schema, live accounts, provider wallets and hosted end-to-end settlement were not validated. The database migration and production release remain manual and unapproved by this task.
