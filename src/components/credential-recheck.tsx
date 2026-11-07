"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
export function CredentialRecheck() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="section-spacer">
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Checking current status…" : "Recheck current status"}
      </button>
      <p className="muted" role="status">
        {pending
          ? "Reading the current record and checking its stored proof. No wallet or transaction is involved."
          : "No account or wallet is needed for a publicly shared credential."}
      </p>
    </div>
  );
}
