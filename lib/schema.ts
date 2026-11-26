import { z } from "zod";

export const pointSchema = z.object({
  x: z.number().finite().min(0).max(2000),
  y: z.number().finite().min(0).max(2000),
});
export const categories = [
  "bed",
  "sofa",
  "desk",
  "chair",
  "dresser",
  "nightstand",
  "table",
  "tv",
] as const;
export type Category = (typeof categories)[number];
const dimension = z.number().finite().min(5).max(1000);
const identifier = z.string().min(1).max(80);
const httpsUrl = z
  .string()
  .url()
  .max(2000)
  .refine((v) => new URL(v).protocol === "https:", "Use an HTTPS link.");

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  address: z.string().max(160),
  polygon: z.array(pointSchema).min(3).max(24),
  height: z.number().finite().min(150).max(600),
  north: z.number().finite().min(0).max(359),
  confirmed: z.boolean(),
  openings: z
    .array(
      z.object({
        id: identifier,
        wall: z.number().int().min(0).max(23),
        type: z.enum(["door", "window"]),
        offset: z.number().finite().min(0).max(2000),
        width: z.number().finite().min(30).max(600),
        sill: z.number().finite().min(0).max(300),
        hinge: z.enum(["left", "right"]),
      }),
    )
    .max(30),
  features: z
    .array(
      z.object({
        id: identifier,
        type: z.enum(["closet", "radiator", "outlet"]),
        x: z.number().finite().min(0).max(2000),
        y: z.number().finite().min(0).max(2000),
        width: dimension,
        depth: dimension,
      }),
    )
    .max(30),
});
export const itemSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(80),
  category: z.enum(categories),
  width: dimension,
  depth: dimension,
  height: dimension,
  clearance: z.number().finite().min(0).max(200),
  owned: z.boolean(),
  mustHave: z.boolean(),
  color: z.enum(["linen", "sage", "walnut", "oat", "charcoal"]),
  price: z.number().int().min(0).max(100000000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  url: httpsUrl.nullable(),
  image: httpsUrl.nullable(),
  source: z.string().max(100),
});
export const placementSchema = z.object({
  itemId: identifier,
  x: z.number().finite().min(-1000).max(3000),
  y: z.number().finite().min(-1000).max(3000),
  rotation: z.number().finite().min(0).max(359),
});
export const briefSchema = z.object({
  purpose: z.enum(["studio", "bedroom", "living", "dorm"]),
  deskByWindow: z.boolean(),
  bedAwayFromDoor: z.boolean(),
  walkway: z.number().finite().min(60).max(150),
});
export const projectSchema = z
  .object({
    version: z.literal(1),
    room: roomSchema,
    items: z.array(itemSchema).max(24),
    placements: z.array(placementSchema).max(24),
    brief: briefSchema,
    units: z.enum(["imperial", "metric"]),
    sample: z.boolean(),
  })
  .superRefine((p, ctx) => {
    const ids = p.items.map((i) => i.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Furniture identifiers must be unique.",
      });
    const placed = p.placements.map((i) => i.itemId);
    if (
      new Set(placed).size !== placed.length ||
      placed.some((id) => !ids.includes(id))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Placements must refer to unique furniture items.",
      });
    }
  });
export type Point = z.infer<typeof pointSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Placement = z.infer<typeof placementSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Units = Project["units"];

export const DEFAULT_CLEARANCE: Record<Category, number> = {
  bed: 60.96,
  sofa: 45.72,
  desk: 91.44,
  chair: 60.96,
  dresser: 91.44,
  nightstand: 30.48,
  table: 60.96,
  tv: 30.48,
};

export function formatLength(cm: number, units: Units) {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const inches = Math.round(cm / 2.54);
  return `${Math.floor(inches / 12)}′ ${inches % 12}″`;
}
export function inputLength(cm: number, units: Units) {
  return Number((units === "metric" ? cm : cm / 2.54).toFixed(1));
}
export function fromInput(value: number, units: Units) {
  return units === "metric" ? value : value * 2.54;
}
export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}
