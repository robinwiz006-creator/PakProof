import { ButtonLink, PageHeading } from "@/components/ui";
export default function How() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="HOW PROOFPAK WORKS"
        title="Start with the work you can show."
        description="Your skill passport brings your profile, projects, evidence, and recognition together. Credentials are issued separately from your own projects. Challenges and paid work are optional."
      />
      {[
        [
          "01",
          "Complete your profile",
          "Add a headline, introduction, location, and skills. These are self-reported. Optional details can wait.",
        ],
        [
          "02",
          "Add projects and evidence",
          "Show personal, university, or freelance work through repositories, demos, and supporting links. You can edit your projects later.",
        ],
        [
          "03",
          "Preview, publish, and share",
          "Preview your passport privately, choose to publish it, and copy its link. You can build a useful passport without completing a challenge.",
        ],
        [
          "04",
          "Earn recognition over time",
          "An authorized organization can issue a credential for you to accept or decline. An optional company challenge can also lead to an approved achievement. Choose what to publish and whether to share evidence.",
        ],
        [
          "05",
          "Check the record",
          "Issuers can separately record their credential or achievement on Solana devnet. Verification checks a finalized transaction and matching claim. It does not independently verify the issuer’s identity or your skill level.",
        ],
        [
          "06",
          "Optional paid work",
          "Agree on fixed milestones with a company, submit evidence and receive review. Approved work can be paid in devnet test USDC after wallet ownership checks. Test tokens are not real money, and direct payments are not guaranteed. Completed work can join your passport with consent; payment alone is not a skill credential.",
        ],
      ].map(([n, title, text]) => (
        <div className="how-step" key={n}>
          <span className="step-number">{n}</span>
          <div>
            <h2>{title}</h2>
            <p>{text}</p>
          </div>
        </div>
      ))}
      <div className="button-row section-spacer">
        <ButtonLink href="/sign-up?role=talent">
          Build Your Skill Passport
        </ButtonLink>
        <ButtonLink secondary href="/sign-up?role=company">
          Open company workspace
        </ButtonLink>
      </div>
      <p className="muted section-spacer">
        Institution verification requires an authorized human representative;
        ProofPak does not access university databases automatically. Devnet is a
        testing network whose history can reset.
      </p>
    </div>
  );
}
