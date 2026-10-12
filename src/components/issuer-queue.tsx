import Link from "next/link";
import type { Organization } from "@/lib/credentials";
export function IssuerQueue({
  organizations,
}: {
  organizations: (Organization & { created_at: string })[];
}) {
  return (
    <div
      className="review-table"
      role="region"
      aria-label="Organization review queue"
    >
      <table>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Type</th>
            <th>Status</th>
            <th>Registered</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {organizations.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.companies.name}</strong>
              </td>
              <td>{o.organization_type}</td>
              <td>
                <span className={`tag status-${o.issuer_status}`}>
                  {o.issuer_status}
                </span>
              </td>
              <td>{o.created_at.slice(0, 10)}</td>
              <td>
                <Link className="text-link" href={`/issuer-admin/${o.id}`}>
                  Review organization →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
