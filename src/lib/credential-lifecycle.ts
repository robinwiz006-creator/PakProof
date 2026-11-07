import { credentialValidity, type Credential } from "./credentials";
export function credentialLifecycle(
  c: Credential,
  today = new Date().toISOString().slice(0, 10),
) {
  const validity = credentialValidity(c, today);
  const status =
    validity !== "Current"
      ? validity
      : c.credential_preferences.acceptance === "pending"
        ? "Awaiting acceptance"
        : c.credential_preferences.acceptance === "declined"
          ? "Declined"
          : "Active";
  const descriptions: Record<string, string> = {
    Active:
      "Accepted and within its recorded dates, with no revocation or accepted replacement recorded. This is not independent proof that the underlying qualification is true.",
    "Awaiting acceptance":
      "The recipient has not accepted this credential. It is not active or publicly shared.",
    Declined:
      "The recipient declined or withdrew acceptance. It is not active or publicly shared.",
    Revoked:
      "The issuer revoked this credential. A matching historical Solana record does not restore its validity.",
    Superseded:
      "An accepted corrected replacement supersedes this record. Its historical proof does not make it the current credential.",
    Expired:
      "The explicitly recorded expiry date has passed. Historical integrity does not extend that date.",
    "Not yet valid":
      "The recorded issue date is in the future. It is not currently active.",
  };
  return {
    status,
    active: status === "Active",
    description: descriptions[status],
    dateValidity: validity,
  };
}
export function verificationCheckedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return (
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}
