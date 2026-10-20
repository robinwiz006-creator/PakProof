export function projectApplicationState(
  input: {
    signedIn: boolean;
    companyMember: boolean;
    hasApplication: boolean;
    status: string;
    deadline: string;
  },
  today = new Date().toISOString().slice(0, 10),
) {
  if (input.companyMember) return "manage";
  if (input.hasApplication) return "applied";
  if (input.status !== "published" || input.deadline < today) return "closed";
  return input.signedIn ? "apply" : "sign-in";
}
