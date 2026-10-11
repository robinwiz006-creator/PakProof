"use client";
import { useId } from "react";
import { useFormStatus } from "react-dom";
export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="button" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = false,
  hint,
  minLength,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string;
  required?: boolean;
  hint?: string;
  minLength?: number;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {type === "textarea" ? (
        <textarea
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          name={name}
          defaultValue={value ?? ""}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
        />
      ) : (
        <input
          id={id}
          aria-describedby={hint ? `${id}-hint` : undefined}
          name={name}
          type={type}
          defaultValue={value ?? ""}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
        />
      )}{" "}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
