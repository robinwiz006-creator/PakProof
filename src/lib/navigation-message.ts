/** Keep the active workflow/query intact when attaching feedback to an internal redirect. */
export function messageLink(path: string, message: string) {
  const origin = "https://proofpak.invalid";
  const url = new URL(path, origin);
  if (!path.startsWith("/") || url.origin !== origin)
    throw new Error("Only internal application redirects are allowed.");
  url.searchParams.set("message", message);
  return `${url.pathname}${url.search}${url.hash}`;
}
