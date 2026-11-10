"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function AttentionRetry({ href }: { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button
        className="button secondary"
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? "Checking…" : "Check again"}
      </button>
      <noscript>
        <a className="text-link" href={href}>
          Reload dashboard
        </a>
      </noscript>
    </>
  );
}
