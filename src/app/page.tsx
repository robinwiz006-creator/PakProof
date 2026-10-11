import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Code2,
  Fingerprint,
  ShieldCheck,
  Users,
  FileCheck2,
  GraduationCap,
  Link2,
} from "lucide-react";
import { ButtonLink, ChallengeCard, Tags } from "@/components/ui";
import { challenges } from "@/lib/data";
import type { Challenge } from "@/lib/types";
import { isConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  let featured: Challenge[] = [];
  let challengesUnavailable = false;
  try {
    featured = await challenges();
  } catch {
    challengesUnavailable = true;
  }
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> YOUR WORK. YOUR OPPORTUNITY.
          </p>
          <h1>
            You have the skills.
            <br />
            <span>Now show the proof.</span>
          </h1>
          <p className="hero-description">
            Build a shareable profile of your skills, projects, and
            achievements. Get recognized for real work and discovered by
            companies looking for talent.
          </p>
          <div className="button-row">
            <ButtonLink href="/sign-up?role=talent">
              Build Your Skill Passport
            </ButtonLink>
            <ButtonLink secondary href="/sign-up?role=company">
              Find Proven Talent
            </ButtonLink>
          </div>
          <p className="hero-note">
            <Check size={15} /> Built for emerging talent. Backed by real work.
          </p>
        </div>
        <div className="passport-preview">
          <div className="preview-top">
            <span>
              <Fingerprint size={18} /> SKILL PASSPORT
            </span>
            <span className="tag">DEMO PROFILE</span>
          </div>
          <div className="preview-person">
            <div className="avatar large">AK</div>
            <div>
              <h2>Ayesha Khan</h2>
              <p>Frontend developer</p>
              <span className="muted">NUST · Islamabad, Pakistan</span>
            </div>
            <ArrowUpRight className="preview-arrow" />
          </div>
          <Tags values={["React", "TypeScript", "UI design"]} />
          <div className="preview-project">
            <div className="project-icon">
              <Code2 size={22} />
            </div>
            <div>
              <span className="eyebrow">SELF-REPORTED PROJECT</span>
              <h3>Campus expense tracker</h3>
              <p className="muted">
                Responsive interface · Accessible components
              </p>
            </div>
          </div>
          <div className="preview-bottom">
            <span>
              <ShieldCheck size={16} /> Company recognition appears after review
            </span>
            <Link href={isConfigured() ? "/sign-up" : "/talent/ayesha-khan"}>
              {isConfigured() ? "Start your passport" : "View sample"} ↗
            </Link>
          </div>
        </div>
      </section>
      <section className="home-problem" aria-labelledby="problem-heading">
        <div className="container problem-layout">
          <div>
            <p className="eyebrow">
              BUILT WITH PAKISTAN’S EMERGING TALENT IN MIND
            </p>
            <h2 id="problem-heading">
              Talent is everywhere. Opportunity isn&apos;t.
            </h2>
            <p className="muted">
              A student in Lahore, a graduate in Islamabad, or a freelancer in
              Karachi may have useful skills long before they have a long CV.
              Their work needs a place where people can see it.
            </p>
          </div>
          <dl className="problem-list">
            <div>
              <dt>Skills without proof</dt>
              <dd>
                Show the project behind a skill, with links and an explanation
                of your work.
              </dd>
            </div>
            <div>
              <dt>Work scattered across platforms</dt>
              <dd>
                Bring projects, skills, and achievements together in one
                shareable profile.
              </dd>
            </div>
            <div>
              <dt>Experience is hard to demonstrate</dt>
              <dd>
                Give early-career talent a way to show what they have built,
                even before their first job.
              </dd>
            </div>
            <div>
              <dt>Practical ability is hard to assess</dt>
              <dd>
                Help companies review evidence and recognize work through
                SkillBoard challenges.
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section
        className="container section passport-section"
        aria-labelledby="passport-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR PROOFPAK SKILL PASSPORT</p>
            <h2 id="passport-heading">
              One profile. Your work, skills, and achievements.
            </h2>
          </div>
        </div>
        <div className="passport-layout">
          <div className="passport-records">
            <p className="muted">
              Share your progress with collaborators, mentors, clients, and
              companies. Your passport gives them the evidence behind your work.
            </p>
            <article>
              <Code2 size={22} />
              <div>
                <h3>Your projects and skills</h3>
                <p>
                  Self-reported by you, supported by repositories, demos, and
                  evidence links. Adding a skill does not make it verified.
                </p>
              </div>
            </article>
            <article>
              <FileCheck2 size={22} />
              <div>
                <h3>Company-approved achievements</h3>
                <p>
                  Issued when a company approves your SkillBoard submission.
                  These are clearly separated from work you add yourself.
                </p>
              </div>
            </article>
            <article>
              <GraduationCap size={22} />
              <div>
                <h3>
                  Credentials from other issuers{" "}
                  <span className="tag">FUTURE VISION</span>
                </h3>
                <p>
                  We plan to support credentials from universities, training
                  institutions, and other organizations. Issuance by these
                  organizations is not available yet.
                </p>
              </div>
            </article>
          </div>
          <div
            className="passport-example"
            aria-label="Illustrative public skill passport"
          >
            <div className="preview-top">
              <span>
                <Fingerprint size={18} /> PUBLIC SKILL PASSPORT
              </span>
              <span className="tag">ILLUSTRATIVE PROFILE</span>
            </div>
            <div className="preview-person">
              <div className="avatar large">AK</div>
              <div>
                <h3>Ayesha Khan</h3>
                <p>Frontend developer · Islamabad</p>
                <span className="muted">
                  Building accessible tools for everyday problems.
                </span>
              </div>
            </div>
            <div className="passport-example-skills">
              <span className="record-label">SELF-REPORTED SKILLS</span>
              <Tags values={["React", "TypeScript", "Accessibility"]} />
            </div>
            <div className="passport-evidence">
              <Code2 size={20} />
              <div>
                <span className="record-label">SELF-REPORTED PROJECT</span>
                <h3>Campus expense tracker</h3>
                <p>
                  A responsive interface for keeping track of shared student
                  expenses.
                </p>
                <span className="evidence-caption">
                  <Link2 size={14} /> Repository, demo, and explanation belong
                  here
                </span>
              </div>
            </div>
            <div className="passport-recognition">
              <ShieldCheck size={20} />
              <div>
                <h3>Company-approved achievements</h3>
                <p>
                  No company-approved achievements in this example. Recognition
                  appears after a company reviews and approves submitted work.
                </p>
              </div>
            </div>
            <p className="passport-example-note">
              Design example only · No real achievement or onchain proof is
              shown.
            </p>
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE SKILLBOARD CHALLENGE PROCESS</p>
            <h2>From a practical brief to company recognition.</h2>
          </div>
          <p className="muted">
            One way to add recognized work
            <br />
            to your ProofPak skill passport.
          </p>
        </div>
        <div className="steps">
          <article>
            <span className="step-number">01</span>
            <h3>Pick a meaningful challenge</h3>
            <p>
              Work on a practical brief from a company. Understand the skills,
              deliverables, and deadline before you begin.
            </p>
          </article>
          <article>
            <span className="step-number">02</span>
            <h3>Show how you solve it</h3>
            <p>
              Submit your project and explain your decisions. Give reviewers the
              evidence behind your work.
            </p>
          </article>
          <article>
            <span className="step-number">03</span>
            <h3>Build your skill passport</h3>
            <p>
              After approval, the company issues an achievement for your
              passport. Its Solana proof can then be recorded and checked.
            </p>
          </article>
        </div>
      </section>
      <section
        className={`container section home-challenges ${!featured.length ? "home-challenges-compact" : ""}`}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">A PLACE TO START</p>
            <h2>Small challenges. Real potential.</h2>
          </div>
          <Link className="text-link" href="/challenges">
            Explore challenges <ArrowUpRight size={18} />
          </Link>
        </div>
        {!isConfigured() && (
          <p className="demo-label">Example briefs · Demonstration companies</p>
        )}
        {challengesUnavailable && (
          <div className="notice" role="status">
            Challenges are temporarily unavailable. Please try again later.
          </div>
        )}
        {!challengesUnavailable && !featured.length && (
          <p className="muted">
            New challenges will appear here as companies publish their briefs.
          </p>
        )}
        {featured.length > 0 && (
          <div className="challenge-grid">
            {featured.slice(0, 2).map((c) => (
              <ChallengeCard key={c.id} challenge={c} />
            ))}
          </div>
        )}
      </section>
      <section className="container company-band">
        <div>
          <p className="eyebrow">MEET SKILLBOARD</p>
          <h2>
            Discover the person
            <br />
            behind the résumé.
          </h2>
          <p>
            SkillBoard is the company side of ProofPak. Discover candidates
            through the evidence behind their work.
          </p>
          <ButtonLink href="/sign-up?role=company">
            Start with a challenge
          </ButtonLink>
        </div>
        <div className="company-benefits">
          {[
            [Code2, "Publish practical challenges"],
            [Users, "Review submissions and their evidence"],
            [FileCheck2, "Recognize good work with an achievement"],
          ].map(([Icon, text], i) => {
            const C = Icon as typeof Users;
            return (
              <div key={i}>
                <C size={22} />
                <span>{text as string}</span>
                <Check size={18} />
              </div>
            );
          })}
        </div>
      </section>
      <section className="container home-proof" aria-labelledby="proof-heading">
        <div>
          <p className="eyebrow">SOLANA DEVNET · RECORD VERIFICATION</p>
          <h2 id="proof-heading">Proof that can be checked.</h2>
          <p className="muted">
            A record you can inspect, with a clear limit to what it proves.
          </p>
        </div>
        <div className="proof-explanation">
          <ol>
            <li>A company approves an achievement.</li>
            <li>
              ProofPak records a cryptographic hash of the achievement on
              Solana.
            </li>
            <li>
              Anyone with access to the record can check that it matches the
              onchain proof.
            </li>
          </ol>
          <p>
            Today, this uses Solana devnet. The hash is a digital fingerprint of
            the record; personal details stay offchain. Solana does not
            independently verify someone’s skills, university qualifications, or
            an issuer’s truthfulness.
          </p>
        </div>
      </section>
      <section className="container home-final" aria-labelledby="final-heading">
        <div>
          <p className="eyebrow">START WITH THE WORK YOU CAN SHOW</p>
          <h2 id="final-heading">Make your next project part of your story.</h2>
          <p className="muted">
            Build your passport, or give someone a practical challenge to grow
            it.
          </p>
        </div>
        <div className="button-row">
          <ButtonLink href="/sign-up?role=talent">
            Build my skill passport
          </ButtonLink>
          <ButtonLink secondary href="/sign-up?role=company">
            Publish a challenge
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
