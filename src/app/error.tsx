"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container page">
      <h1>We couldn’t load this page.</h1>
      <p className="muted section-spacer">
        Check your connection. If you’re setting up ProofPak, confirm the
        Supabase configuration and apply the database migration.
      </p>
      <button className="button section-spacer" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
