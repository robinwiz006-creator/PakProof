import { ButtonLink, PageHeading } from "@/components/ui";
export default function How() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="HOW PROOFPAK WORKS"
        title="Start with the work you can show."
        description="Your skill passport brings your profile, projects, evidence, and recognition together. Company challenges are optional."
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
          "A company can review your submission to an optional challenge and approve an achievement. Choose whether to share its approved evidence on your passport.",
        ],
        [
          "05",
          "Check the record",
          "A company reviewer can separately record the achievement on Solana devnet. Verification checks a finalized transaction and matching claim. It does not independently verify the issuer’s identity or your skill level.",
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
        University and organization credential issuance belongs to a future
        release. Devnet is a testing network whose history can reset.
      </p>
    </div>
  );
}
