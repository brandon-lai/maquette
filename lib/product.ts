import * as cheerio from "cheerio";
import { measurement } from "./measurement";
export { measurement } from "./measurement";

export type ProductDraft = {
  name: string;
  width: number | null;
  depth: number | null;
  height: number | null;
  price: number | null;
  currency: string;
  color: string;
  image: string | null;
  source: string;
  url: string;
  review: string[];
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function findProducts(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(findProducts);
  const obj = object(node),
    type = obj["@type"];
  const isProduct =
    type === "Product" || (Array.isArray(type) && type.includes("Product"));
  return [
    ...(isProduct ? [obj] : []),
    ...Object.values(obj)
      .filter((v) => typeof v === "object")
      .flatMap(findProducts),
  ];
}
export function extractProduct(html: string, url: string): ProductDraft {
  const $ = cheerio.load(html);
  const found: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const text = $(element).text();
    try {
      found.push(...findProducts(JSON.parse(text)));
    } catch {
      /* Malformed retailer JSON-LD is ignored; review fields remain explicit. */
    }
  });
  const p = found[0] ?? {};
  const properties = (
    Array.isArray(p.additionalProperty)
      ? p.additionalProperty
      : [p.additionalProperty]
  ).map(object);
  const dimension = (key: string, alias?: string) => {
    const property = properties.find(
      (v) => String(v.name ?? "").toLowerCase() === key,
    );
    return (
      measurement(p[key] ?? (alias ? p[alias] : null)) ?? measurement(property)
    );
  };
  const rawOffer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
  const offer = object(rawOffer);
  const rawPrice =
    offer.price ?? $('meta[property="product:price:amount"]').attr("content");
  const numericPrice =
    typeof rawPrice === "number" || typeof rawPrice === "string"
      ? Number(rawPrice)
      : NaN;
  const price =
    Number.isFinite(numericPrice) &&
    numericPrice >= 0 &&
    numericPrice <= 1000000
      ? Math.round(numericPrice * 100)
      : null;
  const rawCurrency = String(
    offer.priceCurrency ??
      $('meta[property="product:price:currency"]').attr("content") ??
      "USD",
  );
  const rawImage = Array.isArray(p.image) ? p.image[0] : p.image;
  const imageValue =
    typeof rawImage === "string"
      ? rawImage
      : (object(rawImage).url ??
        $('meta[property="og:image"]').attr("content"));
  let image: string | null = null;
  if (typeof imageValue === "string") {
    try {
      const u = new URL(imageValue, url);
      if (u.protocol === "https:") image = u.href;
    } catch {
      /* An invalid image URL is a missing field, never a broken preview. */
    }
  }
  const result: ProductDraft = {
    name: String(
      p.name ??
        $('meta[property="og:title"]').attr("content") ??
        $("title").text(),
    )
      .trim()
      .slice(0, 80),
    width: dimension("width"),
    depth: dimension("depth", "length"),
    height: dimension("height"),
    price,
    currency: /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "USD",
    color: String(p.color ?? "").slice(0, 80),
    image,
    url,
    source: new URL(url).hostname,
    review: [],
  };
  if (found.length > 1) {
    result.width = null;
    result.depth = null;
    result.height = null;
    result.review.push(
      "This page lists multiple products. Enter dimensions for the exact variant.",
    );
  }
  for (const field of ["width", "depth", "height"] as const)
    if (!result[field])
      result.review.push(
        `Confirm ${field}; the page did not provide an unambiguous measurement.`,
      );
  if (!result.name) result.review.push("Enter the product name.");
  if (price === null)
    result.review.push(
      "Price was not provided; leave it blank or enter the current price.",
    );
  return result;
}
