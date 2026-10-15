// Keep unrelated collections out of each dashboard request.
export function portalDataNeeds(role: string, section: string) {
  const talent = role === "talent";
  return {
    projects:
      talent &&
      ["", "projects", "passport", "preview", "achievements"].includes(section),
    achievements:
      talent && ["passport", "preview", "achievements"].includes(section),
    submissions: talent && ["submissions", "activity"].includes(section),
  };
}
