"use client";
import { useState } from "react";
import { CandidateCard } from "./candidate-card";
import { DiscoverySettings } from "./discovery-settings";
import type { CandidateCardData } from "@/lib/employer-discovery";
export function EmployerDiscoveryFixture() {
  const [feedback, setFeedback] = useState("");
  const [publicProfile, setPublicProfile] = useState(true);
  const c: CandidateCardData = {
    id: "81000000-0000-4000-8000-000000000001",
    slug: "illustrative-directory-fixture",
    full_name: "Illustrative candidate",
    headline: "Accessible interface developer",
    skills: ["React", "Accessibility"],
    allow_contact_requests: true,
    saved: true,
    internal_note: "Illustrative private team note",
    projects: [
      {
        id: "fixture",
        title: "Illustrative public project",
        description:
          "A public portfolio description, not a submission explanation.",
      },
    ],
    credentials: [
      {
        id: "81000000-0000-4000-8000-000000000002",
        title: "Illustrative organization credential",
        issuer_name: "Fixture organization",
        validity: "Expired",
      },
    ],
    achievements: [
      { id: "fixture", title: "Illustrative reviewed work", assessed: true },
    ],
  };
  async function captured(form: FormData) {
    setFeedback(
      `Offline form only: ${JSON.stringify(Object.fromEntries(form))}`,
    );
  }
  return (
    <main className="container page narrow">
      <h1>Offline employer tools fixture</h1>
      <p>No candidate is saved, contacted or changed by these forms.</p>
      <label>
        <input
          type="checkbox"
          checked={!publicProfile}
          onChange={(e) => setPublicProfile(!e.target.checked)}
        />
        Illustrate a private Passport
      </label>
      <DiscoverySettings isPublic={publicProfile} action={captured} />
      <CandidateCard
        candidate={c}
        companyId="81000000-0000-4000-8000-000000000003"
        opportunities={[
          {
            value: "challenge:81000000-0000-4000-8000-000000000004",
            title: "Illustrative challenge",
          },
        ]}
        save={captured}
        remove={captured}
        contact={captured}
      />
      {feedback && (
        <p className="notice hash" role="status">
          {feedback}
        </p>
      )}
    </main>
  );
}
