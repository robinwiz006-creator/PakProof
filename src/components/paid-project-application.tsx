"use client";
import { useRef } from "react";
import { Field, SubmitButton } from "./forms";
export function PaidProjectApplication({
  projectId,
  action,
}: {
  projectId: string;
  action: (form: FormData) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        className="button"
        type="button"
        onClick={() => dialog.current?.showModal()}
      >
        Apply
      </button>
      <dialog
        ref={dialog}
        className="confirmation-dialog project-apply-dialog"
        aria-labelledby="project-apply-title"
      >
        <h2 id="project-apply-title">Apply for this project</h2>
        <p className="muted">
          Share relevant work and how you would approach the brief.
        </p>
        <form action={action}>
          <input type="hidden" name="project_id" value={projectId} />
          <Field
            name="pitch"
            label="Your approach"
            type="textarea"
            required
            minLength={20}
            maxLength={4000}
          />
          <Field
            name="evidence_url"
            label="Project or evidence URL"
            type="url"
            required
          />
          <p className="muted application-privacy">
            Only you and the organization can see your application. Test USDC
            has no monetary value; payment is not guaranteed.
          </p>
          <div className="button-row">
            <SubmitButton>Send application</SubmitButton>
            <button
              className="button secondary"
              type="button"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
