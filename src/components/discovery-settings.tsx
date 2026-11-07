import Link from "next/link";
import { SubmitButton } from "./forms";
export function DiscoverySettings({
  isPublic,
  discoverable = false,
  contact = false,
  action,
}: {
  isPublic: boolean;
  discoverable?: boolean;
  contact?: boolean;
  action: (form: FormData) => Promise<void>;
}) {
  return (
    <section className="panel section-spacer">
      <h2>Employer discovery & contact</h2>
      <p>
        Public Passport: <strong>{isPublic ? "Published" : "Private"}</strong>.{" "}
        <Link className="text-link" href="/portal/talent/profile?step=publish">
          Manage Passport visibility
        </Link>
      </p>
      <form action={action}>
        <label className="field">
          <span>
            <input
              type="checkbox"
              name="discoverable"
              defaultChecked={discoverable}
            />{" "}
            Include my published Passport in the employer directory
          </span>
        </label>
        <label className="field">
          <span>
            <input type="checkbox" name="contact" defaultChecked={contact} />{" "}
            Allow organization contact requests in ProofPak
          </span>
        </label>
        <p className="muted">
          Contact requests require both a public Passport and directory listing.
          These preferences stay saved when you make it private. Public links
          and published records remain public even when you leave the directory.
          Contact acceptance never shares your email or starts a chat.
        </p>
        <SubmitButton>Save discovery preferences</SubmitButton>
      </form>
      <Link className="text-link section-spacer" href="/contact-requests">
        View incoming contact requests ↗
      </Link>
      <Link
        className="text-link section-spacer"
        href="/portal/talent/achievements"
      >
        Choose assessed-work summaries for discovery ↗
      </Link>
    </section>
  );
}
