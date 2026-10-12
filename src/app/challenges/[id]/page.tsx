import { notFound } from "next/navigation";
import { challenge } from "@/lib/data";
import { isConfigured, supabase } from "@/lib/supabase/server";
import { PageHeading, Tags, DemoNotice, ButtonLink } from "@/components/ui";
import { Field, SubmitButton } from "@/components/forms";
import { submitWork } from "@/lib/actions";
export default async function ChallengeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await challenge(id);
  if (!c) notFound();
  const db = isConfigured() ? await supabase() : null;
  const user = db ? (await db.auth.getUser()).data.user : null;
  const closed =
    c.status !== "published" ||
    new Date(c.deadline + "T23:59:59Z") < new Date();
  return (
    <div className="container page">
      <PageHeading
        eyebrow={c.companies?.name}
        title={c.title}
        description="A practical opportunity to show how you think and what you can build."
      />
      {!isConfigured() && <DemoNotice />}
      <div className="detail-grid">
        <div>
          <section className="panel prose">
            <h2>The brief</h2>
            <p>{c.description}</p>
            <h2>Expected deliverables</h2>
            <p>{c.deliverables}</p>
            <Tags values={c.skills} />
          </section>
          <section className="panel" id="submit">
            <h2>Submit your work</h2>
            {!isConfigured() ? (
              <>
                <p className="muted">
                  This is a demonstration challenge. Real submissions become
                  available after Supabase is connected and a company publishes
                  a challenge.
                </p>
                <div className="section-spacer">
                  <ButtonLink href="/sign-up">Create your account</ButtonLink>
                </div>
              </>
            ) : !user ? (
              <>
                <p className="muted">
                  Sign in before submitting so your work is saved to your
                  account.
                </p>
                <ButtonLink
                  href={`/sign-in?next=${encodeURIComponent(`/challenges/${c.id}#submit`)}`}
                >
                  Sign in to submit
                </ButtonLink>
              </>
            ) : closed ? (
              <p className="muted">
                Submissions are closed for this challenge.
              </p>
            ) : (
              <form className="form" action={submitWork}>
                <input type="hidden" name="challenge_id" value={c.id} />
                <Field
                  label="Project or demo URL"
                  name="project_url"
                  type="url"
                />
                <Field
                  label="GitHub URL"
                  name="github_url"
                  type="url"
                  hint="Add at least one project or GitHub link."
                />
                <Field
                  label="Explain your work"
                  name="explanation"
                  type="textarea"
                  required
                  minLength={30}
                  maxLength={10000}
                  hint="Describe your approach, decisions, and any limitations. Do not include private information."
                />
                <SubmitButton>Submit for review</SubmitButton>
              </form>
            )}
          </section>
        </div>
        <aside className="panel" style={{ alignSelf: "start" }}>
          <h3>Challenge details</h3>
          <dl className="meta-list">
            <div>
              <dt>Company</dt>
              <dd>{c.companies?.name}</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>{c.difficulty}</dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd>{c.deadline}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{closed ? "Closed" : "Open for submissions"}</dd>
            </div>
          </dl>
          <p className="muted">
            Company approval recognizes your work. A Solana proof is issued
            separately and can be inspected from your passport.
          </p>
        </aside>
      </div>
    </div>
  );
}
