"use client";
import { useFormStatus } from "react-dom";
import { useState } from "react";
import { saveHistory } from "@/lib/history-actions";
import type { HistoryRecord } from "@/lib/profile-history";
function Buttons({ existing }: { existing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <div className="button-row">
      <button className="button" disabled={pending}>
        {pending ? "Saving…" : "Save record"}
      </button>
      {existing && (
        <button
          className="button secondary"
          name="action"
          value="delete"
          formNoValidate
          disabled={pending}
          onClick={(e) => {
            if (!confirm("Delete this record?")) e.preventDefault();
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}
export function HistoryForm({ record }: { record?: HistoryRecord }) {
  const [ongoing, setOngoing] = useState(record?.ongoing ?? false);
  return (
    <form action={saveHistory} className="form-grid">
      <input type="hidden" name="id" value={record?.id ?? ""} />
      <label>
        Record type
        <select name="kind" defaultValue={record?.kind ?? "education"}>
          <option value="education">Education</option>
          <option value="employment">Work experience</option>
        </select>
      </label>
      <label>
        Institution or employer
        <input
          name="organization"
          required
          maxLength={160}
          defaultValue={record?.organization}
        />
      </label>
      <label>
        Qualification or job title
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={record?.title}
        />
      </label>
      <label>
        Field of study (optional)
        <input name="field" maxLength={160} defaultValue={record?.field} />
      </label>
      <label>
        Start date
        <input
          type="date"
          name="start_date"
          required
          defaultValue={record?.start_date}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="ongoing"
          checked={ongoing}
          onChange={(e) => setOngoing(e.target.checked)}
        />{" "}
        Ongoing education or current position
      </label>
      <label>
        End date
        <input
          type="date"
          name="end_date"
          required={!ongoing}
          disabled={ongoing}
          defaultValue={record?.end_date ?? ""}
        />
      </label>
      {ongoing && <input type="hidden" name="end_date" value="" />}
      <label>
        Description (optional)
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={record?.description}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="is_public"
          defaultChecked={record?.is_public}
        />{" "}
        Show on my published Passport
      </label>
      <Buttons existing={Boolean(record)} />
    </form>
  );
}
