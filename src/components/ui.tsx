import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Layers3 } from "lucide-react";
import type { Achievement, Challenge } from "@/lib/types";
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} href={href}>
      {children}
      <ArrowUpRight size={16} />
    </Link>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Tags({ values }: { values: string[] }) {
  return (
    <div className="tags">
      {values.map((value) => (
        <span className="tag" key={value}>
          {value}
        </span>
      ))}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Layers3 size={28} />
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function DemoNotice() {
  return (
    <div className="notice">
      Demonstration data · These example people, companies, and challenges have
      no verified achievements. Connect Supabase to create real records.
    </div>
  );
}
export function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
  return (
    <Link href={`/challenges/${c.id}`} className="challenge-card">
      <div className="challenge-meta">
        <span className="company-avatar">{c.companies?.name?.[0] ?? "C"}</span>
        <span>{c.companies?.name ?? "Company challenge"}</span>
        <span className="tag">Unpaid</span>
        <span className="level">{c.difficulty}</span>
      </div>
      <h3>{c.title}</h3>
      <p className="muted">{c.description}</p>
      <Tags values={c.skills} />
      <div className="card-footer">
        <span>
          <Clock3 size={14} /> Due{" "}
          {new Date(c.deadline + "T12:00:00Z").toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </span>
        <span>
          View challenge <ArrowUpRight size={16} />
        </span>
      </div>
    </Link>
  );
}
export function AchievementCard({
  achievement: a,
}: {
  achievement: Achievement;
}) {
  const proof = a.blockchain_proofs?.[0];
  return (
    <Link href={`/verify/${a.id}`} className="panel achievement">
      <CheckCircle2 size={24} />
      <div>
        <h3>{a.title}</h3>
        <p className="muted">
          Recognized by{" "}
          {a.achievement_claims?.issuer_name ?? a.companies?.name ?? "company"}
        </p>
        <span className="tag">
          {proof
            ? "Proof recorded · open to verify"
            : "Company-approved · proof pending"}
        </span>
      </div>
      <ArrowUpRight size={18} />
    </Link>
  );
}
