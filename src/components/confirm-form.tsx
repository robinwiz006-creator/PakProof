"use client";
import { useRef } from "react";
export function ConfirmForm({
  action,
  title,
  message,
  children,
  label = "Confirm decision",
}: {
  action: (form: FormData) => Promise<void>;
  title: string;
  message: string;
  children: React.ReactNode;
  label?: string;
}) {
  const form = useRef<HTMLFormElement>(null),
    dialog = useRef<HTMLDialogElement>(null),
    confirmed = useRef(false);
  return (
    <form
      ref={form}
      action={action}
      onSubmit={(event) => {
        if (!confirmed.current) {
          event.preventDefault();
          dialog.current?.showModal();
        } else confirmed.current = false;
      }}
    >
      {children}
      <dialog ref={dialog} className="confirmation-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="button-row">
          <button
            type="button"
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              confirmed.current = true;
              dialog.current?.close();
              form.current?.requestSubmit();
            }}
          >
            {label}
          </button>
        </div>
      </dialog>
    </form>
  );
}
