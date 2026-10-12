export const TEST_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const ASSOCIATED_TOKEN_PROGRAM =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const TOKEN_DECIMALS = 6;
export function tokenUnits(value: string) {
  if (!/^(0|[1-9]\d{0,6})(\.\d{1,6})?$/.test(value))
    throw new Error(
      "Enter a positive token amount with up to six decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (units <= 0n || units > 1000000000000n)
    throw new Error(
      "Amount must be above zero and at most 1,000,000 test USDC.",
    );
  return units.toString();
}
export function tokenAmount(units: string) {
  const n = BigInt(units);
  const fraction = (n % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${n / 1000000n}${fraction ? `.${fraction}` : ""}`;
}
export type PaidProject = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements: string;
  skills: string[];
  deadline: string;
  budget_units: string;
  status: string;
  worker_id: string | null;
  current_offer_id: string | null;
  companies?: { name: string };
};
export type Milestone = {
  id: string;
  project_id: string;
  position: number;
  title: string;
  deliverables: string;
  deadline: string;
  amount_units: string;
  work_status: string;
  current_submission_id: string | null;
  approval_id: string | null;
};
export type PaidOffer = {
  id: string;
  version: number;
  worker_id: string;
  response: string;
  terms_hash: string;
  terms: {
    company_name: string;
    title: string;
    description: string;
    requirements: string;
    deadline: string;
    budget_units: string;
    milestones: {
      id: string;
      title: string;
      deliverables: string;
      amount_units: string;
      deadline: string;
    }[];
  };
};
export type PaymentIntent = {
  id: string;
  milestone_id: string;
  offer_id: string;
  approval_id: string;
  terms_hash: string;
  amount_units: string;
  payer_user_id: string;
  payer_connection_id: string;
  payer_wallet: string;
  source_account: string;
  payout_authorization_id: string;
  recipient_connection_id: string;
  recipient_wallet: string;
  destination_account: string;
  nonce: string;
  network: string;
  mint: string;
  token_program: string;
  decimals: number;
  status: string;
};
export type PaymentAttempt = {
  id: string;
  intent_id: string;
  template_base64: string;
  blockhash: string;
  last_valid_block_height: string;
  signature: string | null;
  signed_base64: string | null;
  status: string;
  status_note: string;
  created_at: string;
};
export function paymentStatusLabel(status: string) {
  return (
    (
      {
        prepared: "Not sent",
        signed: "Pending / outcome unknown",
        registered: "Pending / outcome unknown",
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        needs_review: "Needs review",
        cancelled: "Cancelled",
      } as Record<string, string>
    )[status] ?? "Payment due"
  );
}
