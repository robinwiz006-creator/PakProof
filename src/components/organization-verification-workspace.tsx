import { supabase } from "@/lib/supabase/server";
import type { Organization } from "@/lib/credentials";
import {
  OrganizationTrust,
  VerificationRequestForm,
  VerificationRequestHistory,
  OrganizationTrustReviewForm,
} from "./organization-trust";
import type {
  VerificationRequest,
  VerificationOutcome,
} from "@/lib/organization-trust";
export async function OrganizationVerificationWorkspace({
  organization: o,
  administrator = false,
  own = false,
}: {
  organization: Organization;
  administrator?: boolean;
  own?: boolean;
}) {
  const db = await supabase();
  const [requests, outcomes] = await Promise.all([
    db
      .from("organization_verification_requests")
      .select(
        "id,organization_id,identity_statement,representative_role,identity_evidence_url,assessment_statement,assessment_evidence_url,created_at",
      )
      .eq("organization_id", o.id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("organization_verification_outcomes")
      .select(
        "verification_request_id,trust_decision,resulting_trust_level,created_at",
      )
      .eq("organization_id", o.id)
      .not("verification_request_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (requests.error || outcomes.error)
    throw new Error(
      "Private organization verification records could not be loaded.",
    );
  const rows = (requests.data ?? []) as VerificationRequest[],
    decisions = (outcomes.data ?? []) as VerificationOutcome[];
  const pending = rows.find(
    (r) => !decisions.some((d) => d.verification_request_id === r.id),
  );
  return (
    <section className="section-spacer">
      <h2>Institutional verification · {o.companies.name}</h2>
      <OrganizationTrust organization={o} />
      <VerificationRequestHistory requests={rows} outcomes={decisions} />
      {administrator ? (
        own ? (
          <p className="notice">
            A different administrator must review organizations you belong to.
          </p>
        ) : (
          <OrganizationTrustReviewForm
            id={o.id}
            requestId={pending?.id ?? null}
            expectedReview={o.trust_review_id ?? null}
          />
        )
      ) : pending ? (
        <p className="notice">
          Your verification information is awaiting independent review. No trust
          level was granted by submission.
        </p>
      ) : (
        <VerificationRequestForm id={o.id} />
      )}
    </section>
  );
}
