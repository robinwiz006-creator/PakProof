import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Code2,
  Fingerprint,
  ShieldCheck,
  Users,
  Sparkles,
} from "lucide-react";
import { ButtonLink, ChallengeCard, Tags } from "@/components/ui";
import { challenges } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const featured = await challenges();
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
            Turn projects and practical challenges into a skill passport. Help
            the right people discover what you can do.
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
              <span className="eyebrow">PROJECT EVIDENCE</span>
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
      <section className="principle-strip">
        <div className="container">
          <span>A better signal than a line on a CV.</span>
          <span>
            <Code2 size={18} /> Real projects
          </span>
          <span>
            <Users size={18} /> Company challenges
          </span>
          <span>
            <ShieldCheck size={18} /> Verifiable records
          </span>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FROM POTENTIAL TO PROOF</p>
            <h2>Let your work open doors.</h2>
          </div>
          <p className="muted">
            You shouldn’t need an impressive network
            <br />
            to show you can do impressive work.
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
              Company-approved work becomes an achievement. Onchain records make
              that achievement independently inspectable.
            </p>
          </article>
        </div>
      </section>
      <section className="container section">
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
        {!featured.length && (
          <p className="muted">
            New challenges will appear here as companies publish their briefs.
          </p>
        )}
        <div className="challenge-grid">
          {featured.slice(0, 2).map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
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
            Publish a practical challenge. Review real work.
            <br />
            Recognize talent you might otherwise miss.
          </p>
          <ButtonLink href="/sign-up?role=company">
            Start with a challenge
          </ButtonLink>
        </div>
        <div className="company-benefits">
          {[
            [Users, "Find talent through evidence"],
            [Code2, "Review the work, not just the CV"],
            [Sparkles, "Help emerging talent get recognized"],
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
    </>
  );
}
