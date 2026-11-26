import {
  bounds,
  distance,
  footprint,
  inside,
  openingPoint,
  openingZone,
  overlaps,
  pointSegmentDistance,
  polygonFits,
  rectangle,
  segmentDistance,
  clearanceZone,
  wallFrame,
} from "./geometry";
import type { Brief, Item, Placement, Point, Room } from "./schema";

export type Warning = { itemId: string; message: string };
export type SetAside = {
  itemId: string;
  reason: string;
  maxWidth: number;
  maxDepth: number;
};
export type Layout = {
  name: string;
  reason: string;
  placements: Placement[];
  aside: SetAside[];
  score: number;
};

function obstacles(room: Room, item: Item, walkway: number) {
  return [
    ...room.openings
      .filter((o) => o.type === "door" || item.height >= o.sill)
      .map((o) => ({
        shape: openingZone(room, o, walkway),
        name: o.type === "door" ? "door swing" : "window",
      })),
    ...room.features
      .filter((f) => f.type !== "outlet")
      .map((f) => ({
        shape: rectangle(
          f.x,
          f.y + (f.type === "closet" ? 30 : 0),
          f.width,
          f.depth + (f.type === "closet" ? 60 : 0),
        ),
        name: f.type,
      })),
  ];
}
export function placementWarnings(
  room: Room,
  items: Item[],
  placements: Placement[],
  brief: Brief,
): Warning[] {
  const warnings: Warning[] = [];
  for (const p of placements) {
    const item = items.find((i) => i.id === p.itemId);
    if (!item) continue;
    const body = footprint(item, p),
      zone = clearanceZone(item, p);
    const add = (message: string) =>
      warnings.push({ itemId: item.id, message: `${item.name}: ${message}` });
    if (!polygonFits(body, room.polygon)) add("extends outside the walls.");
    else if (!polygonFits(zone, room.polygon))
      add("use clearance runs into a wall.");
    if (item.height > room.height) add("is taller than the ceiling.");
    for (const obstacle of obstacles(room, item, brief.walkway)) {
      if (overlaps(body, obstacle.shape)) add(`blocks the ${obstacle.name}.`);
    }
    for (const other of placements) {
      if (other.itemId === item.id) continue;
      const b = items.find((i) => i.id === other.itemId);
      if (b && overlaps(zone, footprint(b, other)))
        add(`needs clearance from ${b.name}.`);
    }
  }
  return warnings;
}
function validPlacement(
  room: Room,
  item: Item,
  p: Placement,
  items: Item[],
  placed: Placement[],
  brief: Brief,
) {
  if (
    item.height > room.height ||
    !polygonFits(clearanceZone(item, p), room.polygon)
  )
    return false;
  const body = footprint(item, p),
    zone = clearanceZone(item, p);
  if (obstacles(room, item, brief.walkway).some((o) => overlaps(body, o.shape)))
    return false;
  return placed.every((other) => {
    const b = items.find((i) => i.id === other.itemId)!;
    return (
      !overlaps(zone, footprint(b, other)) &&
      !overlaps(body, clearanceZone(b, other))
    );
  });
}
function nearestWall(room: Room, p: Point) {
  return Math.min(
    ...room.polygon.map((a, i) =>
      pointSegmentDistance(p, a, room.polygon[(i + 1) % room.polygon.length]),
    ),
  );
}

