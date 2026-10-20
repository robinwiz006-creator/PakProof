"use client";
import Link from "next/link";
import { useState } from "react";
import { OpportunityBrowser } from "./opportunity-browser";
import {
  PaidProjectBrief,
  ProjectMilestoneHeading,
} from "./paid-project-brief";
import { PaidProjectApplication } from "./paid-project-application";
import { opportunityItems } from "@/lib/opportunity-discovery";
import { projectApplicationState } from "@/lib/project-application";
export function OpportunityUXFixture() {
  const [source, setSource] = useState("listings");
  const [role, setRole] = useState("individual");
  const [submitted, setSubmitted] = useState("");
  const project = {
    id: "90000000-0000-4000-8000-000000000001",
    title: "Fixture: accessible dashboard",
    description:
      "An offline project brief for testing presentation, not a real opportunity.",
    requirements:
      "Build an accessible dashboard.\nDeliver source code, a working preview and a short handover.",
    skills: ["React", "Accessibility"],
    deadline: "2099-12-20",
    budget_units: "125000001",
    status: "published",
    companies: { name: "Fixture Design Organization" },
  };
  const items = opportunityItems(
    [
      {
        id: "90000000-0000-4000-8000-000000000002",
        title: "Fixture: data challenge",
        description: "An offline unpaid assessment listing.",
        skills: ["SQL", "Analysis"],
        deadline: "2099-12-10",
        companies: { name: "Fixture Data Organization" },
      },
    ],
    [project],
  );
  const applicationState = projectApplicationState({
    signedIn: role !== "visitor",
    companyMember: role === "company",
    hasApplication: role === "applied",
    status: role === "closed" ? "active" : "published",
    deadline: project.deadline,
  });
  return (
    <div className="container page">
      <p className="notice">
        Offline UX fixtures only. No live listing, application, payment or
        company is created.
      </p>
      <label className="field">
        Fixture listing state
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="listings">Listings</option>
          <option value="empty">Empty</option>
          <option value="partial">Paid projects unavailable</option>
          <option value="unavailable">Disconnected</option>
        </select>
      </label>
      <OpportunityBrowser
        items={
          source === "empty" || source === "unavailable"
            ? []
            : source === "partial"
              ? items.filter((i) => i.kind === "challenge")
              : items
        }
        projectsUnavailable={source === "partial"}
        configured={source !== "unavailable"}
      />
      <hr className="section-spacer" />
      <label className="field">
        Fixture applicant context
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {["individual", "visitor", "company", "applied", "closed"].map(
            (value) => (
              <option key={value}>{value}</option>
            ),
          )}
        </select>
      </label>
      <section aria-label="Project brief fixture">
        <PaidProjectBrief
          project={project}
          action={
            applicationState === "apply" ? (
              <PaidProjectApplication
                projectId={project.id}
                action={async (form) => {
                  setSubmitted(
                    `${form.get("project_id")} · ${form.get("pitch")} · ${form.get("evidence_url")}`,
                  );
                }}
              />
            ) : applicationState === "sign-in" ? (
              <Link className="button" href="/sign-in">
                Sign in to apply
              </Link>
            ) : (
              <p>
                {applicationState === "applied"
                  ? "Application sent"
                  : applicationState === "closed"
                    ? "Applications closed"
                    : "Manage project"}
              </p>
            )
          }
        />
        <section className="section-spacer">
          <h2>Milestones</h2>
          {[
            {
              position: 1,
              title: "Dashboard preview",
              deliverables: "Working accessible preview and source code.",
              amount_units: "75000001",
              deadline: "2099-12-15",
            },
            {
              position: 2,
              title: "Handover",
              deliverables: "Documentation and final source handover.",
              amount_units: "50000000",
              deadline: "2099-12-20",
            },
          ].map((m) => (
            <article className="project-milestone" key={m.position}>
              <ProjectMilestoneHeading milestone={m} />
            </article>
          ))}
        </section>
      </section>
      {submitted && (
        <p role="status">Offline application captured: {submitted}</p>
      )}
    </div>
  );
}
