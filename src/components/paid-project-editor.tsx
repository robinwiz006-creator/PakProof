"use client";
import { useState } from "react";
import { Field, SubmitButton } from "./forms";
import { createPaidProject } from "@/lib/paid-actions";
export function PaidProjectEditor({
  companies,
}: {
  companies: { id: string; name: string }[];
}) {
  const [milestones, setMilestones] = useState([
    { title: "", deliverables: "", deadline: "", amount: "" },
  ]);
  function change(i: number, key: string, value: string) {
    setMilestones((rows) =>
      rows.map((m, n) => (n === i ? { ...m, [key]: value } : m)),
    );
  }
  return (
    <form className="panel form" action={createPaidProject}>
      <label className="field">
        Company
        <select name="company_id" required>
          {companies.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field
        name="title"
        label="Project title"
        required
        minLength={3}
        maxLength={160}
      />
      <Field
        name="description"
        label="Work description"
        type="textarea"
        required
        minLength={30}
        maxLength={5000}
      />
      <Field
        name="requirements"
        label="Requirements and working arrangements"
        type="textarea"
        required
        minLength={20}
        maxLength={4000}
        hint="Describe scope, review timing and payment expectations. Payments happen after approval, and are not guaranteed."
      />
      <Field
        name="skills"
        label="Skills used (separate with commas)"
        maxLength={500}
      />
      <Field name="deadline" label="Project deadline" type="date" required />
      <Field
        name="budget"
        label="Total budget in devnet test USDC"
        required
        hint="Test tokens only, not real money. Use up to six decimal places."
      />
      <h2>Milestones</h2>
      <p className="muted">
        Milestone amounts must equal the total budget. Terms cannot be edited
        after creation in this MVP; review the draft before publishing.
      </p>
      {milestones.map((m, i) => (
        <fieldset className="panel section-spacer" key={i}>
          <legend>Milestone {i + 1}</legend>
          {(
            [
              ["title", "Title", "text"],
              ["deliverables", "Deliverables", "textarea"],
              ["deadline", "Deadline", "date"],
              ["amount", "Amount in test USDC", "text"],
            ] as const
          ).map(([key, label, type]) => (
            <label className="field" key={key}>
              {label}
              {type === "textarea" ? (
                <textarea
                  required
                  minLength={20}
                  maxLength={4000}
                  value={m[key]}
                  onChange={(e) => change(i, key, e.target.value)}
                />
              ) : (
                <input
                  required
                  type={type}
                  value={m[key]}
                  onChange={(e) => change(i, key, e.target.value)}
                  maxLength={key === "title" ? 160 : undefined}
                />
              )}
            </label>
          ))}
          {milestones.length > 1 && (
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setMilestones((rows) => rows.filter((_, n) => n !== i))
              }
            >
              Remove milestone
            </button>
          )}
        </fieldset>
      ))}
      <input
        type="hidden"
        name="milestones"
        value={JSON.stringify(milestones)}
      />
      <div className="button-row section-spacer">
        {milestones.length < 20 && (
          <button
            className="button secondary"
            type="button"
            onClick={() =>
              setMilestones((rows) => [
                ...rows,
                { title: "", deliverables: "", deadline: "", amount: "" },
              ])
            }
          >
            Add milestone
          </button>
        )}
        <SubmitButton>Create draft</SubmitButton>
      </div>
    </form>
  );
}
