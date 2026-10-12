import {
  ArrowUpRight,
  Fingerprint,
  Code2,
  FileBadge,
  BriefcaseBusiness,
} from "lucide-react";

export function MarketingPassport({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  return (
    <div
      className={`identity-preview ${expanded ? "expanded" : ""}`}
      aria-label="Illustrative Skill Passport, not a real verified profile"
    >
      <div className="identity-top">
        <span>
          <Fingerprint size={18} /> PROOFPAK / PASSPORT
        </span>
        <span>ILLUSTRATIVE</span>
      </div>
      <div className="identity-person">
        <div className="identity-avatar">AK</div>
        <div>
          <h3>Ayesha Khan</h3>
          <p>Developer & thoughtful problem solver</p>
          <small>Islamabad, Pakistan</small>
        </div>
        <ArrowUpRight aria-hidden="true" />
      </div>
      <p className="identity-bio">
        I build useful tools, explore new ideas, and document what I learn.
      </p>
      <div className="identity-skills">
        <span className="identity-label">01 / SKILLS · SELF-REPORTED</span>
        <div>
          <span>Frontend development</span>
          <span>TypeScript</span>
          <span>Accessible design</span>
        </div>
      </div>
      <div className="identity-project">
        <Code2 size={22} />
        <div>
          <span className="identity-label">02 / PROJECTS · SELF-REPORTED</span>
          <h4>Campus expense tracker</h4>
          <p>A simpler way to manage shared student expenses.</p>
          <span className="identity-evidence">
            Repository + demo + explanation <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
      <div className="identity-records">
        <div>
          <FileBadge size={20} />
          <span className="identity-label">03 / CREDENTIALS</span>
          <p>
            {expanded
              ? "Accepted organization-issued records belong here."
              : "Recognition, with its source."}
          </p>
          <small>No credential issued in this example</small>
        </div>
        <div>
          <BriefcaseBusiness size={20} />
          <span className="identity-label">04 / COMPLETED WORK</span>
          <p>
            {expanded
              ? "Work history you choose to share."
              : "Experience, connected to evidence."}
          </p>
          <small>No completed paid work in this example</small>
        </div>
      </div>
      <div className="identity-bottom">
        Design example only. No verified record or blockchain proof.
        <Fingerprint size={22} />
      </div>
    </div>
  );
}
