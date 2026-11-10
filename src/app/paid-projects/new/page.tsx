import { teamCan } from "@/lib/team-permissions";
import Link from "next/link";
import { credentialWorkspace } from "@/lib/credential-data";
import { PaidProjectEditor } from "@/components/paid-project-editor";
import { PageHeading } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function NewProject({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { db, user } = await credentialWorkspace();
  const { message } = await searchParams;
  const { data } = await db
    .from("company_memberships")
    .select("company_id,role,companies(name)")
    .eq("user_id", user.id);
  const companies = (data ?? [])
    .filter((m) => teamCan(m.role, "opportunities"))
    .map((m) => ({
      id: m.company_id,
      name: (m.companies as unknown as { name: string }).name,
    }));
  return (
    <div className="container page narrow">
      <PageHeading
        eyebrow="OPTIONAL PAID WORK"
        title="Create a paid project"
        description="Agree on clear deliverables with one person. Use devnet test tokens for this MVP."
      />
      <Link className="text-link" href="/paid-projects">
        Back to paid projects
      </Link>
      {message && (
        <p className="notice section-spacer" role="status">
          {message}
        </p>
      )}
      {companies.length ? (
        <PaidProjectEditor companies={companies} />
      ) : (
        <p className="notice section-spacer">
          An opportunity-management role is required. You can{" "}
          <Link href="/portal/company/profile">
            create your company profile
          </Link>
          . Issuer authorization is separate from publishing paid work.
        </p>
      )}
    </div>
  );
}
