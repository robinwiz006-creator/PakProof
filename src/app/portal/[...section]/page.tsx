import { portalDataNeeds } from "@/lib/portal-data-needs";
import { ProfileSetupForm } from "@/components/profile-setup-form";
import { setupSteps, setupStep } from "@/lib/profile-setup";
import Link from "next/link";

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
  saveCompany,
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
  "talent:": "Welcome to your dashboard",
  "talent:activity": "My Activity",
  "talent:profile": "Build my profile",
  "talent:projects": "My projects",
  "talent:browse": "Find your next challenge.",
  "talent:submissions": "Keep your work moving.",
  "talent:passport": "My Profile",
  "talent:preview": "Preview my passport.",
  "talent:achievements": "My achievements.",
  "talent:settings": "Account settings.",
  "company:": "Organization dashboard",
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
  searchParams: Promise<{ message?: string; step?: string; company?: string }>;
}) {
  const { section: parts } = await params;
  const role = parts[0];
  const section = parts[1] ?? "";
  if (parts.length > 2 || !titles[`${role}:${section}`]) notFound();
  const {
    message,
    step: requestedStep,
    company: requestedCompany,
  } = await searchParams;
  const step = setupStep(requestedStep);
  if (role === "talent" && section === "profile" && step === "work")
    redirect("/portal/talent/projects");
  const live = isConfigured();
  let profile: Profile = demoProfile,
    company: Company | null = null,
    projects: Project[] = demoProjects,
    ownChallenges: Challenge[] = [],
    submissions: Submission[] = [],
    achievements: Achievement[] = [],
    directory: Profile[] = [demoProfile],
    membershipIds: string[] = [],
    canManageCompany = false;
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
    if (
      requestedCompany &&
      !members.some((m) => m.company_id === requestedCompany)
    )
      notFound();
    const selectedMember =
      members.find((m) => m.company_id === requestedCompany) ?? members[0];
    const first = selectedMember?.companies;
    company = (Array.isArray(first) ? first[0] : first) as Company | null;
    canManageCompany = selectedMember?.role === "owner";
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
  const approved = submissions.filter((s) => s.status === "approved");
  return (
    <div>
      <PageHeading
        eyebrow={role === "company" ? "ORGANIZATION DASHBOARD" : "MY DASHBOARD"}
        title={titles[`${role}:${section}`]}
        description={
          role === "company"
            ? "Manage your organization, create opportunities and recognize people’s work."
            : `Welcome${live ? `, ${profile.full_name.split(" ")[0]}` : " to the demo"}. Your Skill Passport brings your work and credentials together. Start with your profile.`
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
      {role === "talent" && section === "" && (
        <>
          <section className="dashboard-welcome">
            <p className="eyebrow">YOUR SKILL PASSPORT</p>
            <h2>Start with who you are and what you can do.</h2>
            <p>
              Build a profile you can share. Projects, opportunities and
              credentials can be added over time. No wallet is needed.
            </p>
            <p className="profile-visibility">
              <strong>
                {profile.is_public ? "Public profile" : "Private profile"}
              </strong>{" "}
              ·{" "}
              {profile.is_public
                ? "Your published work can be viewed through your profile link."
                : "Your profile is not public. You choose when to publish it."}
            </p>
          </section>
          <div className="dashboard-actions">
            <Link href="/portal/talent/profile?step=about">
              <span className="eyebrow">01 · START HERE</span>
              <h2>Build my profile</h2>
              <p>
                Add a few details, skills and work, then preview and publish
                your Skill Passport.
              </p>
              <span className="text-link">
                {profile.headline ? "Continue my profile" : "Get started"} →
              </span>
            </Link>
            <Link href="/opportunities">
              <span className="eyebrow">02 · EXPLORE</span>
              <h2>Find opportunities</h2>
              <p>
                Practise with a challenge or apply for a project. Both are
                optional.
              </p>
              <span className="text-link">Explore opportunities →</span>
            </Link>
            <Link href="/my-credentials">
              <span className="eyebrow">03 · YOUR RECORD</span>
              <h2>View my credentials</h2>
              <p>
                Accept credentials from organizations and choose what appears on
                your profile.
              </p>
              <span className="text-link">Open credentials →</span>
            </Link>
          </div>
          <section className="dashboard-next">
            <div>
              <h2>Your profile at a glance</h2>
              <p>
                {profile.skills.length} skills · {projects.length} projects. Add
                what is useful now; you can return later.
              </p>
            </div>
            <div className="button-row">
              <ButtonLink secondary href="/portal/talent/passport">
                View my profile
              </ButtonLink>
              {profile.is_public && <SharePassport slug={profile.slug} />}
            </div>
          </section>
        </>
      )}
      {role === "company" && section === "" && (
        <>
          <section className="dashboard-welcome">
            <h2>What would you like to do?</h2>
            <p>
              Use one organization profile to issue credentials and create
              opportunities. Organization approval is required for issuing
              credentials, not for creating your personal passport.
            </p>
          </section>
          <div className="dashboard-actions">
            <Link href="/organizations">
              <h2>Organization & credentials</h2>
              <p>
                Check your approval status, issue credentials when approved, and
                manage existing records.
              </p>
              <span className="text-link">Open organization →</span>
            </Link>
            <Link href="/portal/company/create">
              <h2>Create a challenge</h2>
              <p>
                An unpaid skill assessment that multiple people can complete.
                Review work and recognize successful submissions.
              </p>
              <span className="text-link">Create challenge →</span>
            </Link>
            <Link href="/paid-projects/new">
              <h2>Post a paid project</h2>
              <p>
                Select one worker, agree on milestones and review their work.
                Payments currently use devnet test tokens, not real money.
              </p>
              <span className="text-link">Create paid project →</span>
            </Link>
          </div>
          <section className="dashboard-next">
            <div>
              <h2>Review and manage work</h2>
              <p>
                {submissions.filter((s) => s.status === "pending").length}{" "}
                challenge submissions waiting for review ·{" "}
                {
                  ownChallenges.filter(
                    (c) =>
                      c.status === "published" &&
                      new Date(c.deadline + "T23:59:59Z") > new Date(),
                  ).length
                }{" "}
                active challenges ·{" "}
                {new Set(approved.map((s) => s.talent_id)).size} approved
                participants.
              </p>
            </div>
            <div className="button-row">
              <ButtonLink href="/portal/company/reviews">
                Review challenge work
              </ButtonLink>
              <ButtonLink secondary href="/paid-projects?view=company">
                Paid projects & applications
              </ButtonLink>
              <Link href="/portal/company/challenges">Manage challenges</Link>
              <Link href="/portal/company/directory">
                Browse public profiles
              </Link>
            </div>
          </section>
          {!company && (
            <p className="notice">
              New here?{" "}
              <Link href="/organizations?view=register">
                Create an organization
              </Link>{" "}
              first. You can then manage its profile and opportunities.
            </p>
          )}
        </>
      )}
      {role === "talent" && ["profile", "projects"].includes(section) && (
        <>
          <nav className="setup-steps" aria-label="Profile setup">
            {setupSteps.map(([key, label], index) => (
              <Link
                key={key}
                href={
                  key === "work"
                    ? "/portal/talent/projects"
                    : `/portal/talent/profile?step=${key}`
                }
                aria-current={
                  (section === "projects" ? key === "work" : step === key)
                    ? "step"
                    : undefined
                }
              >
                <span>{index + 1}</span>
                {label}
              </Link>
            ))}
          </nav>
          <p className="muted">
            Only your name and a valid profile link are needed. Other details
            are optional. Save changes before moving to another step.
          </p>
        </>
      )}
      {role === "talent" && section === "profile" && (
        <section className="panel">
          <h2>{setupSteps.find(([key]) => key === step)?.[1]}</h2>
          <ProfileSetupForm
            key={step}
            profile={profile}
            step={step}
            canWrite={canWrite}
          />
          <div className="button-row section-spacer">
            {step === "publish" ? (
              <>
                <ButtonLink secondary href="/portal/talent/preview">
                  Preview my Skill Passport
                </ButtonLink>
                {profile.is_public && <SharePassport slug={profile.slug} />}
              </>
            ) : (
              <Link
                href={
                  step === "skills"
                    ? "/portal/talent/projects"
                    : `/portal/talent/profile?step=${step === "about" ? "skills" : "publish"}`
                }
              >
                Skip for now →
              </Link>
            )}
            <Link href="/portal/talent/passport">Return to my profile</Link>
          </div>
        </section>
      )}
      {role === "company" && section === "profile" && (
        <section className="panel">
          {live && company && !canManageCompany ? (
            <>
              <h2>{company.name}</h2>
              <p>{company.description}</p>
              <p className="notice">
                Only an organization owner can edit these details. You can still
                review work and use the actions available to your role.
              </p>
            </>
          ) : (
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
          )}
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
            <h2>My work and projects</h2>
            <p className="muted">
              A project is work added by you. It does not need to come from a
              ProofPak opportunity.
            </p>
            <div className="button-row">
              <Link href="/portal/talent/profile?step=publish">
                Continue to preview and publish →
              </Link>
              <Link href="/portal/talent/profile?step=publish">
                Skip projects for now
              </Link>
            </div>
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
      {role === "talent" && ["submissions", "activity"].includes(section) && (
        <>
          <div className="activity-links">
            <Link href="/paid-projects?view=mine">
              <h2>Applications & paid work</h2>
              <p>Track offers, accepted milestones and company feedback.</p>
            </Link>
            <Link href="/portal/talent/achievements">
              <h2>Challenge achievements</h2>
              <p>View company-approved work and manage evidence sharing.</p>
            </Link>
          </div>
          <h2>Challenge submissions</h2>
          <p className="muted">
            Feedback and requests for changes appear here. Milestone approval
            and payment completion are separate statuses in your paid work.
          </p>
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
            <div className="profile-toolbar">
              <p className="profile-visibility">
                {profile.is_public
                  ? "Public — your chosen records can be shared"
                  : "Private — only you can preview your profile"}
              </p>
              <div className="button-row">
                <ButtonLink href="/portal/talent/profile?step=about">
                  Edit profile
                </ButtonLink>
                <ButtonLink
                  secondary
                  href="/portal/talent/profile?step=publish"
                >
                  {profile.is_public
                    ? "Manage visibility"
                    : "Publish Skill Passport"}
                </ButtonLink>
                <Link href="/portal/talent/projects">Manage projects</Link>
                {profile.is_public && <SharePassport slug={profile.slug} />}
              </div>
            </div>
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
          <div className="activity-links">
            <Link href="/paid-projects?view=mine">
              <h2>Applications & paid work</h2>
              <p>Track offers, accepted milestones and company feedback.</p>
            </Link>
            <Link href="/portal/talent/achievements">
              <h2>Challenge achievements</h2>
              <p>View company-approved work and manage evidence sharing.</p>
            </Link>
          </div>
          <h2>Challenge submissions</h2>
          <p className="muted">
            Feedback and requests for changes appear here. Milestone approval
            and payment completion are separate statuses in your paid work.
          </p>
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
