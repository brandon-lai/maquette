import {
  DEFAULT_CLEARANCE,
  type Category,
  type Item,
  type Project,
  type Room,
} from "./schema";

export function makeItem(
  category: Category,
  name: string,
  width: number,
  depth: number,
  height: number,
  id = crypto.randomUUID(),
): Item {
  return {
    id,
    name,
    category,
    width,
    depth,
    height,
    clearance: DEFAULT_CLEARANCE[category],
    owned: true,
    mustHave: true,
    color:
      category === "sofa" ? "sage" : category === "bed" ? "linen" : "walnut",
    price: null,
    currency: "USD",
    url: null,
    image: null,
    source: "Custom dimensions",
  };
}
export const sampleRoom: Room = {
  name: "The sunlit studio",
  date: "2026-11-26",
  address: "Sample room",
  height: 270,
  north: 0,
  confirmed: true,
  polygon: [
    { x: 0, y: 0 },
    { x: 540, y: 0 },
    { x: 540, y: 460 },
    { x: 0, y: 460 },
  ],
  openings: [
    {
      id: "window",
      type: "window",
      wall: 0,
      offset: 160,
      width: 220,
      sill: 100,
      hinge: "left",
    },
    {
      id: "door",
      type: "door",
      wall: 2,
      offset: 50,
      width: 100,
      sill: 0,
      hinge: "right",
    },
  ],
  features: [],
};
export const sampleItems: Item[] = [
  {
    ...makeItem("bed", "Linen double bed", 140, 200, 95, "bed"),
    clearance: 60.96,
  },
  {
    ...makeItem("desk", "Oak writing desk", 120, 60, 75, "desk"),
    color: "oat",
  },
  {
    ...makeItem("sofa", "Two-seat sofa", 155, 80, 80, "sofa"),
    mustHave: false,
  },
  { ...makeItem("nightstand", "Bedside table", 40, 40, 50, "nightstand") },
];
export const sampleProject: Project = {
  version: 1,
  room: sampleRoom,
  items: sampleItems,
  units: "imperial",
  sample: true,
  brief: {
    purpose: "studio",
    deskByWindow: true,
    bedAwayFromDoor: true,
    walkway: 91.44,
  },
  placements: [
    { itemId: "bed", x: 130.96, y: 100, rotation: 0 },
    { itemId: "desk", x: 300, y: 90, rotation: 270 },
    { itemId: "nightstand", x: 80, y: 290, rotation: 0 },
    { itemId: "sofa", x: 287.5, y: 310, rotation: 0 },
  ],
};
export function roomTemplate(kind: "rectangle" | "dorm" | "lshape"): Room {
  return {
    ...structuredClone(sampleRoom),
    name: kind === "dorm" ? "My dorm room" : "My room",
    address: "",
    date: new Date().toISOString().slice(0, 10),
    confirmed: false,
    openings: [],
    features: [],
    polygon:
      kind === "lshape"
        ? [
            { x: 0, y: 0 },
            { x: 500, y: 0 },
            { x: 500, y: 280 },
            { x: 320, y: 280 },
            { x: 320, y: 450 },
            { x: 0, y: 450 },
          ]
        : [
            { x: 0, y: 0 },
            { x: kind === "dorm" ? 360 : 480, y: 0 },
            { x: kind === "dorm" ? 360 : 480, y: kind === "dorm" ? 420 : 400 },
            { x: 0, y: kind === "dorm" ? 420 : 400 },
          ],
  };
}
