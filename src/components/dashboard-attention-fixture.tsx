"use client";
import { useState } from "react";
import { DashboardAttention, AttentionLoading } from "./dashboard-attention";
import type { AttentionResult } from "@/lib/dashboard-attention";
export function DashboardAttentionFixture() {
  const [state, setState] = useState("talent");
  const result: AttentionResult = {
    items:
      state === "empty" || state === "unavailable"
        ? []
        : [
            {
              key: "review",
              title:
                state === "company"
                  ? "Review submitted milestones"
                  : "Review received credentials",
              explanation: "Offline fixture only. No record is changed.",
              status: "Your decision needed",
              href:
                state === "company"
                  ? "/paid-projects?view=company"
                  : "/my-credentials",
              action:
                state === "company"
                  ? "Review milestones"
                  : "Review credentials",
              priority: 10,
              count: 2,
            },
          ],
    unavailable:
      state === "partial" || state === "unavailable" ? ["Project offers"] : [],
    context: state === "company" ? "Fixture organization" : undefined,
  };
  return (
    <main className="container page narrow">
      <h1>Offline dashboard attention fixture</h1>
      <label className="field">
        Attention fixture state
        <select value={state} onChange={(e) => setState(e.target.value)}>
          {[
            "talent",
            "company",
            "empty",
            "loading",
            "partial",
            "unavailable",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {state === "loading" ? (
        <AttentionLoading />
      ) : (
        <DashboardAttention result={result} retryHref="/portal/talent" />
      )}
    </main>
  );
}
