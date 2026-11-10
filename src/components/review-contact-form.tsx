"use client";
import { useState, type ReactNode } from "react";
import { SubmitButton } from "./forms";
export function ReviewContactForm({
  action,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  children: ReactNode;
}) {
  const [review, setReview] = useState<{
    purpose: string;
    opportunity: string;
  } | null>(null);
  return (
    <form action={action} onChange={() => setReview(null)}>
      {children}
      {review ? (
        <div className="notice" role="status">
          <h4>Review your invitation</h4>
          <p>{review.purpose}</p>
          <p>{review.opportunity}</p>
          <p>Acceptance does not create an application, contract or payment.</p>
          <SubmitButton>Send in-app invitation / contact request</SubmitButton>
        </div>
      ) : (
        <button
          className="button"
          type="button"
          onClick={(e) => {
            const form = e.currentTarget.form;
            if (!form?.reportValidity()) return;
            const select = form.elements.namedItem(
              "opportunity",
            ) as HTMLSelectElement;
            const data = new FormData(form);
            setReview({
              purpose: String(data.get("purpose") ?? ""),
              opportunity:
                select?.selectedOptions[0]?.text ?? "No opportunity linked",
            });
          }}
        >
          Review invitation or contact request
        </button>
      )}
    </form>
  );
}
