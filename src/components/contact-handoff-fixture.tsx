"use client";
import { useState } from "react";
import { ContactHandoff } from "./contact-handoff";
import type { ContactNote } from "@/lib/contact-handoff";
export function ContactHandoffFixture() {
  const [status, setStatus] = useState("accepted");
  const [op, setOp] = useState("none");
  const [candidate, setCandidate] = useState(true);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  return (
    <main className="container page narrow">
      <p className="notice">
        Offline contact fixture. No real message or contact request is saved.
      </p>
      <label className="field">
        Fixture status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {["pending", "accepted", "declined", "closed", "withdrawn"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      <label className="field">
        Fixture opportunity
        <select value={op} onChange={(e) => setOp(e.target.value)}>
          {["none", "Open", "Closed", "Unavailable"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={candidate}
          onChange={(e) => setCandidate(e.target.checked)}
        />{" "}
        Candidate view
      </label>
      <ContactHandoff
        id="81000000-0000-4000-8000-000000000001"
        organization="Illustrative organization"
        purpose="Discuss an accessible interface project and a practical next step."
        status={status}
        consent
        candidate={candidate}
        notes={notes}
        opportunity={
          op === "none"
            ? null
            : {
                kind: "paid-project",
                title: op === "Unavailable" ? null : "Illustrative project",
                status: op as "Open" | "Closed" | "Unavailable",
                href: op === "Open" ? "/paid-projects/fixture" : null,
                deadline: null,
              }
        }
        nonce="81000000-0000-4000-8000-000000000002"
        send={async (f) =>
          setNotes((n) => [
            ...n,
            {
              id: String(n.length),
              sender: candidate ? "candidate" : "organization",
              topic: String(f.get("topic")),
              body: String(f.get("body")),
              created_at: "2026-11-07T12:00:00Z",
            },
          ])
        }
        close={async () => setStatus(candidate ? "closed" : "withdrawn")}
      />
    </main>
  );
}
