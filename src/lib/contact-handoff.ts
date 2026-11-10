import { z } from "zod";
export const followupInput = z.object({
  topic: z.enum(["next_steps", "question", "response"]),
  body: z.string().trim().min(10).max(1000),
});
export type ContactNote = {
  id: string;
  sender: "candidate" | "organization";
  topic: string;
  body: string;
  created_at: string;
};
export type ContactOpportunity = {
  kind: string;
  title: string | null;
  status: "Open" | "Closed" | "Unavailable";
  href: string | null;
  deadline: string | null;
};
export function contactStatus(status: string) {
  return (
    (
      {
        expired: "Invitation expired",
        pending: "Awaiting candidate decision",
        accepted: "Contact accepted",
        declined: "Declined",
        closed: "Closed by candidate",
        withdrawn: "Withdrawn by organization",
      } as Record<string, string>
    )[status] ?? "Unavailable"
  );
}
export function canFollowup(status: string, consent: boolean, count: number) {
  return status === "accepted" && consent && count < 6;
}
