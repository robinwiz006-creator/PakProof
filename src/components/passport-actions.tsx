"use client";
import { useState } from "react";
import { ConfirmForm } from "./confirm-form";
import { deleteProject } from "@/lib/actions";
export function SharePassport({ slug }: { slug: string }) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={async () => {
          const url = new URL(`/talent/${slug}`, window.location.origin).href;
          try {
            await navigator.clipboard.writeText(url);
            setMessage("Passport link copied.");
          } catch {
            setMessage(`Copy this link: ${url}`);
          }
        }}
      >
        Copy passport link
      </button>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
export function RemoveProject({ id }: { id: string }) {
  return (
    <ConfirmForm
      action={deleteProject}
      title="Remove this portfolio project?"
      message="The project will be removed from your passport. Approved achievement facts and historical proofs stay unchanged."
      label="Remove project"
    >
      <input type="hidden" name="project_id" value={id} />
      <button type="submit" className="text-link">
        Remove project
      </button>
    </ConfirmForm>
  );
}
