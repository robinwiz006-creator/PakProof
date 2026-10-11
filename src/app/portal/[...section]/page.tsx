import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalNav } from "@/components/portal-nav";
import {
  PageHeading,
  DemoNotice,
  Empty,
  ButtonLink,
  AchievementCard,
  Tags,
} from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { ChallengeBrowser } from "@/components/challenge-browser";
import { ProofAnchor } from "@/components/proof-anchor";
import { demoProfile, demoProjects, demoChallenges } from "@/lib/demo";
import { isConfigured, supabase } from "@/lib/supabase/server";
import {
  saveProfile,
  saveCompany,
  addProject,
  deleteProject,
  createChallenge,
  closeChallenge,
  reviewSubmission,
  signOut,
} from "@/lib/actions";
import { challenges } from "@/lib/data";
import type {
  Profile,
  Company,
  Challenge,
  Project,
  Submission,
  Achievement,
} from "@/lib/types";
export const dynamic = "force-dynamic";
const titles: Record<string, string> = {
  "talent:": "Your work. Your next opportunity.",
  "talent:profile": "Make your profile yours.",
  "talent:projects": "Show what you’ve built.",
  "talent:browse": "Find your next challenge.",
  "talent:submissions": "Keep your work moving.",
  "talent:passport": "Your skill passport.",
  "company:": "A clearer view of emerging talent.",
  "company:profile": "Introduce your company.",
  "company:create": "Publish a practical challenge.",
  "company:challenges": "Your challenges, in one place.",
  "company:reviews": "Recognize the work behind the talent.",
  "company:directory": "Discover people through their work.",
};
export default async function Portal({
  params,
  searchParams,
}: {
  params: Promise<{ section: string[] }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { section: parts } = await params;
  const role = parts[0];
  const section = parts[1] ?? "";
  if (parts.length > 2 || !titles[`${role}:${section}`]) notFound();
  const { message } = await searchParams;
  const live = isConfigured();
  let profile: Profile = demoProfile,
    company: Company | null = null,
    projects: Project[] = demoProjects,
    ownChallenges: Challenge[] = [],
    submissions: Submission[] = [],
    achievements: Achievement[] = [],
    directory: Profile[] = [demoProfile],
    membershipIds: string[] = [];
  if (live) {
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) redirect("/sign-in");
    const { data: p, error: pError } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (pError)
      throw new Error("Apply the Supabase migration to initialize profiles.");
    profile = p;
    const { data: members, error: memberError } = await db
      .from("company_memberships")
      .select("company_id,role,companies(*)")
      .eq("user_id", user.id);
    if (memberError) throw new Error("Company membership could not be loaded.");
    membershipIds = (members ?? []).map((m) => m.company_id);
    const first = members?.[0]?.companies;
    company = (Array.isArray(first) ? first[0] : first) as Company | null;
    const [pr, ac] = await Promise.all([
      db
        .from("projects")
        .select("*")
        .eq("talent_id", user.id)
        .order("created_at", { ascending: false }),
      db
        .from("achievements")
        .select("*,companies(name),blockchain_proofs(*)")
        .eq("talent_id", user.id)
        .order("issued_at", { ascending: false }),
    ]);
    if (pr.error || ac.error)
      throw new Error("Passport data could not be loaded.");
    projects = pr.data ?? [];
    achievements = ac.data ?? [];
    if (role === "company" && membershipIds.length) {
      const [ch, su, ah] = await Promise.all([
        db
          .from("challenges")
          .select("*,companies(name)")
          .in("company_id", membershipIds)
          .order("created_at", { ascending: false }),
        db
          .from("challenge_submissions")
          .select("*,challenges!inner(*),profiles(*),submission_reviews(*)")
          .in("challenges.company_id", membershipIds)
          .order("created_at", { ascending: false }),
        db
          .from("achievements")
          .select("*,companies(name),blockchain_proofs(*)")
          .in("company_id", membershipIds)
          .order("issued_at", { ascending: false }),
      ]);
      if (ch.error || su.error || ah.error)
        throw new Error("Company workflow could not be loaded.");
      ownChallenges = ch.data ?? [];
      submissions = su.data ?? [];
      achievements = ah.data ?? [];
    } else if (role === "talent") {
      const { data: s, error } = await db
        .from("challenge_submissions")
        .select("*,challenges(*,companies(name)),submission_reviews(*)")
        .eq("talent_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error("Submissions could not be loaded.");
      submissions = s ?? [];
    }
    if (section === "directory") {
      const { data: d, error } = await db
        .from("profiles")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error("Talent directory could not be loaded.");
      directory = d ?? [];
    }
  }
  const canWrite = live;
  const approved = submissions.filter((s) => s.status === "approved");
  return (
    <div className="portal">
      <PortalNav role={role} section={section} />
      <div className="portal-content">
        <PageHeading
          eyebrow={
            role === "company" ? "COMPANY WORKSPACE" : "TALENT WORKSPACE"
          }
          title={titles[`${role}:${section}`]}
          description={
            role === "company"
              ? "Practical challenges. Thoughtful reviews. Talent you can get to know."
              : `Welcome${live ? `, ${profile.full_name.split(" ")[0]}` : " to the demo"}. Build a portfolio that speaks for itself.`
          }
          action={
            live ? (
              <form action={signOut}>
                <button className="text-link" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <ButtonLink secondary href="/sign-up">
                Create account
              </ButtonLink>
            )
          }
        />
        {!live && <DemoNotice />}
        {message && (
          <div className="message" role="status">
            {message}
          </div>
        )}
        {section === "" && (
          <>
            <div className="stats">
              {(role === "company"
                ? [
                    [
                      "Active challenges",
                      ownChallenges.filter(
                        (c) =>
                          c.status === "published" &&
                          new Date(c.deadline + "T23:59:59Z") > new Date(),
                      ).length,
                    ],
                    ["Total submissions", submissions.length],
                    [
                      "Pending reviews",
                      submissions.filter((s) => s.status === "pending").length,
                    ],
                  ]
                : [
                    ["Projects", projects.length],
                    ["Submissions", submissions.length],
                    ["Achievements", achievements.length],
                  ]
              ).map(([label, value]) => (
                <div className="stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <section className="panel">
              <p className="eyebrow">YOUR NEXT STEP</p>
              <h2>
                {role === "company"
                  ? company
                    ? "Give talent a meaningful brief."
                    : "Start with your company profile."
                  : "Small projects build a stronger story."}
              </h2>
              <p className="muted">
                {role === "company"
                  ? "Make the work, evaluation criteria, and deliverables clear. Review each submission with useful feedback."
                  : "Add evidence to your profile, then find a challenge that matches the skills you want to demonstrate."}
              </p>
              <div className="button-row section-spacer">
                <ButtonLink
                  href={
                    role === "company"
                      ? `/portal/company/${company ? "create" : "profile"}`
                      : "/portal/talent/browse"
                  }
                >
                  {role === "company"
                    ? company
                      ? "Create a challenge"
                      : "Create company profile"
                    : "Explore challenges"}
                </ButtonLink>
                <ButtonLink
                  secondary
                  href={`/portal/${role}/${role === "company" ? "reviews" : "profile"}`}
                >
                  {role === "company"
                    ? "Review submissions"
                    : "Edit my profile"}
                </ButtonLink>
              </div>
            </section>
            {role === "company" ? (
              <section className="panel">
                <h3>
                  {new Set(approved.map((s) => s.talent_id)).size} approved
                  candidates
                </h3>
                <p className="muted">
                  Achievements appear after approval. Add an onchain proof from
                  the review workspace.
                </p>
              </section>
            ) : (
              <section className="panel">
                <h3>Your public passport</h3>
                <p className="muted">
                  {profile.is_public
                    ? "Your profile is shareable."
                    : "Your profile is private until you choose to publish it."}
                </p>
                {(!live || profile.is_public) && (
                  <Link
                    className="text-link section-spacer"
                    href={`/talent/${profile.slug}`}
                  >
                    View passport ↗
                  </Link>
                )}
              </section>
            )}
          </>
        )}
        {role === "talent" && section === "profile" && (
          <section className="panel">
            <form className="form" action={saveProfile}>
              <div className="form-grid">
                <Field
                  label="Full name"
                  name="full_name"
                  value={profile.full_name}
                  required
                  maxLength={100}
                />
                <Field
                  label="Public URL slug"
                  name="slug"
                  value={profile.slug}
                  required
                  hint="Lowercase letters, numbers, and hyphens."
                />
              </div>
              <Field
                label="Headline"
                name="headline"
                value={profile.headline}
                required
                maxLength={160}
              />
              <div className="form-grid">
                <Field
                  label="University or institution"
                  name="university"
                  value={profile.university}
                />
                <Field
                  label="Location"
                  name="location"
                  value={profile.location}
                />
              </div>
              <Field
                label="About you"
                name="bio"
                type="textarea"
                value={profile.bio}
                maxLength={2000}
              />
              <Field
                label="Skills"
                name="skills"
                value={profile.skills.join(", ")}
                hint="Separate skills with commas."
              />
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="is_public"
                  defaultChecked={profile.is_public}
                />
                Publish my profile, projects, and achievements
              </label>
              {canWrite ? (
                <SubmitButton>Save profile</SubmitButton>
              ) : (
                <p className="muted">
                  Connect Supabase and sign in to save your profile.
                </p>
              )}
            </form>
          </section>
        )}
        {role === "company" && section === "profile" && (
          <section className="panel">
            <form className="form" action={saveCompany}>
              {company && (
                <input type="hidden" name="company_id" value={company.id} />
              )}
              <Field
                label="Company name"
                name="name"
                value={company?.name}
                required
                maxLength={120}
              />
              <Field
                label="What your company does"
                name="description"
                type="textarea"
                value={company?.description}
                required
                minLength={20}
              />
              <div className="form-grid">
                <Field
                  label="Website"
                  name="website"
                  type="url"
                  value={company?.website}
                />
                <Field
                  label="Location"
                  name="location"
                  value={company?.location}
                  required
                />
              </div>
              {canWrite ? (
                <SubmitButton>
                  {company ? "Save company profile" : "Create company profile"}
                </SubmitButton>
              ) : (
                <p className="muted">
                  Connect Supabase and sign in to create your company.
                </p>
              )}
            </form>
            <p className="muted section-spacer">
              Company profiles are self-registered. ProofPak does not certify a
              company’s legal identity. Membership management is reserved for a
              later release.
            </p>
          </section>
        )}
        {role === "talent" && section === "projects" && (
          <>
            <section className="panel">
              <h2>Add a project</h2>
              <form className="form" action={addProject}>
                <Field
                  label="Project title"
                  name="title"
                  required
                  minLength={3}
                  maxLength={160}
                />
                <Field
                  label="What you built and why"
                  name="description"
                  type="textarea"
                  required
                  minLength={20}
                />
                <div className="form-grid">
                  <Field label="GitHub link" name="github_url" type="url" />
                  <Field label="Demo link" name="demo_url" type="url" />
                </div>
                <Field
                  label="Supporting evidence URL"
                  name="evidence_url"
                  type="url"
                  hint="Link to a document, notebook, or case study you are comfortable sharing. Add at least one link."
                />
                {canWrite ? (
                  <SubmitButton>Add project</SubmitButton>
                ) : (
                  <p className="muted">
                    Sign in with Supabase connected to save project evidence.
                  </p>
                )}
              </form>
            </section>
            {projects.map((p) => (
              <section className="panel" key={p.id}>
                <h3>{p.title}</h3>
                <p className="muted">{p.description}</p>
                {canWrite && (
                  <form className="section-spacer" action={deleteProject}>
                    <input type="hidden" name="project_id" value={p.id} />
                    <button className="text-link" type="submit">
                      Remove project
                    </button>
                  </form>
                )}
              </section>
            ))}
            {!projects.length && (
              <Empty title="Your first project starts here">
                Show something you’ve built, including what you learned.
              </Empty>
            )}
          </>
        )}
        {role === "talent" && section === "browse" && (
          <ChallengeBrowser items={await challenges()} />
        )}
        {role === "talent" && section === "submissions" && (
          <>
            {submissions.map((s) => (
              <section key={s.id} className="panel">
                <div className="list-row">
                  <div>
                    <h3>{s.challenges?.title}</h3>
                    <p className="muted">{s.challenges?.companies?.name}</p>
                  </div>
                  <span className="tag">{s.status.replaceAll("_", " ")}</span>
                </div>
                <p className="muted section-spacer">{s.explanation}</p>
                {s.submission_reviews
                  ?.sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((r, i) => (
                    <div className="notice section-spacer" key={i}>
                      <strong>{r.decision.replaceAll("_", " ")}</strong>
                      <p>{r.feedback}</p>
                    </div>
                  ))}
                {s.status === "needs_improvement" && (
                  <Link
                    className="text-link section-spacer"
                    href={`/challenges/${s.challenge_id}#submit`}
                  >
                    Revise and resubmit ↗
                  </Link>
                )}
              </section>
            ))}
            {!submissions.length && (
              <Empty title="No submissions yet">
                <Link href="/challenges">Find a challenge</Link>, build your
                solution, and submit your evidence.
              </Empty>
            )}
          </>
        )}
        {role === "talent" && section === "passport" && (
          <>
            <section className="panel">
              <h2>{profile.full_name}</h2>
              <p className="muted">{profile.headline}</p>
              <div className="section-spacer">
                <Tags values={profile.skills} />
              </div>
              {profile.is_public ? (
                <Link
                  className="text-link section-spacer"
                  href={`/talent/${profile.slug}`}
                >
                  Open shareable passport ↗
                </Link>
              ) : (
                <Link
                  className="text-link section-spacer"
                  href="/portal/talent/profile"
                >
                  Publish your profile to share it ↗
                </Link>
              )}
            </section>
            {achievements.map((a) => (
              <AchievementCard key={a.id} achievement={a} />
            ))}
            {!achievements.length && (
              <Empty title="Build toward your first achievement">
                Company-approved submissions will appear here. A pending onchain
                proof is clearly marked.
              </Empty>
            )}
          </>
        )}
        {role === "company" && section === "create" && (
          <>
            {live && !company ? (
              <Empty title="Introduce your company first">
                <Link href="/portal/company/profile">
                  Create a company profile
                </Link>{" "}
                before publishing a challenge.
              </Empty>
            ) : (
              <section className="panel">
                <form className="form" action={createChallenge}>
                  <input
                    type="hidden"
                    name="company_id"
                    value={company?.id ?? ""}
                  />
                  <Field
                    label="Challenge title"
                    name="title"
                    required
                    minLength={5}
                    maxLength={160}
                  />
                  <Field
                    label="The brief and evaluation criteria"
                    name="description"
                    type="textarea"
                    required
                    minLength={30}
                  />
                  <Field
                    label="Required skills"
                    name="skills"
                    required
                    hint="Separate skills with commas."
                  />
                  <div className="form-grid">
                    <label className="field">
                      Difficulty
                      <select name="difficulty">
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                      </select>
                    </label>
                    <Field
                      label="Submission deadline (UTC)"
                      name="deadline"
                      type="date"
                      required
                    />
                  </div>
                  <Field
                    label="Expected deliverables"
                    name="deliverables"
                    type="textarea"
                    required
                    minLength={20}
                  />
                  <p className="muted">
                    Use a fair, time-bounded brief. Don’t request private
                    information or unpaid production work.
                  </p>
                  {canWrite ? (
                    <SubmitButton>Publish challenge</SubmitButton>
                  ) : (
                    <p className="muted">
                      Connect Supabase and create a company account to publish.
                    </p>
                  )}
                </form>
              </section>
            )}
          </>
        )}
        {role === "company" && section === "challenges" && (
          <>
            {(live ? ownChallenges : demoChallenges).map((c) => (
              <section className="panel" key={c.id}>
                <div className="list-row">
                  <div>
                    <h3>{c.title}</h3>
                    <p className="muted">
                      Deadline: {c.deadline} · {c.status}
                    </p>
                  </div>
                  <Link className="text-link" href={`/challenges/${c.id}`}>
                    View brief ↗
                  </Link>
                </div>
                {live && c.status === "published" && (
                  <form className="section-spacer" action={closeChallenge}>
                    <input type="hidden" name="challenge_id" value={c.id} />
                    <button className="text-link" type="submit">
                      Close submissions
                    </button>
                  </form>
                )}
              </section>
            ))}
            {live && !ownChallenges.length && (
              <Empty title="Publish your first challenge">
                <Link href="/portal/company/create">
                  Create a practical brief
                </Link>{" "}
                to start discovering talent.
              </Empty>
            )}
          </>
        )}
        {role === "company" && section === "reviews" && (
          <>
            {submissions.map((s) => (
              <section className="panel" key={s.id}>
                <p className="eyebrow">{s.challenges?.title}</p>
                <div className="list-row">
                  <div>
                    <h3>{s.profiles?.full_name ?? "Candidate"}</h3>
                    <p className="muted">{s.profiles?.headline}</p>
                  </div>
                  <span className="tag">{s.status.replaceAll("_", " ")}</span>
                </div>
                <p className="muted section-spacer">{s.explanation}</p>
                <div className="button-row section-spacer">
                  {s.project_url && (
                    <a
                      className="text-link"
                      href={s.project_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Project evidence ↗
                    </a>
                  )}
                  {s.github_url && (
                    <a
                      className="text-link"
                      href={s.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub ↗
                    </a>
                  )}
                  {s.profiles?.is_public && (
                    <Link
                      className="text-link"
                      href={`/talent/${s.profiles.slug}`}
                    >
                      Public passport ↗
                    </Link>
                  )}
                </div>
                {s.status === "pending" && (
                  <form
                    className="form section-spacer"
                    action={reviewSubmission}
                  >
                    <input type="hidden" name="submission_id" value={s.id} />
                    <Field
                      label="Feedback for the candidate"
                      name="feedback"
                      type="textarea"
                      required
                      minLength={10}
                    />
                    <label className="field">
                      Review decision
                      <select name="decision">
                        <option value="approved">
                          Approve and issue achievement
                        </option>
                        <option value="needs_improvement">
                          Request improvements
                        </option>
                      </select>
                    </label>
                    <SubmitButton>Save review</SubmitButton>
                  </form>
                )}
                {s.status === "approved" &&
                  achievements
                    .filter((a) => a.submission_id === s.id)
                    .map((a) => (
                      <div className="section-spacer" key={a.id}>
                        <AchievementCard achievement={a} />
                        {!a.blockchain_proofs?.length && (
                          <ProofAnchor achievementId={a.id} />
                        )}
                      </div>
                    ))}
              </section>
            ))}
            {!submissions.length && (
              <Empty title="Ready for thoughtful reviews">
                Submissions to your company’s challenges will appear here.
                Approvals create achievements; a separate wallet transaction
                records their proof on devnet.
              </Empty>
            )}
          </>
        )}
        {role === "company" && section === "directory" && (
          <>
            {directory.map((p) => (
              <Link
                className="panel list-row"
                href={`/talent/${p.slug}`}
                key={p.id}
              >
                <div className="profile-header" style={{ margin: 0 }}>
                  <div className="avatar">
                    {p.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div>
                    <h3>{p.full_name}</h3>
                    <p className="muted">{p.headline}</p>
                    <p className="muted">{p.location}</p>
                    <Tags values={p.skills} />
                  </div>
                </div>
                <span className="text-link">View evidence ↗</span>
              </Link>
            ))}
            {!directory.length && (
              <Empty title="Talent is on its way">
                Only people who publish their profile are listed here.
              </Empty>
            )}
            <p className="muted section-spacer">
              Showing up to 100 public profiles. Skills are self-reported; open
              each passport to inspect project evidence and company
              achievements.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
