import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container page">
      <p className="eyebrow">404</p>
      <h1>This page isn’t available.</h1>
      <p className="muted section-spacer">
        The record may be private, removed, or the link may be incorrect.
      </p>
      <Link className="button section-spacer" href="/challenges">
        Explore challenges
      </Link>
    </div>
  );
}
