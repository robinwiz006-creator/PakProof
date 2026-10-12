import Link from "next/link";
import { IssuerQueue } from "@/components/issuer-queue";
import Form from "next/form";
import { notFound } from "next/navigation";
import { PageHeading, Empty } from "@/components/ui";
import { credentialWorkspace } from "@/lib/credential-data";
import type { Organization } from "@/lib/credentials";
export const dynamic = "force-dynamic";
export default async function IssuerAdmin({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    message?: string;
  }>;
}) {
  const { db } = await credentialWorkspace();
  const { data: admin, error } = await db.rpc("is_platform_administrator");
  if (error || !admin) notFound();
  const input = await searchParams;
  const q = (input.q ?? "").trim().slice(0, 120);
  const status = ["pending", "authorized", "suspended"].includes(
    input.status ?? "",
  )
    ? input.status!
    : "";
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(input.page ?? "1") || 1),
  );
  let query = db
    .from("organizations")
    .select(
      "id,company_id,organization_type,issuer_status,created_at,companies!inner(name,description,website)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("issuer_status", status);
  if (q)
    query = query.ilike("companies.name", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const [orgs, ...counts] = await Promise.all([
    query.range((page - 1) * 25, page * 25 - 1),
    ...["pending", "authorized", "suspended"].map((state) =>
      db
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("issuer_status", state),
    ),
  ]);
  if (orgs.error || counts.some((c) => c.error))
    throw new Error(
      "Issuer review records could not be loaded. Please try again.",
    );
  const organizations = (orgs.data ?? []) as unknown as (Organization & {
    created_at: string;
  })[];
  const url = (n: number) =>
    `/issuer-admin?${new URLSearchParams({ q, status, page: String(n) })}`;
  return (
    <div className="container page">
      <PageHeading
        eyebrow="RESTRICTED ADMINISTRATION"
        title="Issuer review desk"
        description="Check identity and representative authority before enabling credentials. Authorization is a recorded human decision."
      />
      {input.message && (
        <p className="notice" role="status">
          {input.message}
        </p>
      )}
      <div className="stats">
        {["Pending", "Authorized", "Suspended"].map((name, i) => (
          <Link
            className="stat"
            key={name}
            href={`/issuer-admin?status=${name.toLowerCase()}`}
          >
            <span>{name}</span>
            <strong>{counts[i].count ?? 0}</strong>
          </Link>
        ))}
      </div>
      <Form className="filters" action="/issuer-admin">
        <input
          name="q"
          aria-label="Search organization name"
          placeholder="Search organization name…"
          defaultValue={q}
        />
        <select
          name="status"
          aria-label="Authorization status"
          defaultValue={status}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="authorized">Authorized</option>
          <option value="suspended">Suspended</option>
        </select>
        <button className="button">Apply filters</button>
        <Link className="text-link" href="/issuer-admin">
          Clear
        </Link>
      </Form>
      {organizations.length ? (
        <IssuerQueue organizations={organizations} />
      ) : (
        <Empty title="No organizations match">
          Adjust the filters or return when an organization registers.
        </Empty>
      )}
      <div className="list-row section-spacer">
        <p className="muted">
          {orgs.count ?? 0} matching organizations · Page {page} · 25 per page
        </p>
        <div className="button-row">
          {page > 1 && (
            <Link className="text-link" href={url(page - 1)}>
              Previous
            </Link>
          )}
          {page * 25 < (orgs.count ?? 0) && (
            <Link className="text-link" href={url(page + 1)}>
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
