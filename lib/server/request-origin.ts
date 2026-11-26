export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const protocol =
    request.headers.get("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  return `${protocol}://${request.headers.get("host") ?? url.host}`;
}
