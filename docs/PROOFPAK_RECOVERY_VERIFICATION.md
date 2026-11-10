# ProofPak recovery verification — Task 17E

**Production status: not exported; not restore-verified. No migration approval implied.** Use with [the Windows backup guide](PROOFPAK_MANUAL_BACKUP_GUIDE.md).

## Four separate gates

| Gate                      | Required evidence                                                                                                | Current production result |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1. Backup files created   | Complete manifest, archive, private inventory, roles reference, Storage index and required file bytes            | Not performed             |
| 2. File integrity checked | All listed size/SHA-256 comparisons and `pg_restore --list` succeed; trusted manifest digest retained separately | Not performed             |
| 3. Restore completed      | `pg_restore --exit-on-error` finishes in a newly created isolated local PostgreSQL 17 container                  | Not performed             |
| 4. Recovery checks passed | Source/restored catalog, record fingerprints and recovered file bytes agree; all exclusions reviewed             | Not performed             |

The helper's stage 4 checks cover a defined SQL/file scope. They never establish full hosted Supabase recovery on their own. If any necessary excluded component remains unresolved, production migration stays **NO-GO**.

## Coverage and operator sign-off

Record only aggregate statuses here. Private inventories and archives stay on encrypted storage.

| Check                                                 | Method                                                                                                                      | Result / owner / date    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Correct source project and serving application        | Confirm project reference, current Vercel deployment SHA and configured environment without disclosing values               | Not verified             |
| Recoverable encrypted storage and separate key access | Owner confirms drive, host/Docker disk encryption and access policy                                                         | Not verified             |
| Consistent SQL capture                                | Shared exported repeatable-read snapshot for inventory and archive                                                          | Not run                  |
| No concurrent schema/role/Storage change              | Agreed quiet window; compare observed Storage metadata before/after download                                                | Not arranged             |
| All required application tables/data                  | Table counts and sorted whole-row SHA-256 fingerprints match, including credential claims and payment signatures            | Not run                  |
| Auth records                                          | Auth tables restored with exact fingerprints; zero orphan identities                                                        | Not run                  |
| Sequence state                                        | Last values and called flags match                                                                                          | Not run                  |
| SQL definitions                                       | Functions, views, triggers, constraints and indexes match                                                                   | Not run                  |
| RLS and permissions                                   | Policies, RLS flags, table/view/sequence/schema/column ACLs and memberships match; client-role flags checked                | Not run                  |
| Default privileges/global role configuration          | Inventory/reference reviewed separately; helper does not recreate all managed configuration                                 | Requires operator review |
| Extensions                                            | In-scope extension names, versions and namespaces match; review every excluded extension                                    | Not run                  |
| Migration metadata                                    | Preserve ledger if present; absence remains absence, not a fabricated applied history                                       | Not run                  |
| Storage buckets, metadata and policies                | SQL comparison plus private object index                                                                                    | Not run                  |
| Storage bytes                                         | Every listed object downloaded; size checked where available; recovery copies match byte count and SHA-256                  | Not run                  |
| Zero Storage objects, if applicable                   | Actual snapshot count zero, second metadata check unchanged; bucket definitions still retained                              | Not verified             |
| Hosted Storage re-import/read access                  | Separate approved compatible recovery environment and API procedure, if files exist                                         | Not tested               |
| Hosted Auth login/email/session behavior              | Separate approved compatible environment with private provider/SMTP configuration; no user impersonation                    | Not tested               |
| Excluded schemas/Vault/managed platform state         | Review private `excluded_schemas` and complete extension inventory; resolve dependencies before sign-off                    | Not reviewed             |
| Large objects                                         | Helper requires zero large objects/foreign tables/materialized views; otherwise specialist backup/content validation needed | Not verified             |
| External evidence and chain history                   | Document owner/source retention; DB contains references only, devnet may reset                                              | Residual dependency      |
| Second encrypted copy                                 | Re-run integrity check on copied bundle; store trusted manifest hash separately                                             | Not run                  |

## Local restore test

1. Complete gates 1 and 2 using the backup guide. Never provide archive contents, snapshots, user data or credentials to chat.
2. Run the `rehearse` command on the trusted Windows host. Check sufficient RAM/disk: the restore database uses a 2 GB tmpfs by default. A larger real database requires an operator-reviewed limit increase, not a truncated dump.
3. The helper starts a fresh PostgreSQL container with `--network none`, no published ports, no persistent database volume and disabled container logging. It mounts the bundle read-only. Temporary recovered file bytes remain in a separate private folder on the encrypted parent drive.
4. It recreates password-free local role scaffolding. Login privileges/passwords and managed role settings are deliberately not replayed. The local `postgres` administrator remains a superuser for restoration. This is not a faithful managed Supabase security runtime.
5. It restores objects, ownership, ACLs and records with fail-on-error. It does not disable production RLS, change hosted privileges or use a hosted restore destination.
6. It performs read-only catalog and aggregate data comparisons. Any mismatch prevents a successful recovery status. Source records are not printed. The private report lists mismatched section names only.
7. It verifies copied Storage file bytes and removes the temporary recovered bytes and database container. The source bundle remains intact.
8. Review the private `checks/restore-*.json`. Both `restore_completed` and `recovery_checks_passed` must be true. `full_supabase_project_recovery_verified` intentionally stays false.
9. Resolve the coverage checklist's remaining platform items before calling the backup sufficient for production migration recovery. Do not weaken assertions, modify snapshots or ignore failed tables.