// A conservative disk-width flood fill verifies routes, not just pairwise gaps.
export function walkwayConnected(
  room: Room,
  items: Item[],
  placements: Placement[],
  width: number,
) {
  if (!placements.length) return true;
  const b = bounds(room.polygon),
    step = 20,
    radius = width / 2;
  const cols = Math.ceil(b.width / step) + 1,
    rows = Math.ceil(b.depth / step) + 1;
  const bodies = placements.map((p) =>
    footprint(
      items.find((i) => i.id === p.itemId)!,
      p,
    ),
  );
  const fixed = room.features
    .filter((f) => f.type !== "outlet")
    .map((f) => rectangle(f.x, f.y, f.width, f.depth));
  const free = new Uint8Array(cols * rows);
  const at = (n: number) => ({
    x: b.minX + (n % cols) * step,
    y: b.minY + Math.floor(n / cols) * step,
  });
  for (let n = 0; n < free.length; n++) {
    const p = at(n);
    free[n] = Number(
      inside(p, room.polygon) &&
        nearestWall(room, p) >= radius - 0.1 &&
        [...bodies, ...fixed].every(
          (s) =>
            !inside(p, s) &&
            s.every(
              (a, i) =>
                pointSegmentDistance(p, a, s[(i + 1) % s.length]) >=
                radius - 0.1,
            ),
        ),
    );
  }
  const door = room.openings.find((o) => o.type === "door");
  if (door && door.width < width - 0.1) return false;
  const entry = door
    ? openingPoint(room, door, radius + step)
    : { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  const candidates = Array.from(free.keys()).filter((n) => free[n]);
  if (!candidates.length) return false;
  const start = candidates.reduce((best, n) =>
    distance(at(n), entry) < distance(at(best), entry) ? n : best,
  );
  if (door && distance(at(start), entry) > step * 1.5) return false;
  const reached = new Set([start]),
    queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    for (const m of [
      n - cols,
      n + cols,
      ...(n % cols ? [n - 1] : []),
      ...(n % cols < cols - 1 ? [n + 1] : []),
    ]) {
      if (
        m >= 0 &&
        m < free.length &&
        free[m] &&
        !reached.has(m) &&
        [room.polygon, ...bodies, ...fixed].every((s) =>
          s.every(
            (a, j) =>
              segmentDistance(at(n), at(m), a, s[(j + 1) % s.length]) >=
              radius - 0.1,
          ),
        )
      ) {
        reached.add(m);
        queue.push(m);
      }
    }
  }
  return (
    placements.every((p) => {
      const item = items.find((i) => i.id === p.itemId)!;
      const r = (p.rotation * Math.PI) / 180;
      const target = {
        x:
          p.x -
          Math.sin(r) * (item.depth / 2 + Math.max(radius, item.clearance / 2)),
        y:
          p.y +
          Math.cos(r) * (item.depth / 2 + Math.max(radius, item.clearance / 2)),
      };
      return [...reached].some((n) => distance(at(n), target) <= radius + step);
    }) &&
    room.openings
      .filter((o) => o.type === "door")
      .every((o) => {
        const target = openingPoint(room, o, radius + step);
        return [...reached].some((n) => distance(at(n), target) <= step * 1.5);
      })
  );
}
export function allWarnings(
  room: Room,
  items: Item[],
  placements: Placement[],
  brief: Brief,
) {
  const result = placementWarnings(room, items, placements, brief);
  if (!walkwayConnected(room, items, placements, brief.walkway))
    result.push({
      itemId: "walkway",
      message: `No connected ${Math.round(brief.walkway)} cm main walkway reaches every placed piece and door.`,
    });
  return result;
}
function scorePlacement(
  room: Room,
  item: Item,
  p: Placement,
  items: Item[],
  placed: Placement[],
  brief: Brief,
  style: number,
) {
  const b = bounds(room.polygon),
    center = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
  let score = -nearestWall(room, p) * 0.2;
  const window = room.openings.find((o) => o.type === "window");
  if (item.category === "desk" && window && brief.deskByWindow)
    score -= distance(p, openingPoint(room, window, 100)) * 2;
  const door = room.openings.find((o) => o.type === "door");
  if (item.category === "bed" && door && brief.bedAwayFromDoor)
    score += distance(p, openingPoint(room, door)) * 0.6;
  const bed = placed.find(
    (v) => items.find((i) => i.id === v.itemId)?.category === "bed",
  );
  if (item.category === "nightstand" && bed) score -= distance(p, bed) * 3;
  const sofa = placed.find(
    (v) => items.find((i) => i.id === v.itemId)?.category === "sofa",
  );
  if (item.category === "tv" && sofa) {
    const r = (sofa.rotation * Math.PI) / 180,
      facing = { x: -Math.sin(r), y: Math.cos(r) };
    const toward = { x: p.x - sofa.x, y: p.y - sofa.y };
    score +=
      (toward.x * facing.x + toward.y * facing.y) * 0.8 -
      Math.abs(toward.x * facing.y - toward.y * facing.x);
  }
  if (style === 0) score -= p.x * 0.5 + p.y * 0.15;
  if (style === 1) score += p.x * 0.5 - p.y * 0.15;
  if (style === 2) score += p.y * 0.55 - distance(p, center) * 0.05;
  score += p.rotation === style * 90 ? 35 : 0;
  return score;
}
function positions(room: Room, item: Item, rotation: number): Placement[] {
  const b = bounds(room.polygon),
    step = 30;
  const probe: Placement = { itemId: item.id, x: 0, y: 0, rotation };
  const u = bounds(clearanceZone(item, probe)),
    body = bounds(footprint(item, probe));
  const xs = new Set<number>(),
    ys = new Set<number>();
  for (let x = b.minX - u.minX; x <= b.maxX - u.maxX + 0.1; x += step)
    xs.add(Math.round(x * 100) / 100);
  for (let y = b.minY - u.minY; y <= b.maxY - u.maxY + 0.1; y += step)
    ys.add(Math.round(y * 100) / 100);
  xs.add(b.maxX - u.maxX);
  ys.add(b.maxY - u.maxY);
  // Wall-aligned candidates keep headboards and furniture backs flush.
  for (const v of room.polygon) {
    xs.add(v.x - body.minX);
    xs.add(v.x - body.maxX);
    ys.add(v.y - body.minY);
    ys.add(v.y - body.maxY);
  }
  return [...xs].flatMap((x) =>
    [...ys].map((y) => ({ itemId: item.id, x, y, rotation })),
  );
}
function maximumFit(
  room: Room,
  item: Item,
  items: Item[],
  placed: Placement[],
  brief: Brief,
) {
  let low = 0,
    high = 1;
  for (let i = 0; i < 7; i++) {
    const scale = (low + high) / 2;
    const smaller = {
      ...item,
      width: Math.max(5, item.width * scale),
      depth: Math.max(5, item.depth * scale),
    };
    const possible = [0, 90, 180, 270].some((r) =>
      positions(room, smaller, r).some(
        (p) =>
          validPlacement(room, smaller, p, items, placed, brief) &&
          walkwayConnected(
            room,
            [...items.filter((i) => i.id !== item.id), smaller],
            [...placed, p],
            brief.walkway,
          ),
      ),
    );
    if (possible) low = scale;
    else high = scale;
  }
  return {
    maxWidth: Math.floor(item.width * low),
    maxDepth: Math.floor(item.depth * low),
  };
}
export function layoutsDistinct(a: Placement[], b: Placement[], items: Item[]) {
  const primary = items.filter((i) =>
    ["bed", "sofa", "desk", "table"].includes(i.category),
  );
  return (
    primary.some((i) => {
      const x = a.find((p) => p.itemId === i.id),
        y = b.find((p) => p.itemId === i.id);
      return (
        !!x &&
        !!y &&
        (distance(x, y) >= Math.max(75, Math.min(i.width, i.depth) / 2) ||
          x.rotation !== y.rotation)
      );
    }) || a.length !== b.length
  );
}
export function solveLayouts(
  room: Room,
  items: Item[],
  brief: Brief,
): Layout[] {
  if (!room.confirmed)
    throw new Error("Confirm the room dimensions before requesting layouts.");
  if (!items.length) return [];
  const sorted = [...items].sort(
    (a, b) =>
      Number(b.mustHave) - Number(a.mustHave) ||
      Number(a.category === "nightstand") -
        Number(b.category === "nightstand") ||
      b.width * b.depth - a.width * a.depth,
  );
  const layouts: Layout[] = [];
  for (let style = 0; style < 6 && layouts.length < 3; style++) {
    const placed: Placement[] = [],
      aside: SetAside[] = [];
    let total = 0;
    for (const item of sorted) {
      const candidates = [0, 90, 180, 270]
        .flatMap((r) => positions(room, item, r))
        .filter((p) => validPlacement(room, item, p, items, placed, brief))
        .map((p) => ({
          p,
          score: scorePlacement(room, item, p, items, placed, brief, style % 3),
        }))
        .sort((a, b) => b.score - a.score);
      const candidate = candidates.find(({ p }) =>
        walkwayConnected(room, items, [...placed, p], brief.walkway),
      );
      if (candidate) {
        placed.push(candidate.p);
        total += candidate.score;
      } else {
        const fit = maximumFit(room, item, items, placed, brief);
        aside.push({
          itemId: item.id,
          reason:
            item.height > room.height
              ? "Taller than the ceiling."
              : item.mustHave
                ? "Must-have piece cannot fit with the current clearances."
                : "No position preserves its use zone and the main walkway.",
          ...fit,
        });
      }
    }
    if (!placed.length || allWarnings(room, items, placed, brief).length)
      continue;
    if (layouts.some((l) => !layoutsDistinct(l.placements, placed, items)))
      continue;
    const desk = placed.find(
      (p) => items.find((i) => i.id === p.itemId)?.category === "desk",
    );
    const window = room.openings.find((o) => o.type === "window");
    const byWindow =
      desk && window && distance(desk, openingPoint(room, window)) < 180;
    const names = [
      "Room to breathe",
      "A different perspective",
      "Another way to settle in",
    ];
    const anchor =
      placed.find((p) =>
        ["bed", "sofa"].includes(
          items.find((i) => i.id === p.itemId)!.category,
        ),
      ) ?? placed[0];
    const anchorItem = items.find((i) => i.id === anchor.itemId)!;
    const angle = (anchor.rotation * Math.PI) / 180;
    const back = {
      x: anchor.x + (Math.sin(angle) * anchorItem.depth) / 2,
      y: anchor.y - (Math.cos(angle) * anchorItem.depth) / 2,
    };
    const wall = room.polygon
      .map((a, i) => ({
        i,
        distance: pointSegmentDistance(
          back,
          a,
          room.polygon[(i + 1) % room.polygon.length],
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0].i;
    const noun =
      anchorItem.category[0].toUpperCase() + anchorItem.category.slice(1);
    const reason = `${noun} oriented from wall ${wall + 1}${byWindow ? ", with the desk near window light." : "; a connected main walkway stays clear."}`;
    layouts.push({
      name: names[layouts.length],
      reason,
      placements: placed,
      aside,
      score: total,
    });
  }
  return layouts;
}
export function snapPlacement(room: Room, item: Item, p: Placement) {
  let x = Math.round(p.x / 5) * 5,
    y = Math.round(p.y / 5) * 5;
  for (let wall = 0; wall < room.polygon.length; wall++) {
    const { a, tangent, normal, length } = wallFrame(room, wall);
    const body = footprint(item, { ...p, x, y });
    const along = body.map(
      (v) => (v.x - a.x) * tangent.x + (v.y - a.y) * tangent.y,
    );
    const gap = Math.min(
      ...body.map((v) => (v.x - a.x) * normal.x + (v.y - a.y) * normal.y),
    );
    if (
      Math.max(...along) >= 0 &&
      Math.min(...along) <= length &&
      Math.abs(gap) < 10
    ) {
      x -= normal.x * gap;
      y -= normal.y * gap;
    }
  }
  return { ...p, x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}
