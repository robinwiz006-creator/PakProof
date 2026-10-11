import { notFound } from "next/navigation";
import { publicPassport } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/server";
import { Tags, DemoNotice, Empty, AchievementCard } from "@/components/ui";
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await publicPassport(slug);
  if (!data) notFound();
  const { profile: p, projects, achievements } = data;
  return (
    <div className="container page">
      {!isConfigured() && <DemoNotice />}
      <p className="eyebrow">PUBLIC SKILL PASSPORT</p>
      <div className="profile-header">
        <div className="avatar large">
          {p.full_name
            .split(" ")
            .slice(0, 2)
            .map((v) => v[0])
            .join("")}
        </div>
        <div>
          <h1>{p.full_name}</h1>
          <p>{p.headline}</p>
          <span className="muted">
            {[p.university, p.location].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <div className="profile-columns">
        <aside>
          <section className="panel">
            <h3>About</h3>
            <p className="muted">
              {p.bio || "This person hasn’t added a bio yet."}
            </p>
            <h3 className="section-spacer">Skills</h3>
            <Tags values={p.skills} />
          </section>
          <p className="muted">
            ProofPak displays project evidence and company recognition.
            Individual skills are self-reported unless supported by an
            achievement.
          </p>
        </aside>
        <div>
          <section>
            <h2>Company achievements</h2>
            {achievements.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
            {!achievements.length && (
              <Empty title="The next chapter is still being built">
                No company-approved achievements have been issued yet.
              </Empty>
            )}
          </section>
          <section className="section-spacer">
            <h2>Project evidence</h2>
            {projects.map((p) => (
              <article key={p.id} className="panel section-spacer">
                <h3>{p.title}</h3>
                <p className="muted">{p.description}</p>
                <div className="button-row section-spacer">
                  {[
                    ["GitHub", p.github_url],
                    ["Live demo", p.demo_url],
                    ["Supporting evidence", p.evidence_url],
                  ]
                    .filter(([, url]) => url)
                    .map(([name, url]) => (
                      <a
                        className="text-link"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={name}
                      >
                        {name} ↗
                      </a>
                    ))}
                </div>
              </article>
            ))}
            {!projects.length && (
              <Empty title="No projects yet">
                Project evidence will appear when the profile owner adds it.
              </Empty>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
