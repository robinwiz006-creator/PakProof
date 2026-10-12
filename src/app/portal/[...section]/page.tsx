import { portalDataNeeds } from "@/lib/portal-data-needs";
import { SkillPicker } from "@/components/skill-picker";
import Link from "next/link";
import { passportSteps } from "@/lib/passport";
import { ProjectEditor } from "@/components/project-editor";
import { RemoveProject, SharePassport } from "@/components/passport-actions";
import { PassportView, EvidenceLinks } from "@/components/passport-view";
import { notFound, redirect } from "next/navigation";
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
import { isConfigured, supabase, currentUser } from "@/lib/supabase/server";
import {
  saveProfile,
  saveCompany,
  previewPassport,
  saveAchievementSharing,
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
  "talent:passport": "My skill passport.",
  "talent:preview": "Preview my passport.",
  "talent:achievements": "My achievements.",
  "talent:settings": "Account settings.",
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
    const user = await currentUser();
    if (!user) redirect("/sign-in");
    const needs = portalDataNeeds(role, section);
    const [profileResult, memberResult, pr, ac, su] = await Promise.all([
      db.from("profiles").select("*").eq("id", user.id).single(),
      role === "company"
        ? db
            .from("company_memberships")
            .select("company_id,role,companies(*)")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [], error: null }),
      needs.projects
        ? db
            .from("projects")
            .select("*")
            .eq("talent_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      needs.achievements
        ? db
            .from("achievements")
            .select(
              section === ""
                ? "id"
                : "*,companies(name),blockchain_proofs(*),achievement_claims(*),achievement_evidence(*),achievement_sharing(*)",
            )
            .eq("talent_id", user.id)
            .order("issued_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      needs.submissions
        ? db
            .from("challenge_submissions")
            .select(
              section === ""
                ? "id,talent_id,status"
                : "*,challenges(*,companies(name)),submission_reviews(*)",
            )
            .eq("talent_id", user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResult.error)
      throw new Error("Your profile could not be loaded. Please try again.");
    if (memberResult.error)
      throw new Error("Company membership could not be loaded.");
    profile = profileResult.data;
    const members = memberResult.data ?? [];
    membershipIds = members.map((m) => m.company_id);
    const first = members[0]?.companies;
    company = (Array.isArray(first) ? first[0] : first) as Company | null;
    if (pr.error || ac.error || su.error)
      throw new Error("Passport data could not be loaded.");
    projects = pr.data ?? [];
    achievements = (ac.data ?? []) as Achievement[];
    submissions = (su.data ?? []) as Submission[];
    if (
      role === "company" &&
      membershipIds.length &&
      ["", "challenges", "reviews"].includes(section)
    ) {
      const [ch, su, ah] = await Promise.all([
        section !== "reviews"
          ? db
              .from("challenges")
              .select(
                section === "" ? "id,status,deadline" : "*,companies(name)",
              )
              .in("company_id", membershipIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        section !== "challenges"
          ? db
              .from("challenge_submissions")
              .select(
                section === ""
                  ? "id,talent_id,status,challenges!inner(company_id)"
                  : "*,challenges!inner(*),profiles(*),submission_reviews(*)",
              )
              .in("challenges.company_id", membershipIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        section === "reviews"
          ? db
              .from("achievements")
              .select(
                "*,companies(name),blockchain_proofs(*),achievement_claims(*),achievement_evidence(*),achievement_sharing(*)",
              )
              .in("company_id", membershipIds)
              .order("issued_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (ch.error || su.error || ah.error)
        throw new Error("Company workflow could not be loaded.");
      ownChallenges = (ch.data ?? []) as Challenge[];
      submissions = (su.data ?? []) as Submission[];
      achievements = ah.data ?? [];
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
  const nextPassportStep = passportSteps(profile, projects).find(
    (step) => !step.done,
  );
  const approved = submissions.filter((s) => s.status === "approved");
  return (
    <div>
      <PageHeading
        eyebrow={role === "company" ? "COMPANY WORKSPACE" : "TALENT WORKSPACE"}
        title={titles[`${role}:${section}`]}
        description={
          role === "company"
            ? "Practical challenges. Thoughtful reviews. Talent you can get to know."
            : `Welcome${live ? `, ${profile.full_name.split(" ")[0]}` : " to the demo"}. Create your passport at your own pace. Challenges are optional.`
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
      {role === "talent" && (section === "" || section === "passport") && (
        <section className="panel">
          <h2>Your passport progress</h2>
          <p className="muted">
            {passportSteps(profile, projects).filter((s) => s.done).length} of 6
            steps complete · {profile.is_public ? "Public" : "Private"}.
            Optional details can be added later.
          </p>
          <ol className="passport-checklist">
            {passportSteps(profile, projects).map((step) => (
              <li key={step.label}>
                <span aria-label={step.done ? "Complete" : "Not yet complete"}>
                  {step.done ? "✓" : "○"}
                </span>
                {step.label === "Preview your passport" && live ? (
                  <form action={previewPassport}>
                    <button className="text-link">{step.label}</button>
                  </form>
                ) : (
                  <Link href={step.href}>{step.label}</Link>
                )}
              </li>
            ))}
          </ol>
          {profile.is_public && <SharePassport slug={profile.slug} />}
        </section>
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
                : "Build a passport you can share."}
            </h2>
            <p className="muted">
              {role === "company"
                ? "Make the work, evaluation criteria, and deliverables clear. Review each submission with useful feedback."
                : "Add your skills, projects, and evidence. Preview your passport, then publish when you are ready. You do not need a company challenge."}
            </p>
            <div className="button-row section-spacer">
              <ButtonLink
                href={
                  role === "company"
                    ? `/portal/company/${company ? "create" : "profile"}`
                    : (nextPassportStep?.href ?? "/portal/talent/passport")
                }
              >
                {role === "company"
                  ? company
                    ? "Create a challenge"
                    : "Create company profile"
                  : (nextPassportStep?.label ?? "Open my passport")}
              </ButtonLink>
              <ButtonLink
                secondary
                href={`/portal/${role}/${role === "company" ? "reviews" : "passport"}`}
              >
                {role === "company" ? "Review submissions" : "Open my passport"}
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
                Achievements appear after approval. Next: record an approved
                achievement on Solana from the review workspace.
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
            <SkillPicker value={profile.skills.join(", ")} />
            <label className="checkbox">
              <input
                type="checkbox"
                name="is_public"
                defaultChecked={profile.is_public}
              />
              Publish my profile, projects, and achievements
            </label>
            <p className="muted">
              Approved submission evidence stays private unless you choose to
              share it in My Achievements. Company reviewers can see your
              profile and submitted work, but not unrelated private projects.
            </p>
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
            {canWrite ? (
              <ProjectEditor />
            ) : (
              <p className="muted">
                Connect Supabase and sign in to add or edit projects. The
                examples below are read-only.
              </p>
            )}
          </section>
          {projects.map((project) => (
            <section className="panel" key={project.id}>
              <h3>{project.title}</h3>
              <p className="muted">{project.description}</p>
              <Tags values={project.skills ?? []} />
              <EvidenceLinks project={project} />
              {canWrite && (
                <>
                  <details className="section-spacer">
                    <summary>Edit project</summary>
                    <ProjectEditor project={project} />
                  </details>
                  <div className="section-spacer">
                    <RemoveProject id={project.id} />
                  </div>
                </>
              )}
              <Link
                className="text-link section-spacer"
                href={`/portal/talent/preview#project-${project.id}`}
              >
                Preview on my passport ↗
              </Link>
            </section>
          ))}
          {!projects.length && (
            <Empty title="Start with something you’ve built">
              A class project, a personal tool, or freelance work can all belong
              in your passport.
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
              {s.status === "approved" && (
                <Link
                  className="text-link section-spacer"
                  href="/portal/talent/achievements"
                >
                  Your achievement is in your passport. Manage evidence sharing
                  ↗
                </Link>
              )}
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
      {role === "talent" &&
        (section === "passport" || section === "preview") && (
          <>
            <div className="button-row section-spacer">
              <ButtonLink href="/portal/talent/profile">
                {profile.is_public ? "Manage visibility" : "Publish passport"}
              </ButtonLink>
              <ButtonLink secondary href="/portal/talent/projects">
                Add or edit projects
              </ButtonLink>
            </div>
            {section === "preview" &&
              live &&
              !profile.passport_previewed_at && (
                <form className="section-spacer" action={previewPassport}>
                  <SubmitButton>Mark preview complete</SubmitButton>
                </form>
              )}
            <section className="section-spacer">
              <PassportView
                profile={profile}
                projects={projects}
                achievements={achievements}
                preview
              />
            </section>
          </>
        )}
      {role === "talent" && section === "achievements" && (
        <>
          <p className="notice">
            Company-approved facts cannot be edited. You control whether
            approved evidence is shared publicly. Your passport must also be
            public.
          </p>
          {achievements.map((a) => (
            <section className="panel" key={a.id}>
              <AchievementCard achievement={a} />
              {canWrite && (
                <form className="form" action={saveAchievementSharing}>
                  <input type="hidden" name="achievement_id" value={a.id} />
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="share_evidence"
                      defaultChecked={
                        a.achievement_sharing?.share_evidence ?? false
                      }
                    />
                    Share the approved submission links and explanation on my
                    public passport
                  </label>
                  <label className="field">
                    Related portfolio project (optional)
                    <select
                      name="project_id"
                      defaultValue={a.achievement_sharing?.project_id ?? ""}
                    >
                      <option value="">No related project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="muted">
                    This links an existing project; it does not copy it or
                    change the approved work.
                  </p>
                  <SubmitButton>Save sharing choices</SubmitButton>
                </form>
              )}
            </section>
          ))}
          {!achievements.length && (
            <Empty title="Your passport is useful before your first achievement">
              Keep adding projects. Company challenges are an optional way to
              earn recognition.{" "}
              <Link href="/portal/talent/passport">Open my passport</Link>
            </Empty>
          )}
        </>
      )}
      {role === "talent" && section === "settings" && (
        <section className="panel">
          <h2>Account access</h2>
          <p className="muted">
            One ProofPak account works for your personal passport and company
            workspace.
          </p>
          <div className="button-row section-spacer">
            <Link className="text-link" href="/forgot-password">
              Reset password
            </Link>
            <Link className="text-link" href="/resend-confirmation">
              Resend confirmation email
            </Link>
            <Link className="text-link" href="/portal/talent/profile">
              Edit profile and privacy
            </Link>
          </div>
        </section>
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
                <form className="form section-spacer" action={reviewSubmission}>
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
                    <select name="decision" required defaultValue="">
                      <option value="">Choose a decision</option>
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
            each passport to inspect project evidence and company achievements.
          </p>
        </>
      )}
    </div>
  );
}
