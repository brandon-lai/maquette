import { describe, expect, it } from "vitest";
import {
  footprint,
  polygonFits,
  rectangle,
  roomError,
  clearanceZone,
} from "../lib/geometry";
import { makeItem, roomTemplate, sampleProject } from "../lib/seed";
import {
  allWarnings,
  layoutsDistinct,
  solveLayouts,
  walkwayConnected,
} from "../lib/solver";
import { decodeProject, encodeProject } from "../lib/storage";
import { extractProduct, measurement } from "../lib/product";
import { publicAddress, validProductUrl } from "../lib/server/safe-fetch";
import { detectBoundary } from "../lib/capture";
import { requestOrigin } from "../lib/server/request-origin";

describe("measured geometry", () => {
  it("rejects a footprint spanning the concave cutout despite inside corners", () => {
    const room = roomTemplate("lshape");
    expect(polygonFits(rectangle(430, 370, 180, 160), room.polygon)).toBe(
      false,
    );
  });
  it("validates crossing walls and openings beyond their wall", () => {
    const r = roomTemplate("rectangle");
    r.openings.push({
      id: "door",
      type: "door",
      wall: 0,
      offset: 450,
      width: 90,
      sill: 0,
      hinge: "left",
    });
    expect(roomError(r)).toMatch(/opening/i);
  });
  it("rotates the use zone together with the exact furniture footprint", () => {
    const bed = makeItem("bed", "Bed", 140, 200, 90, "bed");
    const p = { itemId: "bed", x: 100, y: 200, rotation: 270 };
    expect(footprint(bed, p)[0].x).toBeCloseTo(0);
    expect(Math.max(...clearanceZone(bed, p).map((v) => v.x))).toBeCloseTo(
      260.96,
    );
  });
  it("rejects nonadjacent walls touching and overlapping wall openings", () => {
    const r = roomTemplate("rectangle");
    const door = {
      id: "door-a",
      wall: 0,
      type: "door" as const,
      offset: 50,
      width: 90,
      sill: 0,
      hinge: "left" as const,
    };
    r.openings = [door, { ...door, id: "door-b", offset: 80 }];
    expect(roomError(r)).toMatch(/overlap/i);
    r.openings = [];
    r.polygon = [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 300 },
      { x: 150, y: 300 },
      { x: 150, y: 0 },
      { x: 0, y: 300 },
    ];
    expect(roomError(r)).toMatch(/cross|touch/i);
  });
});
describe("deterministic layout engine", () => {
  it("produces three meaningfully different, collision-free connected layouts", () => {
    const { room, items, brief } = sampleProject;
    const layouts = solveLayouts(room, items, brief);
    expect(layouts).toHaveLength(3);
    for (const l of layouts)
      expect(allWarnings(room, items, l.placements, brief)).toEqual([]);
    for (let i = 0; i < layouts.length; i++)
      for (let j = i + 1; j < layouts.length; j++) {
        expect(
          layoutsDistinct(layouts[i].placements, layouts[j].placements, items),
        ).toBe(true);
      }
  });
  it("opens the sample room with the same verified clearances as suggestions", () => {
    const { room, items, placements, brief } = sampleProject;
    expect(allWarnings(room, items, placements, brief)).toEqual([]);
  });
  it("does not run before dimension confirmation", () => {
    expect(() =>
      solveLayouts(
        roomTemplate("rectangle"),
        sampleProject.items,
        sampleProject.brief,
      ),
    ).toThrow(/confirm/i);
  });
  it("sets an oversize piece aside with an actual smaller fitting size", () => {
    const huge = makeItem("desk", "Oversized desk", 900, 700, 75, "huge");
    const r = { ...roomTemplate("rectangle"), confirmed: true };
    const layouts = solveLayouts(
      r,
      [sampleProject.items[1], huge],
      sampleProject.brief,
    );
    expect(layouts.length).toBeGreaterThan(0);
    const aside = layouts[0].aside.find((a) => a.itemId === "huge");
    expect(aside?.maxWidth).toBeLessThan(900);
    expect(aside?.reason).toMatch(/cannot fit/i);
  });
  it("catches door obstruction and a disconnected route during manual edits", () => {
    const { room, items, brief } = sampleProject;
    const blocked = [{ itemId: "sofa", x: 440, y: 420, rotation: 0 }];
    expect(
      allWarnings(room, items, blocked, brief).some((w) =>
        w.message.includes("door"),
      ),
    ).toBe(true);
    expect(walkwayConnected(room, items, blocked, brief.walkway)).toBe(false);
  });
});
describe("portable share snapshots", () => {
  it("round-trips exact placements and rejects an invalid room", () => {
    expect(decodeProject(encodeProject(sampleProject))).toEqual(sampleProject);
    const invalid = {
      ...sampleProject,
      placements: [{ itemId: "missing", x: 1, y: 1, rotation: 0 }],
    };
    expect(() => encodeProject(invalid)).toThrow();
  });
  it("refuses malformed and oversized links rather than showing sample data", () => {
    expect(() => decodeProject("invalid")).toThrow();
    expect(() => decodeProject("a".repeat(24001))).toThrow(/large/);
  });
});
describe("public product metadata", () => {
  it("checks the public host and protocol rather than Next's internal request origin", () => {
    const request = new Request("http://localhost:3000/api/import", {
      headers: { host: "maquette.example", "x-forwarded-proto": "https" },
    });
    expect(requestOrigin(request)).toBe("https://maquette.example");
  });
  it("converts explicit units and refuses unitless guesses", () => {
    expect(measurement("5 ft 4 in")).toBeCloseTo(162.56);
    expect(measurement({ value: 20, unitCode: "INH" })).toBe(50.8);
    expect(measurement(120)).toBeNull();
    expect(measurement("120")).toBeNull();
  });
  it("extracts product fields and preserves integer minor-unit prices", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "Product",
      name: "Oak desk",
      width: "120 cm",
      depth: "60 cm",
      height: "75 cm",
      color: "Natural oak",
      image: "https://example.com/desk.jpg",
      offers: { price: "199.95", priceCurrency: "USD" },
    })}</script>`;
    const product = extractProduct(html, "https://example.com/desk");
    expect(product).toMatchObject({
      name: "Oak desk",
      width: 120,
      depth: 60,
      height: 75,
      price: 19995,
      color: "Natural oak",
      source: "example.com",
    });
    expect(product.review).toEqual([]);
  });
  it("flags multiple variants and missing measurements instead of assuming dimensions", () => {
    const p = extractProduct(
      `<script type="application/ld+json">[{"@type":"Product","name":"A","width":"100 cm"},{"@type":"Product","name":"B","width":"200 cm"}]</script>`,
      "https://example.com",
    );
    expect(p.width).toBeNull();
    expect(p.review.join(" ")).toMatch(/multiple products/);
  });
  it("rejects private addresses, credentialed URLs and non-HTTPS requests", () => {
    for (const url of [
      "http://example.com",
      "https://127.0.0.1",
      "https://[::1]",
      "https://169.254.169.254",
      "https://user:pass@example.com",
      "https://example.com:8443",
    ])
      expect(() => validProductUrl(url)).toThrow();
    expect(publicAddress("10.0.0.1")).toBe(false);
    expect(publicAddress("100.64.0.1")).toBe(false);
    expect(publicAddress("192.168.1.1")).toBe(false);
    expect(publicAddress("2606:4700:4700::1111")).toBe(true);
    expect(validProductUrl("https://example.com/product").hostname).toBe(
      "example.com",
    );
  });
});
describe("local floor-plan proposals", () => {
  it("finds a raster wall boundary without inventing confident dimensions", () => {
    const w = 300,
      h = 250,
      data = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 25; y <= 225; y++)
      for (let x = 30; x <= 270; x++)
        if (x === 30 || x === 270 || y === 25 || y === 225) {
          const n = (y * w + x) * 4;
          data[n] = data[n + 1] = data[n + 2] = 30;
        }
    expect(detectBoundary(data, w, h)).toMatchObject({
      left: 30,
      right: 270,
      top: 25,
      bottom: 225,
    });
  });
  it("refuses an image without a detectable wall", () => {
    expect(() =>
      detectBoundary(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100),
    ).toThrow(/boundary/);
  });
});
