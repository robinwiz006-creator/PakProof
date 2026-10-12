// Use the actual HTTP Host, not Next's internal bind address. Never accept a forwarded host supplied by a caller.
export function requestSiteOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (!["http", "https"].includes(protocol) || /[\s,/@]/.test(host))
    throw new Error("Invalid origin headers");
  return new URL(`${protocol}://${host}`).origin;
}
export function sameRequestOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin");
    return Boolean(
      origin &&
      origin === new URL(origin).origin &&
      origin === requestSiteOrigin(request),
    );
  } catch {
    return false;
  }
}
