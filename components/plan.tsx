"use client";

import { useRef } from "react";
import {
  bounds,
  distance,
  footprint,
  openingPoint,
  clearanceZone,
  wallFrame,
} from "@/lib/geometry";
import {
  formatLength,
  type Item,
  type Placement,
  type Point,
  type Room,
  type Units,
} from "@/lib/schema";
import { snapPlacement } from "@/lib/solver";

type Props = {
  room: Room;
  items: Item[];
  placements: Placement[];
  units: Units;
  selected?: string | null;
  clearance?: boolean;
  compact?: boolean;
  uncertain?: boolean;
  onSelect?: (id: string) => void;
  onMove?: (p: Placement, commit: boolean) => void;
  onDimension?: (wall: number) => void;
};
function labelLines(text: string, limit: number) {
  const lines: string[] = [];
  let remaining = text.trim();
  while (remaining) {
    let end = Math.min(limit, remaining.length);
    if (end < remaining.length) {
      const space = remaining.lastIndexOf(" ", end);
      if (space > 0) end = space;
    }
    lines.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  return lines.length ? lines : [text];
}
export function Plan({
  room,
  items,
  placements,
  units,
  selected,
  clearance,
  compact,
  uncertain,
  onSelect,
  onMove,
  onDimension,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    origin: Placement;
    start: Point;
    pointer: number;
  } | null>(null);
  const b = bounds(room.polygon),
    pad = compact ? 12 : 72;
  const title = labelLines(room.name, Math.max(8, Math.floor(b.width / 24)));
  const address = labelLines(
    room.address || "Measured room plan",
    Math.max(12, Math.floor(b.width / 9)),
  );
  const titleOffset = (title.length - 1) * 24;
  const footerOffset = titleOffset + (address.length - 1) * 15;
  const coords = (event: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const q = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: q.x, y: q.y };
  };
  return (
    <svg
      ref={svgRef}
      className={`ink-plan ${compact ? "compact-plan" : ""}`}
      role="img"
      aria-label={`Dimensioned floor plan of ${room.name}`}
      viewBox={`${b.minX - pad} ${b.minY - pad} ${b.width + 2 * pad} ${b.depth + 2 * pad + (compact ? 0 : 100 + footerOffset)}`}
    >
      <defs>
        <pattern
          id={compact ? "grid-small" : "plan-grid"}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path d="M20 0H0V20" className="grid-line" />
        </pattern>
        <pattern
          id={compact ? "hatch-small" : "clearance-hatch"}
          width="9"
          height="9"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="9" className="hatch-line" />
        </pattern>
      </defs>
      <polygon
        points={room.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
        className={`plan-floor ${uncertain ? "uncertain" : ""}`}
        fill={`url(#${compact ? "grid-small" : "plan-grid"})`}
      />
      {clearance &&
        placements.map((p) => {
          const item = items.find((i) => i.id === p.itemId);
          return (
            item && (
              <polygon
                key={`zone-${p.itemId}`}
                points={clearanceZone(item, p)
                  .map((v) => `${v.x},${v.y}`)
                  .join(" ")}
                className="plan-use-zone"
                fill={`url(#${compact ? "hatch-small" : "clearance-hatch"})`}
              />
            )
          );
        })}
      {room.features.map((f) => (
        <g key={f.id}>
          <rect
            x={f.x - f.width / 2}
            y={f.y - f.depth / 2}
            width={f.width}
            height={f.depth}
            className="fixed-feature"
          />
          {!compact && (
            <text x={f.x} y={f.y + 4} className="plan-label">
              {f.type}
            </text>
          )}
        </g>
      ))}
      {room.openings.map((o) => {
        const { a, tangent, normal } = wallFrame(room, o.wall);
        const start = {
          x: a.x + tangent.x * o.offset,
          y: a.y + tangent.y * o.offset,
        };
        const end = {
          x: start.x + tangent.x * o.width,
          y: start.y + tangent.y * o.width,
        };
        const hinge = o.hinge === "left" ? start : end;
        const door = {
          x: hinge.x + normal.x * o.width,
          y: hinge.y + normal.y * o.width,
        };
        const center = openingPoint(room, o, -20);
        return (
          <g key={o.id} className="plan-opening">
            <line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              className="opening-erase"
            />
            {o.type === "window" ? (
              <>
                {[-3, 3].map((d) => (
                  <line
                    key={d}
                    x1={start.x + normal.x * d}
                    y1={start.y + normal.y * d}
                    x2={end.x + normal.x * d}
                    y2={end.y + normal.y * d}
                    className="window-line"
                  />
                ))}
              </>
            ) : (
              <>
                <line
                  x1={hinge.x}
                  y1={hinge.y}
                  x2={door.x}
                  y2={door.y}
                  className="door-line"
                />
                <path
                  d={`M${o.hinge === "left" ? end.x : start.x},${o.hinge === "left" ? end.y : start.y} A${o.width},${o.width} 0 0 ${o.hinge === "left" ? 1 : 0} ${door.x},${door.y}`}
                  className="door-arc"
                />
              </>
            )}
            {!compact && (
              <text x={center.x} y={center.y} className="opening-label">
                {o.type}
              </text>
            )}
          </g>
        );
      })}
      {placements.map((p) => {
        const item = items.find((i) => i.id === p.itemId);
        if (!item) return null;
        const active = selected === item.id;
        return (
          <g
            key={item.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={`${item.name}, ${formatLength(item.width, units)} by ${formatLength(item.depth, units)}.${onMove ? " Arrow keys move; R rotates." : ""}`}
            aria-pressed={onSelect ? active : undefined}
            className={`plan-item ${active ? "selected" : ""}`}
            data-item={item.id}
            onFocus={() => onSelect?.(item.id)}
            onClick={() => onSelect?.(item.id)}
            onPointerDown={(e) => {
              if (!onMove) return;
              e.preventDefault();
              onSelect?.(item.id);
              drag.current = {
                origin: p,
                start: coords(e),
                pointer: e.pointerId,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (
                !d ||
                d.pointer !== e.pointerId ||
                d.origin.itemId !== item.id ||
                !onMove
              )
                return;
              const point = coords(e);
              onMove(
                snapPlacement(room, item, {
                  ...d.origin,
                  x: d.origin.x + point.x - d.start.x,
                  y: d.origin.y + point.y - d.start.y,
                }),
                false,
              );
            }}
            onPointerUp={(e) => {
              if (!drag.current || drag.current.origin.itemId !== item.id)
                return;
              const point = coords(e),
                d = drag.current;
              onMove?.(
                snapPlacement(room, item, {
                  ...d.origin,
                  x: d.origin.x + point.x - d.start.x,
                  y: d.origin.y + point.y - d.start.y,
                }),
                true,
              );
              drag.current = null;
            }}
            onPointerCancel={() => {
              if (drag.current) onMove?.(drag.current.origin, true);
              drag.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.(item.id);
                return;
              }
              if (!onMove) return;
              if (e.key === "Escape" && drag.current) {
                onMove(drag.current.origin, true);
                drag.current = null;
              }
              const moves: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const move = moves[e.key];
              if (move) {
                e.preventDefault();
                onMove(
                  {
                    ...p,
                    x: p.x + move[0] * (e.shiftKey ? 20 : 5),
                    y: p.y + move[1] * (e.shiftKey ? 20 : 5),
                  },
                  true,
                );
              }
              if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                onMove({ ...p, rotation: (p.rotation + 15) % 360 }, true);
              }
            }}
          >
            <polygon
              points={footprint(item, p)
                .map((v) => `${v.x},${v.y}`)
                .join(" ")}
              className={`furniture-outline tone-${item.color}`}
            />
            <g
              transform={`translate(${p.x} ${p.y}) rotate(${p.rotation})`}
              className="furniture-detail"
            >
              {item.category === "bed" ? (
                <>
                  <rect
                    x={-item.width / 2 + 8}
                    y={-item.depth / 2 + 10}
                    width={item.width - 16}
                    height={35}
                    rx={6}
                  />
                  <line
                    x1={-item.width / 2 + 5}
                    y1={-item.depth / 2 + 55}
                    x2={item.width / 2 - 5}
                    y2={-item.depth / 2 + 55}
                  />
                </>
              ) : item.category === "sofa" ? (
                <>
                  <rect
                    x={-item.width / 2 + 10}
                    y={-item.depth / 2 + 14}
                    width={item.width - 20}
                    height={item.depth - 24}
                    rx={7}
                  />
                  <line
                    x1={0}
                    y1={-item.depth / 2 + 14}
                    x2={0}
                    y2={item.depth / 2 - 10}
                  />
                </>
              ) : (
                <rect
                  x={-item.width / 2 + 5}
                  y={-item.depth / 2 + 5}
                  width={item.width - 10}
                  height={item.depth - 10}
                />
              )}
            </g>
            {!compact && (
              <text x={p.x} y={p.y + 5} className="plan-label">
                {item.name.length > 18
                  ? item.name.slice(0, 16) + "…"
                  : item.name}
              </text>
            )}
          </g>
        );
      })}
      {!compact &&
        room.polygon.map((a, i) => {
          const next = room.polygon[(i + 1) % room.polygon.length],
            { normal, tangent } = wallFrame(room, i);
          const p = {
            x: (a.x + next.x) / 2 - normal.x * 38,
            y: (a.y + next.y) / 2 - normal.y * 38,
          };
          const start = { x: a.x - normal.x * 30, y: a.y - normal.y * 30 };
          const end = { x: next.x - normal.x * 30, y: next.y - normal.y * 30 };
          return (
            <g
              key={`dim-${i}`}
              className={`dimension ${onDimension ? "editable" : ""}`}
              role={onDimension ? "button" : undefined}
              tabIndex={onDimension ? 0 : undefined}
              aria-label={`Edit wall ${i + 1}: ${formatLength(distance(a, next), units)}`}
              onClick={() => onDimension?.(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDimension?.(i);
                }
              }}
            >
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} />
              {[a, next].map((v, n) => (
                <line
                  key={n}
                  x1={v.x - normal.x * 23}
                  y1={v.y - normal.y * 23}
                  x2={v.x - normal.x * 37}
                  y2={v.y - normal.y * 37}
                />
              ))}
              <text
                x={p.x}
                y={p.y}
                transform={`rotate(${Math.abs(tangent.y) > 0.7 ? -90 : 0} ${p.x} ${p.y})`}
              >
                {formatLength(distance(a, next), units)}
              </text>
            </g>
          );
        })}
      {!compact && (
        <>
          <g
            className="north-arrow"
            transform={`translate(${b.maxX + 40} ${b.minY + 30}) rotate(${room.north})`}
          >
            <path d="M0 20V-15M-5-5 0-15 5-5" />
            <text x={0} y={-24}>
              N
            </text>
          </g>
          <g
            className="title-block"
            transform={`translate(${b.minX} ${b.maxY + 65})`}
          >
            <line x1={0} y1={0} x2={b.width} y2={0} />
            <text x={0} y={24} className="plan-title">
              {title.map((line, i) => (
                <tspan key={i} x={0} dy={i ? 24 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={0} y={43 + titleOffset}>
              {address.map((line, i) => (
                <tspan key={i} x={0} dy={i ? 15 : 0}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={0} y={58 + footerOffset}>
              {room.date}
            </text>
            <text x={b.width} y={58 + footerOffset} textAnchor="end">
              1:50 reference
            </text>
            <text x={b.width} y={75 + footerOffset} textAnchor="end">
              Use dimensions, not scale
            </text>
          </g>
        </>
      )}
    </svg>
  );
}
