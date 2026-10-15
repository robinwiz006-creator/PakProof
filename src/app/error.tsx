"use client";
import Link from "next/link";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="container page">
      <h1>We couldn’t load this page.</h1>
      <p className="muted section-spacer">
        Please try again. If the problem continues, return to your dashboard and
        try opening this page again.
      </p>
      <button className="button section-spacer" onClick={retry}>
        Try again
      </button>
      <Link className="text-link section-spacer" href="/portal/talent">
        Return to my dashboard
      </Link>
    </div>
  );
}
