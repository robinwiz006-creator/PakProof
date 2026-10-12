// Read-only service checks. Never print credentials, user data, or raw network errors.
import nextEnv from "@next/env";
import { Connection } from "@solana/web3.js";
nextEnv.loadEnvConfig(process.cwd());
let blocked = false;
function report(label, ok, detail) {
  console.log(`${ok ? "PASS" : "BLOCKED"} ${label}: ${detail}`);
  if (!ok) blocked = true;
}
const names = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "SOLANA_RPC_URL",
  "NEXT_PUBLIC_SOLANA_RPC_URL",
];
for (const name of names)
  report(
    name,
    Boolean(process.env[name]?.trim()),
    process.env[name]?.trim() ? "present (value withheld)" : "missing or empty",
  );
const base = process.env.NEXT_PUBLIC_SUPABASE_URL,
  publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
async function request(path, key) {
  const url = new URL(path, base);
  const response = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10000),
  });
  return {
    status: response.status,
    ok: response.ok,
    data: await response.json(),
  };
}
if (base && publicKey) {
  try {
    const settings = await request("/auth/v1/settings", publicKey);
    report("Supabase auth connection", settings.ok, `HTTP ${settings.status}`);
    if (settings.ok) {
      report(
        "Email signup",
        settings.data.external?.email === true &&
          settings.data.disable_signup !== true,
        "email=" +
          Boolean(settings.data.external?.email) +
          ", signup disabled=" +
          Boolean(settings.data.disable_signup),
      );
      console.log(
        "INFO Email confirmation required: " +
          !settings.data.mailer_autoconfirm,
      );
    }
  } catch {
    report(
      "Supabase auth connection",
      false,
      "request failed; check URL, proxy, and network access",
    );
  }
}
if (base && adminKey) {
  try {
    const access = await request("/auth/v1/admin/users?per_page=1", adminKey);
    report(
      "Server-only key access",
      access.ok,
      `HTTP ${access.status} (no user data displayed)`,
    );
    for (const table of [
      "profiles",
      "companies",
      "company_memberships",
      "skills",
      "projects",
      "challenges",
      "challenge_submissions",
      "submission_reviews",
      "achievements",
      "blockchain_proofs",
      "achievement_claims",
      "achievement_evidence",
      "achievement_sharing",
      "achievement_claims",
      "achievement_evidence",
      "achievement_sharing",
    ]) {
      const field =
        table === "company_memberships"
          ? "company_id"
          : table.startsWith("achievement_")
            ? "achievement_id"
            : "id";
      const result = await request(
        `/rest/v1/${table}?select=${field}&limit=0`,
        adminKey,
      );
      report(
        `Table ${table}`,
        result.ok,
        `HTTP ${result.status}${!result.ok && result.data.code === "PGRST205" ? " — missing from exposed schema" : ""}`,
      );
    }
    for (const [table, field] of [
      ["profiles", "passport_previewed_at"],
      ["projects", "skills"],
      ["blockchain_proofs", "claim_version"],
    ]) {
      const result = await request(
        `/rest/v1/${table}?select=${field}&limit=0`,
        adminKey,
      );
      report(
        `Phase 1 column ${table}.${field}`,
        result.ok,
        `HTTP ${result.status}`,
      );
    }
    for (const [table, field] of [
      ["profiles", "passport_previewed_at"],
      ["projects", "skills"],
      ["blockchain_proofs", "claim_version"],
    ]) {
      const result = await request(
        `/rest/v1/${table}?select=${field}&limit=0`,
        adminKey,
      );
      report(
        `Phase 1 column ${table}.${field}`,
        result.ok,
        `HTTP ${result.status}`,
      );
    }
    const schema = await request("/rest/v1/", adminKey);
    if (schema.ok) {
      for (const name of ["create_company", "submit_work", "review_submission"])
        report(
          `Function ${name}`,
          Boolean(schema.data.paths?.[`/rpc/${name}`]),
          schema.data.paths?.[`/rpc/${name}`] ? "exposed" : "not exposed",
        );
    } else report("Database schema inspection", false, `HTTP ${schema.status}`);
  } catch {
    report(
      "Database inspection",
      false,
      "request failed; no migration was executed",
    );
  }
}
for (const name of ["SOLANA_RPC_URL", "NEXT_PUBLIC_SOLANA_RPC_URL"]) {
  try {
    const rpc = new Connection(
      process.env[name] || "https://api.devnet.solana.com",
      "finalized",
    );
    const genesis = await Promise.race([
      rpc.getGenesisHash(),
      new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("timeout")), 10000);
        timer.unref();
      }),
    ]);
    report(
      name + " chain",
      genesis === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      genesis === "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
        ? "Solana devnet confirmed"
        : "not Solana devnet",
    );
  } catch {
    report(name + " chain", false, "RPC request failed; details withheld");
  }
}
try {
  const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (
    site.username ||
    site.password ||
    !["http:", "https:"].includes(site.protocol)
  )
    throw new Error();
  console.log("INFO Public site origin: " + site.origin);
  console.log("INFO Required auth callback: " + site.origin + "/auth/callback");
  console.log(
    "INFO Dashboard redirect allowlist and SMTP settings require a Supabase dashboard check.",
  );
} catch {
  report("Site URL", false, "invalid; configure the public application origin");
}
console.log(
  "INFO No database writes, accounts, or blockchain transactions were created.",
);
process.exitCode = blocked ? 1 : 0;
