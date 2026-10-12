export type Profile = {
  passport_previewed_at?: string | null;
  id: string;
  slug: string;
  full_name: string;
  headline: string;
  university: string;
  location: string;
  bio: string;
  skills: string[];
  is_public: boolean;
};
export type Company = {
  id: string;
  name: string;
  description: string;
  website: string;
  location: string;
};
export type Challenge = {
  id: string;
  company_id: string;
  title: string;
  description: string;
  skills: string[];
  difficulty: string;
  deadline: string;
  deliverables: string;
  status: string;
  companies?: { name: string } | null;
};
export type Project = {
  skills?: string[];
  id: string;
  talent_id: string;
  title: string;
  description: string;
  github_url: string;
  demo_url: string;
  evidence_url: string;
};
export type Submission = {
  id: string;
  challenge_id: string;
  talent_id: string;
  project_url: string;
  github_url: string;
  explanation: string;
  status: string;
  challenges?: Challenge | null;
  profiles?: Profile | null;
  submission_reviews?: {
    feedback: string;
    decision: string;
    created_at: string;
  }[];
};
export type Achievement = {
  achievement_claims?: {
    issuer_name: string;
    evidence_digest: string;
    claim_type: "company_challenge";
  } | null;
  achievement_evidence?: {
    challenge_title: string;
    challenge_description: string;
    deliverables: string;
    project_url: string;
    github_url: string;
    explanation: string;
    digest_salt: string;
  } | null;
  achievement_sharing?: {
    share_evidence: boolean;
    project_id: string | null;
  } | null;
  id: string;
  challenge_id: string;
  submission_id: string;
  talent_id: string;
  company_id: string;
  title: string;
  issued_at: string;
  profiles?: Profile | null;
  companies?: { name: string } | null;
  blockchain_proofs?: Proof[];
};
export type Proof = {
  claim_version?: 1 | 2;
  id: string;
  achievement_id: string;
  signature: string;
  record_hash: string;
  issuer_wallet: string;
  network: string;
  anchored_at: string;
};
