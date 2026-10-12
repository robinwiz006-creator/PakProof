import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Fingerprint, MoveUpRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { MarketingPassport } from "@/components/marketing-passport";
import {
  LiveOpportunities,
  OpportunitiesLoading,
} from "@/components/live-opportunities";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <div className="marketing-home">
      <section className="editorial-hero marketing-container">
        <div className="editorial-hero-copy">
          <p className="marketing-eyebrow">YOUR WORK DESERVES TO BE SEEN.</p>
          <h1>
            Your skills are
            <br />
            more than a CV.
            <br />
            <span>
              Show what
              <br className="hero-line" /> you can do.
            </span>
          </h1>
          <p className="marketing-lead">
            Build your Skill Passport, collect credentials, find real
            opportunities, and get paid for your work. All in one place.
          </p>
          <div className="button-row">
            <ButtonLink href="/sign-up?role=talent">
              Build Your Passport
            </ButtonLink>
            <Link href="/opportunities" className="marketing-text-link">
              Explore Opportunities <ArrowUpRight size={19} />
            </Link>
          </div>
          <p className="marketing-caption">
            Start with your work. No wallet needed to build a passport.
            <br /> Payments currently use devnet test tokens, not real money.
          </p>
        </div>
        <div className="hero-product">
          <div className="product-caption">
            <span>YOUR PROFESSIONAL RECORD</span>
            <span>IN ONE PLACE ↙</span>
          </div>
          <MarketingPassport />
          <p className="product-footnote">
            <span>Skills. Projects. Credentials. Experience.</span>
            <span>Yours to share.</span>
          </p>
        </div>
      </section>
      <section className="journey-section" aria-labelledby="journey-title">
        <div className="marketing-container">
          <div className="editorial-heading">
            <p className="marketing-eyebrow">01 / BUILD YOUR RECORD</p>
            <h2 id="journey-title">
              Everything you do.
              <br />
              One place to show it.
            </h2>
            <p>
              Add your skills and projects, take on challenges, earn
              credentials, and build a record of your work.
            </p>
          </div>
          <div className="journey-track">
            {[
              [
                "01",
                "Start with what you know.",
                "Add your profile, skills, projects, and links to the work behind them.",
              ],
              [
                "02",
                "Make your work visible.",
                "Publish your passport when you’re ready. Share it with collaborators, mentors, and organizations.",
              ],
              [
                "03",
                "Keep building your story.",
                "Choose challenges or paid projects, and accept credentials as you earn recognition.",
              ],
            ].map(([number, title, text]) => (
              <article key={number}>
                <span className="journey-number">
                  {number}
                  <MoveUpRight size={28} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="journey-note">
            Choose your own path. Challenges and wallets are optional.
          </p>
        </div>
      </section>
      <section
        className="marketing-container marketing-section"
        aria-labelledby="opportunity-title"
      >
        <div className="editorial-heading horizontal">
          <div>
            <p className="marketing-eyebrow">02 / DISCOVER OPPORTUNITIES</p>
            <h2 id="opportunity-title">Find your next opportunity.</h2>
            <p>
              Explore open challenges and paid projects. Build something useful,
              show your skills, or apply for paid work.
            </p>
          </div>
          <Link href="/opportunities" className="marketing-text-link">
            View All Opportunities <ArrowUpRight size={20} />
          </Link>
        </div>
        <Suspense fallback={<OpportunitiesLoading />}>
          <LiveOpportunities />
        </Suspense>
      </section>
      <section className="passport-feature" aria-labelledby="passport-title">
        <div className="marketing-container passport-feature-grid">
          <div>
            <p className="marketing-eyebrow">03 / YOUR SKILL PASSPORT</p>
            <h2 id="passport-title">
              Your work
              <br />
              speaks for itself.
            </h2>
            <p className="marketing-lead">
              Bring your skills, projects, credentials, and completed work
              together in one shareable profile.
            </p>
            <ul className="passport-feature-list">
              <li>
                <Check size={18} /> Projects supported by evidence
              </li>
              <li>
                <Check size={18} /> Credentials with clear issuer information
              </li>
              <li>
                <Check size={18} /> Public or private. Your choice.
              </li>
            </ul>
            <ButtonLink href="/sign-up?role=talent">
              Create My Passport
            </ButtonLink>
          </div>
          <MarketingPassport expanded />
        </div>
      </section>
      <section
        className="marketing-container marketing-section proof-feature"
        aria-labelledby="proof-title"
      >
        <div className="editorial-heading">
          <p className="marketing-eyebrow">04 / CREDENTIALS & PROOF</p>
          <h2 id="proof-title">
            Proof that goes
            <br />
            beyond a claim.
          </h2>
          <p>
            Receive credentials from organizations authorized on ProofPak.
            Eligible records can be checked against Solana blockchain proofs.
          </p>
        </div>
        <div className="proof-checks">
          {[
            [
              "Issuance",
              "Who issued the record?",
              "An organization issues a credential. You choose whether to accept and publish it.",
            ],
            [
              "Authorization",
              "Is the issuer authorized?",
              "ProofPak’s administrator reviews the organization and its representative before enabling issuance.",
            ],
            [
              "Integrity",
              "Does the record match?",
              "A matching, finalized Solana proof checks the committed record. Pending transactions are not verified.",
            ],
          ].map(([label, title, text]) => (
            <article key={label}>
              <span>{label}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <p className="proof-limit">
          These are separate checks. Solana does not independently prove
          someone’s skills, qualifications, or an issuer’s truthfulness. Current
          proofs use devnet.
        </p>
      </section>
      <section className="paid-feature" aria-labelledby="paid-title">
        <div className="marketing-container paid-feature-grid">
          <div>
            <p className="marketing-eyebrow">05 / OPTIONAL PAID WORK</p>
            <h2 id="paid-title">
              Turn your skills
              <br />
              into paid work.
            </h2>
            <p className="marketing-lead">
              Apply for projects, agree on milestones, submit your work, and
              receive payments when the organization pays.
            </p>
            <Link href="/paid-projects" className="marketing-text-link">
              Explore paid projects <ArrowUpRight size={20} />
            </Link>
          </div>
          <div
            className="milestone-preview"
            aria-label="Illustrative milestone process"
          >
            <p className="marketing-eyebrow">THE MILESTONE JOURNEY</p>
            {[
              "Agree on clear work & terms",
              "Submit work and evidence",
              "Organization reviews the milestone",
              "Organization signs the payment",
              "Finalized transfer is checked",
            ].map((text, i) => (
              <div key={text}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{text}</p>
                <ArrowUpRight size={17} aria-hidden="true" />
              </div>
            ))}
            <p className="milestone-note">
              Process illustration—not an actual payment.
            </p>
          </div>
        </div>
        <div className="marketing-container devnet-note">
          Currently uses Solana devnet test tokens, not real money. Direct
          payments are not guaranteed, and funds are not locked. Payment does
          not automatically verify a skill.
        </div>
      </section>
      <section
        className="marketing-container marketing-section organization-feature"
        id="organizations"
        aria-labelledby="organization-title"
      >
        <div>
          <p className="marketing-eyebrow">06 / FOR ORGANIZATIONS</p>
          <h2 id="organization-title">
            Find people who can
            <br />
            actually do the work.
          </h2>
          <p className="marketing-lead">
            Post challenges, review submissions, create paid projects, and issue
            credentials when authorized.
          </p>
          <ButtonLink href="/sign-up?role=company">
            Get Started as an Organization
          </ButtonLink>
        </div>
        <div className="organization-words">
          <span>Challenge.</span>
          <span>Review.</span>
          <span>Recognize.</span>
          <span className="orange">
            Build together.
            <ArrowUpRight size={36} />
          </span>
          <p>
            One ProofPak account connects your organization workspace and your
            own passport.
          </p>
        </div>
      </section>
      <section className="final-editorial" aria-labelledby="final-title">
        <div className="marketing-container">
          <Fingerprint size={44} aria-hidden="true" />
          <p className="marketing-eyebrow">YOUR STORY IS STILL BEING BUILT.</p>
          <h2 id="final-title">
            Your next opportunity
            <br />
            starts here.
          </h2>
          <p>
            Create your Skill Passport and start building a record of what you
            can do.
          </p>
          <ButtonLink href="/sign-up?role=talent">
            Create My Passport
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