Do not run application fixture/bootstrap suites against a copy containing real users. The helper does not start Auth, SMTP, webhooks or the ProofPak app, so the rehearsal cannot send emails or blockchain transactions.

## Failure and recovery procedure

- **Export fails:** no complete manifest means incomplete backup. No database migration. Resolve the sanitized failure stage privately, repeat capture into a new encrypted folder.
- **Checksum fails:** stop. Compare against the separate trusted hash and second copy. Do not regenerate a manifest to hide corruption.
- **Restore fails:** stop. Common causes include missing Supabase-only extension libraries, permissions/managed ownership or version incompatibility. Arrange an authorized matching local Supabase recovery environment and specialist review. Do not skip unsupported objects and report success.
- **Comparison fails:** inspect only the named section privately. Concurrent sequence/Storage changes, changed role memberships or omitted schemas require investigation. A clean local fixture passing does not establish production compatibility.
- **A future production migration fails:** stop application writes under a separately approved operational plan; preserve errors and current state. Determine whether its explicit transaction rolled back. Do not rerun it blindly, reset the database, restore the baseline over newer records or delete payment receipts.
- **A future database restore becomes necessary:** obtain separate approval, a current post-incident capture and a reviewed managed-Supabase restoration procedure. Restore and validate in an authorized compatible recovery destination before considering in-place changes. This helper intentionally cannot restore to production. Reconcile records created after the backup and original Solana signatures; never send another transfer merely because the restored database lacks a receipt.
- **After recovery:** recheck Auth, public/private access, current migration state, claims and original payment/proof signatures. Historical chain records and current credential validity remain separate facts.

## Manual actions still required

1. Owner authorizes the read-only capture and agrees a quiet window with the existing tester.
2. Owner/operator confirms encrypted Windows/Docker storage, project connection, official CA and private configuration retention.
3. Run backup, integrity check and isolated restore; record the four gate outcomes.
4. Review excluded schemas/extensions, default ACLs, role settings, Auth and Storage service recovery. Existing production `supabase_vault` or other nonstandard extensions may require additional local tooling and are not silently skipped.
5. Approve a **separate** production migration plan only after recovery coverage is sufficient. The eleven pending changes from Task 17D are not run by this task.

## Local validation evidence

The accompanying `tests/recovery/test_recovery.py` uses only disposable synthetic PostgreSQL containers, fake Auth rows, a credential/payment-reference row, RLS, grants, a trigger and synthetic private Storage bytes. It tests populated and zero-object Storage captures, archive reading, actual local restoration, record/security comparisons and corruption refusal. HTTP Storage authentication, production TLS, Windows ACLs, hosted Auth and real project recovery need manual verification.

This cloud sandbox places `.git` sentinel directories in both writable roots. The synthetic integration test substitutes a path validator limited to its temporary fixture directory; the production helper's repository-output restriction remains unchanged and has a separate test. This is not permission to store real backups inside a Git workspace.

No actual production archives are created or committed. Temporary synthetic artifacts are deleted after tests. Record exact current-run results in the Task 17E delivery report; do not substitute the earlier Task 17D migration rehearsal results for a production backup restore.

### Task 17E validation run — 9 November 2026

- Final synthetic helper suite: **10 passed, 0 failed, 0 skipped** (`python3 -m unittest discover -s tests/recovery -v`). This includes two actual disposable SQL restores: populated Storage and empty Storage with PUBLIC schema usage revoked. Both comparisons passed. The populated bundle was then deliberately corrupted and rejected.
- Earlier development runs: five runs each reported **9 passed, 1 error, 0 skipped**, including diagnostic reruns. They exposed the cloud Git-sentinel path restriction, omitted extension inclusion and PostgreSQL public-schema restore assumptions. The test-only path exception is bounded to synthetic temporary folders; extension inclusion and captured PUBLIC privileges were corrected in the helper. Two subsequent complete suite runs passed all 10 tests.
- Python syntax compilation passed. Both Markdown files passed Prettier. `git diff --check` passed. No recovery containers remained after validation.
- No production database/API connection, production backup, Windows execution, real Storage HTTP download, hosted restore, Auth login or migration was tested. Application-wide tests were not rerun for these standalone helpers/documents; no application feature code changed.
