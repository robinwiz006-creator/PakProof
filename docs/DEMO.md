# Two-account demo walkthrough

Complete the Supabase migration, environment setup, auth redirect configuration, and devnet network access first. Use two different accounts in separate browser profiles or an incognito window. Neither account needs a wallet to complete the database flow; the company reviewer needs one for the onchain step.

1. **Company account:** sign up with “Find talent with SkillBoard.” Confirm the email. Open Company Profile and create **Karachi Labs — demonstration company**, with a description explicitly stating that it is hackathon demo data.
2. **Publish:** create “Build an accessible sales dashboard (demo).” Use React, TypeScript, Accessibility; Intermediate; a future deadline; a clear brief with evaluation criteria; and deliverables of a deployed dashboard, repository, and a short design explanation. Do not ask for sensitive information.
3. **Talent account:** sign up with “Build my skill passport.” Confirm the email. Set the display name to **Ayesha Khan (demo)**, NUST, Islamabad, a frontend headline, bio, and skills. Choose a unique slug and explicitly publish the profile.
4. **Project:** add a real project or a repository/demo you control. Use only public evidence, and clearly label synthetic datasets or demonstration work.
5. **Submit:** browse the company challenge, open its requirements, submit the evidence URLs and an explanation of at least 30 characters. The candidate dashboard shows Pending.
6. **Review:** in the company browser, open Review Submissions. Inspect the links and give feedback. Optionally request improvements, then revise/resubmit from the talent browser. Approve with written feedback.
7. **Passport:** open the talent passport. A company-approved achievement appears with **onchain proof pending**. This is not a blockchain transaction yet.
8. **Anchor:** in the company review workspace, select Phantom or Solflare, connect the devnet wallet, and choose “Connect wallet & anchor.” Approve the real memo transaction in the wallet. Wait for finalization and database proof saving.
9. **Verify:** open the achievement’s verification page. It must report a live finalized record match, display the SHA-256 and signature, and link to Solana Explorer with `cluster=devnet`. Open the Explorer link and inspect the memo.
10. **Share:** visit `/talent/<your-slug>` signed out. Open the achievement and verify again. Keep the company/student demonstration labels even though the devnet transaction is real.

## If something fails

- Signup: confirm Supabase URL/key, run the migration, check email confirmation/SMTP, and verify allowed redirect URLs.
- Missing record or permission error: use the account that owns the profile or belongs to the challenge’s company. Company reviewers cannot approve a different company’s submission.
- Wallet not found: enable the extension on this browser and reload; the wallet must support Wallet Standard and devnet.
- Transaction failure: inspect its wallet/RPC error and devnet balance. Do not switch to mainnet.
- Transaction sent but not saved: retain its signature and wallet address. Use Retry saving existing transaction or the recovery fields. This sends no additional transaction.
- RPC unavailable: allow the devnet hostname or configure a devnet provider. The UI must continue to say verification is unavailable, not verified.
