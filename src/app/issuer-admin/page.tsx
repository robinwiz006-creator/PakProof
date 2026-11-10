import { Suspense } from "react";
import { AttentionLoading } from "@/components/dashboard-attention";
import { AdministratorAttentionData } from "@/components/dashboard-attention-data";
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
    trust?: string;
    status?: string;
    page?: string;
    message?: string;
  }>;
}) {
  const { db, user } = await credentialWorkspace();
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
  const pendingTrust = input.trust === "pending";
  let query = db
    .from(pendingTrust ? "administrator_verification_queue" : "organizations")
    .select(
      pendingTrust
        ? "*"
        : "id,company_id,organization_type,issuer_status,created_at,trust_level,trust_suspended,companies!inner(name,description,website)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("issuer_status", status);
  if (q)
    query = query.ilike(
      pendingTrust ? "company_name" : "companies.name",
      `%${q.replace(/[\\%_]/g, "\\$&")}%`,
    );
  const [orgs, ...counts] = await Promise.all([
    query.range((page - 1) * 25, page * 25 - 1),
    ...["pending", "authorized", "suspended"].map((state) =>
      db
        .from("organizations")
        .select("id", { count: "exact", head: true })
        .eq("issuer_status", state),
    ),
    db
      .from("administrator_verification_queue")
      .select("id", { count: "exact", head: true }),
  ]);

  const organizations = (orgs.data ?? []) as unknown as (Organization & {
    created_at: string;
  })[];
  const url = (n: number) =>
    `/issuer-admin?${new URLSearchParams({ q, status, page: String(n), ...(pendingTrust ? { trust: "pending" } : {}) })}`;
  return (
    <div className="container page">
      <PageHeading
        eyebrow="RESTRICTED ADMINISTRATION"
        title="Issuer review desk"
        description="Review institutional trust and credential-category permissions separately. Neither guarantees every credential."
      />
      <Suspense fallback={<AttentionLoading />}>
        <AdministratorAttentionData userId={user.id} />
      </Suspense>
      {(orgs.error || counts.some((c) => c.error)) && (
        <p className="notice" role="status">
          Some issuer records could not be loaded. Counts marked unavailable are
          not zero. Please try again.
        </p>
      )}
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
            <strong>
              {counts[i].error || counts[i].count === null
                ? "Unavailable"
                : (counts[i].count ?? 0)}
            </strong>
          </Link>
        ))}
      </div>
      <Link
        className="button secondary section-spacer"
        href={pendingTrust ? "/issuer-admin" : "/issuer-admin?trust=pending"}
      >
        {pendingTrust
          ? "All issuer organizations"
          : `Institutional requests awaiting review (${counts[3]?.error || counts[3]?.count === null ? "unavailable" : (counts[3]?.count ?? 0)})`}
      </Link>
      <Form className="filters" action="/issuer-admin">
        {pendingTrust && <input type="hidden" name="trust" value="pending" />}
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
      {orgs.error ? (
        <p className="notice">
          The organization list is unavailable. Try loading this page again.
        </p>
      ) : organizations.length ? (
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
