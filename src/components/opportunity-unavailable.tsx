import Link from "next/link";
export function OpportunityUnavailable() {
  return (
    <div className="container page">
      <h1>This page isn’t available.</h1>
      <p className="muted section-spacer">
        This opportunity may be private, removed, or unavailable. You can find
        other open opportunities without submitting anything here.
      </p>
      <Link className="button section-spacer" href="/opportunities">
        Explore opportunities
      </Link>
    </div>
  );
}
