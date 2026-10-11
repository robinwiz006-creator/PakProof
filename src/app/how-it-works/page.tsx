import { ButtonLink, PageHeading } from "@/components/ui";
export default function How() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="HOW IT WORKS"
        title="Good work deserves to be seen."
        description="ProofPak connects emerging talent with practical company challenges. SkillBoard gives companies a clear view of the evidence."
      />
      {[
        [
          "01",
          "Build your profile",
          "Add your interests, skills, and projects. Choose whether to make your passport public. Your email and private submissions are not published.",
        ],
        [
          "02",
          "Take on a challenge",
          "Read the brief, choose a challenge that fits your goals, and submit a project link with an explanation of your decisions.",
        ],
        [
          "03",
          "Get a thoughtful review",
          "The company reviews your work. It can approve your submission or ask for improvements with written feedback.",
        ],
        [
          "04",
          "Carry your proof forward",
          "An approval creates an achievement in your passport. An authorized company reviewer can connect a Solana wallet and anchor its record hash on devnet.",
        ],
        [
          "05",
          "Let others inspect the record",
          "A public verification page recomputes the record hash and checks the transaction on Solana. This proves the record was committed; it does not independently prove the quality or truthfulness of the company’s assessment.",
        ],
      ].map(([n, title, text]) => (
        <div className="how-step" key={n}>
          <span className="step-number">{n}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </div>
      ))}
      <div className="button-row section-spacer">
        <ButtonLink href="/sign-up">Build Your Skill Passport</ButtonLink>
        <ButtonLink secondary href="/sign-up?role=company">
          Find Proven Talent
        </ButtonLink>
      </div>
      <p className="muted section-spacer">
        Devnet is a testing network. It has no monetary value and its
        transaction history may be reset. Private documents and personal details
        are never included in the onchain memo.
      </p>
    </div>
  );
}
