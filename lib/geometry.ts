import type { Item, Placement, Point, Room } from "./schema";

export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const area = (p: Point[]) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a.x * b.y - b.x * a.y;
  }, 0) / 2;
export function bounds(p: Point[]) {
  const minX = Math.min(...p.map((v) => v.x)),
    minY = Math.min(...p.map((v) => v.y));
  const maxX = Math.max(...p.map((v) => v.x)),
    maxY = Math.max(...p.map((v) => v.y));
  return { minX, minY, maxX, maxY, width: maxX - minX, depth: maxY - minY };
}
const cross = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  return (
    cross(a, b, c) * cross(a, b, d) < -0.01 &&
    cross(c, d, a) * cross(c, d, b) < -0.01
  );
}
export function pointSegmentDistance(p: Point, a: Point, b: Point) {
  const l = distance(a, b) ** 2;
  const t = l
    ? Math.max(
        0,
        Math.min(
          1,
          ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l,
        ),
      )
    : 0;
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}
export function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  if (segmentsCross(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}
export function inside(p: Point, polygon: Point[]) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (pointSegmentDistance(p, a, b) < 0.01) return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      result = !result;
  }
  return result;
}
export function polygonFits(shape: Point[], room: Point[]) {
  return (
    shape.every((p) => inside(p, room)) &&
    shape.every((a, i) => {
      const b = shape[(i + 1) % shape.length];
      if (!inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, room))
        return false;
      return !room.some((c, j) =>
        segmentsCross(a, b, c, room[(j + 1) % room.length]),
      );
    })
  );
}
export function overlaps(a: Point[], b: Point[]) {
  for (const p of [a, b]) {
    for (let i = 0; i < p.length; i++) {
      const edge = p[(i + 1) % p.length],
        v = p[i];
      const normal = { x: -(edge.y - v.y), y: edge.x - v.x };
      const length = Math.hypot(normal.x, normal.y);
      const project = (s: Point[]) =>
        s.map((q) => (q.x * normal.x + q.y * normal.y) / length);
      const x = project(a),
        y = project(b);
      if (
        Math.max(...x) <= Math.min(...y) + 0.05 ||
        Math.max(...y) <= Math.min(...x) + 0.05
      )
        return false;
    }
  }
  return true;
}
export function rectangle(
  x: number,
  y: number,
  w: number,
  d: number,
  angle = 0,
): Point[] {
  const r = (angle * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([u, v]) => ({ x: x + u * c - v * s, y: y + u * s + v * c }));
}
export const footprint = (item: Item, p: Placement) =>
  rectangle(p.x, p.y, item.width, item.depth, p.rotation);
export function clearanceZone(item: Item, p: Placement) {
  const side =
    item.category === "bed" || item.category === "table" ? item.clearance : 0;
  const back = item.category === "table" ? item.clearance : 0;
  const front = item.clearance;
  const r = (p.rotation * Math.PI) / 180;
  const shift = (front - back) / 2;
  return rectangle(
    p.x - Math.sin(r) * shift,
    p.y + Math.cos(r) * shift,
    item.width + 2 * side,
    item.depth + front + back,
    p.rotation,
  );
}
export function wallFrame(room: Room, wall: number) {
  const a = room.polygon[wall],
    b = room.polygon[(wall + 1) % room.polygon.length];
  const length = distance(a, b);
  const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const sign = area(room.polygon) > 0 ? 1 : -1;
  const normal = { x: -tangent.y * sign, y: tangent.x * sign };
  return { a, b, tangent, normal, length };
}
export function openingPoint(
  room: Room,
  o: Room["openings"][number],
  depth = 0,
) {
  const { a, tangent, normal } = wallFrame(room, o.wall);
  return {
    x: a.x + tangent.x * (o.offset + o.width / 2) + normal.x * depth,
    y: a.y + tangent.y * (o.offset + o.width / 2) + normal.y * depth,
  };
}
export function openingZone(
  room: Room,
  o: Room["openings"][number],
  walkway: number,
) {
  const { tangent } = wallFrame(room, o.wall);
  const depth = o.type === "door" ? Math.max(o.width, walkway) : 45.72;
  const p = openingPoint(room, o, depth / 2);
  return rectangle(
    p.x,
    p.y,
    o.width,
    depth,
    (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI,
  );
}
export function roomError(room: Room): string | null {
  const p = room.polygon;
  if (Math.abs(area(p)) < 10000)
    return "The room must enclose at least one square meter.";
  if (p.some((a, i) => distance(a, p[(i + 1) % p.length]) < 30))
    return "Each wall must be at least 30 cm long.";
  for (let i = 0; i < p.length; i++)
    for (let j = i + 2; j < p.length; j++) {
      if (i === 0 && j === p.length - 1) continue;
      if (
        segmentDistance(
          p[i],
          p[(i + 1) % p.length],
          p[j],
          p[(j + 1) % p.length],
        ) < 0.01
      )
        return "Walls cross. Move a corner to make one closed room.";
    }
  for (const o of room.openings) {
    if (
      o.wall >= p.length ||
      o.offset + o.width > wallFrame(room, o.wall).length + 0.1
    )
      return "An opening extends beyond its wall. Adjust its width or position.";
    if (o.type === "window" && o.sill >= room.height - 20)
      return "A window sill must sit below the ceiling.";
    if (
      room.openings.some(
        (other) =>
          other.id !== o.id &&
          other.wall === o.wall &&
          Math.max(other.offset, o.offset) <
            Math.min(other.offset + other.width, o.offset + o.width),
      )
    ) {
      return "Two openings overlap on the same wall. Adjust their positions.";
    }
  }
  for (const f of room.features) {
    if (!polygonFits(rectangle(f.x, f.y, f.width, f.depth), p))
      return "A fixed feature extends outside the room. Adjust its position.";
  }
  return null;
}
