import Link from "next/link";
import { UserRound, BadgeCheck, ArrowUpRight } from "lucide-react";
import { ButtonLink, PageHeading } from "@/components/ui";
export default function How() {
  return (
    <div className="container page how-simple">
      <PageHeading
        eyebrow="HOW IT WORKS"
        title="Your work. One professional record."
        description="Start with your profile. Add proof as you grow."
      />
      <ol className="simple-steps">
        {[
          {
            title: "Build your Skill Passport",
            text: "Add your skills, projects and evidence. Preview your profile, then publish and share it.",
            Icon: UserRound,
          },
          {
            title: "Prove your work",
            text: "Show what you’ve made. Accept credentials from approved organizations and choose what to publish.",
            Icon: BadgeCheck,
          },
          {
            title: "Find opportunities",
            text: "Explore challenges and projects. Apply when the work fits your skills — participation is optional.",
            Icon: ArrowUpRight,
          },
        ].map(({ title, text, Icon }, index) => (
          <li key={title}>
            <div className="simple-step-mark">
              <Icon size={24} aria-hidden="true" />
              <span>0{index + 1}</span>
            </div>
            <h2>{title}</h2>
            <p className="muted">{text}</p>
          </li>
        ))}
      </ol>
      <div className="button-row section-spacer">
        <ButtonLink href="/sign-up?role=talent">
          Create my Skill Passport
        </ButtonLink>
        <Link className="text-link" href="/sign-up?role=company">
          For organizations →
        </Link>
      </div>
      <details className="trust-help section-spacer">
        <summary>Trust &amp; Verification</summary>
        <ul>
          <li>
            Projects and skills added by individuals are self-reported.
            Credentials and company-approved achievements are separate records.
          </li>
          <li>
            ProofPak organization approval is not independent proof of legal
            identity. Institution verification requires an approved human
            representative; ProofPak does not automatically access university
            databases.
          </li>
          <li>
            For eligible records, Solana verification checks matching data in a
            finalized transaction. It does not independently prove an
            achievement is true. Acceptance, issuer approval, expiry and
            revocation remain separate checks.
          </li>
          <li>
            Solana devnet is a test network and its history can reset. Paid
            projects use test USDC with no monetary value. Funds are not locked,
            and payment is not guaranteed. Payment alone does not verify a skill
            or issue a credential.
          </li>
          <li>
            A wallet is optional for creating and sharing a passport. Public
            work and evidence require your publication choices; blockchain
            transactions themselves can be publicly discoverable.
          </li>
        </ul>
      </details>
    </div>
  );
}
