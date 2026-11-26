import { extractProduct, type ProductDraft } from "@/lib/product";
import { fetchProductPage } from "@/lib/server/safe-fetch";
import { requestOrigin } from "@/lib/server/request-origin";

const cache = new Map<string, { value: ProductDraft; expires: number }>();
let active = 0;
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== requestOrigin(request)
  ) {
    return Response.json(
      { error: "Product import must be requested from this app." },
      { status: 403 },
    );
  }
  if (active >= 5)
    return Response.json(
      { error: "Product import is busy. Try again shortly." },
      { status: 429 },
    );
  const body = await request.text();
  if (body.length > 3000)
    return Response.json(
      { error: "The product link is too long." },
      { status: 413 },
    );
  let url: string;
  try {
    const data = JSON.parse(body);
    if (typeof data.url !== "string" || data.url.length > 2000)
      throw new Error();
    url = data.url;
  } catch {
    return Response.json({ error: "Provide a product URL." }, { status: 400 });
  }
  const cached = cache.get(url);
  if (cached && cached.expires > Date.now()) return Response.json(cached.value);
  active++;
  try {
    const page = await fetchProductPage(url);
    const value = extractProduct(page.html, page.url);
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(url, { value, expires: Date.now() + 900000 });
    return Response.json(value);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Product import failed.";
    console.warn("Product import refused or failed:", message);
    return Response.json({ error: message }, { status: 422 });
  } finally {
    active--;
  }
}
