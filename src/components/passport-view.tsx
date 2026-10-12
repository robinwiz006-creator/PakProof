import Link from "next/link";
import type { Profile, Project, Achievement } from "@/lib/types";
import { Tags, AchievementCard } from "./ui";
import { SharePassport } from "./passport-actions";
export function EvidenceLinks({
  project,
}: {
  project: Pick<Project, "github_url" | "demo_url" | "evidence_url">;
}) {
  return (
    <div className="button-row section-spacer">
      {[
        ["GitHub", project.github_url],
        ["Live demo", project.demo_url],
        ["Supporting evidence", project.evidence_url],
      ]
        .filter(([, url]) => url)
        .map(([label, url]) => (
          <a
            key={label}
            className="text-link"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {label} ↗
          </a>
        ))}
    </div>
  );
}
export function ApprovedEvidence({
  achievement: a,
  projectHref,
}: {
  achievement: Achievement;
  projectHref?: string;
}) {
  const ev = a.achievement_evidence;
  return (
    <section className="panel">
      <p className="eyebrow">COMPANY-APPROVED WORK</p>
      <h3>{a.title}</h3>
      <p className="muted">
        Approved by{" "}
        {a.achievement_claims?.issuer_name ?? a.companies?.name ?? "Company"} on{" "}
        {new Date(a.issued_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}{" "}
        (UTC).
      </p>
      <p className="muted">
        Source: challenge submission {a.submission_id.slice(0, 8)} · Company
        identities are self-registered.
      </p>
      {ev ? (
        <>
          <details className="section-spacer">
            <summary>Source challenge: {ev.challenge_title}</summary>
            <p className="muted">{ev.challenge_description}</p>
            <p className="muted">Deliverables: {ev.deliverables}</p>
          </details>
          <h3 className="section-spacer">Approved evidence</h3>
          <p className="muted">{ev.explanation}</p>
          <EvidenceLinks
            project={{
              github_url: ev.github_url,
              demo_url: ev.project_url,
              evidence_url: "",
            }}
          />
        </>
      ) : (
        <p className="muted section-spacer">
          The recipient has not made the approved submission evidence public.
        </p>
      )}
      <Link className="text-link section-spacer" href={`/verify/${a.id}`}>
        Check achievement and proof ↗
      </Link>
      {a.achievement_sharing?.project_id && projectHref && (
        <a className="text-link section-spacer" href={projectHref}>
          Related self-reported portfolio project ↓
        </a>
      )}
    </section>
  );
}
export function PassportView({
  profile: p,
  projects,
  achievements,
  preview = false,
}: {
  profile: Profile;
  projects: Project[];
  achievements: Achievement[];
  preview?: boolean;
}) {
  return (
    <>
      <p className="eyebrow">
        {preview
          ? "PRIVATE PREVIEW · ONLY YOU CAN SEE THIS PAGE"
          : "PUBLIC SKILL PASSPORT"}
      </p>
      <div className="profile-header">
        <div className="avatar large">
          {p.full_name
            .split(" ")
            .slice(0, 2)
            .map((v) => v[0])
            .join("")}
        </div>
        <div>
          {preview ? <h2>{p.full_name}</h2> : <h1>{p.full_name}</h1>}
          <p>{p.headline || "Building a skill passport"}</p>
          <span className="muted">
            {[p.university, p.location].filter(Boolean).join(" · ")}
          </span>
          <p className="record-label">PROFILE INFORMATION IS SELF-REPORTED</p>
        </div>
      </div>
      {!preview && <SharePassport slug={p.slug} />}
      {preview && (
        <p className="notice">
          This preview does not publish anything. Approved evidence appears here
          only when you choose to share it.
        </p>
      )}
      <div className="profile-columns">
        <aside>
          {p.bio && (
            <section className="panel">
              <h2>About</h2>
              <p className="muted">{p.bio}</p>
            </section>
          )}
          {p.skills.length > 0 && (
            <section className="panel">
              <h2>Skills</h2>
              <p className="record-label">SELF-REPORTED</p>
              <Tags values={p.skills} />
            </section>
          )}
          <p className="muted">
            Projects and skills are added by the individual. Company approval is
            separate. A matching Solana record does not independently prove
            skill or issuer identity.
          </p>
        </aside>
        <div>
          {projects.length > 0 && (
            <section>
              <h2>Projects</h2>
              {projects.map((pr) => (
                <article
                  id={`project-${pr.id}`}
                  className="panel section-spacer"
                  key={pr.id}
                >
                  <span className="record-label">SELF-REPORTED PROJECT</span>
                  <h3>{pr.title}</h3>
                  <p className="muted">{pr.description}</p>
                  <Tags values={pr.skills ?? []} />
                  <EvidenceLinks project={pr} />
                </article>
              ))}
            </section>
          )}
          {achievements.length > 0 && (
            <section id="achievements" className="section-spacer">
              <h2>Achievements</h2>
              {achievements.map((a) => (
                <div key={a.id} className="section-spacer">
                  <AchievementCard achievement={a} />
                  <ApprovedEvidence
                    achievement={{
                      ...a,
                      achievement_evidence: a.achievement_sharing
                        ?.share_evidence
                        ? a.achievement_evidence
                        : null,
                    }}
                  />
                </div>
              ))}
            </section>
          )}
          {!projects.length && !achievements.length && (
            <p className="notice">
              This passport is starting out. Projects and achievements will
              appear as they are added.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
