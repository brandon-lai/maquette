import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  if (isIP(address) === 6) {
    // Only globally routed IPv6 unicast, excluding documentation and mapped IPv4.
    return (
      /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address)
    );
  }
  return false;
}
export function validProductUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error(
      "Use a public HTTPS product link without a username, password, or custom port.",
    );
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (isIP(host) && !publicAddress(host))
  ) {
    throw new Error("Private-network links cannot be imported.");
  }
  return url;
}
async function oneRequest(
  url: URL,
  signal: AbortSignal,
): Promise<{ status: number; location?: string; html: string }> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(host, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("This link resolves to a private or reserved network.");
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        signal,
        headers: {
          "User-Agent": "Maquette/1.0 (user-requested product metadata)",
          Accept: "text/html",
          "Accept-Encoding": "identity",
        },
        lookup: (_hostname, _options, cb) =>
          cb(null, pinned.address, pinned.family),
      },
      (res) => {
        const status = res.statusCode ?? 502;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          resolve({ status, location: res.headers.location, html: "" });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(
            new Error(
              `The store returned HTTP ${status}. Add the item manually or try its public product page.`,
            ),
          );
          return;
        }
        if (!res.headers["content-type"]?.includes("text/html")) {
          res.resume();
          reject(new Error("This link is not an HTML product page."));
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            req.destroy(new Error("This product page is too large to import."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({ status, html: Buffer.concat(chunks).toString("utf8") }),
        );
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}
export async function fetchProductPage(value: string) {
  let url = validProductUrl(value);
  const signal = AbortSignal.timeout(12000);
  for (let n = 0; n < 5; n++) {
    const result = await oneRequest(url, signal);
    if (!result.location) return { html: result.html, url: url.href };
    url = validProductUrl(new URL(result.location, url).href);
  }
  throw new Error(
    "This store redirects too many times. Use its final public product link.",
  );
}
