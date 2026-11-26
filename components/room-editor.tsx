"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  DoorOpen,
  PencilRuler,
  ScanLine,
  Upload,
  Camera,
  Trash2,
  Plus,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { TextField, Choice } from "./form-controls";
import { Plan } from "./plan";
import { capturePlan } from "@/lib/capture";
import { bounds, distance, roomError, wallFrame } from "@/lib/geometry";
import {
  formatLength,
  fromInput,
  inputLength,
  roomSchema,
  type Point,
  type Room,
  type Units,
} from "@/lib/schema";
import { roomTemplate } from "@/lib/seed";

export function RoomEditor({
  initial,
  units,
  creating,
  onConfirm,
}: {
  initial: Room;
  units: Units;
  creating: boolean;
  onConfirm: (room: Room) => void;
}) {
  const [room, setRoom] = useState<Room>(() =>
    creating ? roomTemplate("rectangle") : structuredClone(initial),
  );
  const [stage, setStage] = useState<"capture" | "confirm">(
    creating ? "capture" : "confirm",
  );
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [wall, setWall] = useState(0);
  const [length, setLength] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [known, setKnown] = useState(inputLength(480, units));
  const fileRef = useRef<HTMLInputElement>(null);
  const drawRef = useRef<SVGSVGElement>(null);
  const unit = units === "metric" ? "cm" : "inches";
  const b = bounds(room.polygon);
  const change = (data: Partial<Room>) => {
    setRoom((r) => ({ ...r, ...data, confirmed: false }));
    setError("");
  };
  function applyLength() {
    const target = fromInput(Number(length), units);
    if (!Number.isFinite(target) || target < 30 || target > 2000) {
      setError("Enter a wall length between 30 and 2000 cm.");
      return;
    }
    const p = [...room.polygon],
      a = p[wall],
      next = (wall + 1) % p.length,
      current = distance(a, p[next]);
    if (
      p.length === 4 &&
      p.every((v, i) => v.x === p[(i + 1) % 4].x || v.y === p[(i + 1) % 4].y)
    ) {
      const horizontal = a.y === p[next].y;
      const scale = target / current;
      change({
        polygon: p.map((v) => ({
          x: horizontal ? b.minX + (v.x - b.minX) * scale : v.x,
          y: horizontal ? v.y : b.minY + (v.y - b.minY) * scale,
        })),
        openings: room.openings.map((o) => {
          const f = wallFrame(room, o.wall);
          return (
            horizontal
              ? Math.abs(f.tangent.x) > 0.9
              : Math.abs(f.tangent.y) > 0.9
          )
            ? { ...o, offset: o.offset * scale }
            : o;
        }),
      });
    } else {
      p[next] = {
        x: a.x + ((p[next].x - a.x) * target) / current,
        y: a.y + ((p[next].y - a.y) * target) / current,
      };
      change({ polygon: p });
    }
    setLength("");
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const result = await capturePlan(file, fromInput(known, units));
      setRoom(result.room);
      setNote(result.note);
      setPreview(result.preview);
      setStage("confirm");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The floor plan could not be read. Try drawing the room.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function confirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = roomSchema.safeParse({ ...room, confirmed: true });
    const problem = result.success
      ? roomError(result.data)
      : result.error.issues[0]?.message;
    if (problem || !result.success) {
      setError(problem ?? "Check the room dimensions.");
      document.getElementById("room-name")?.focus();
      return;
    }
    onConfirm(result.data);
  }
  function addPoint(e: React.PointerEvent<SVGSVGElement>) {
    const svg = drawRef.current!,
      v = svg.createSVGPoint();
    v.x = e.clientX;
    v.y = e.clientY;
    const point = v.matrixTransform(svg.getScreenCTM()!.inverse());
    if (point.x < 0 || point.y < 0 || point.x > 700 || point.y > 600) {
      setError("Tap inside the gridded drawing area to place a corner.");
      return;
    }
    const last = points.at(-1);
    let x = Math.round(point.x / 10) * 10;
    let y = Math.round(point.y / 10) * 10;
    if (last) {
      const angle = Math.atan2(y - last.y, x - last.x);
      const snapped = (Math.round(angle / (Math.PI / 4)) * Math.PI) / 4;
      const len = length
        ? fromInput(Number(length), units)
        : Math.hypot(x - last.x, y - last.y);
      const grid = length ? 0.01 : 10;
      x = Math.round((last.x + Math.cos(snapped) * len) / grid) * grid;
      y = Math.round((last.y + Math.sin(snapped) * len) / grid) * grid;
      if (x < 0 || y < 0 || x > 700 || y > 600) {
        setError(
          "That wall ends outside the drawing sheet. Shorten it or start farther from the edge.",
        );
        return;
      }
    }
    if (points.length >= 3 && distance({ x, y }, points[0]) < 25) {
      closeDrawing();
      return;
    }
    if (points.length >= 24) {
      setError("A room can have at most 24 corners.");
      return;
    }
    if (last && distance(last, { x, y }) < 30) {
      setError("Walls must be at least 30 cm long.");
      return;
    }
    setPoints([...points, { x, y }]);
    setLength("");
    setError("");
  }
  function closeDrawing() {
    if (points.length < 3) {
      setError("Draw at least three corners to close a room.");
      return;
    }
    const minX = Math.min(...points.map((p) => p.x)),
      minY = Math.min(...points.map((p) => p.y));
    const next = {
      ...room,
      polygon: points.map((p) => ({ x: p.x - minX, y: p.y - minY })),
      openings: [],
      features: [],
    };
    const problem = roomError(next);
    if (problem) {
      setError(problem);
      return;
    }
    setRoom(next);
    setDrawing(false);
    setStage("confirm");
  }
  return (
    <DialogContent className="room-dialog">
      <DialogHeader>
        <DialogTitle>
          {stage === "capture"
            ? "Start with your room"
            : "Check every measurement"}
        </DialogTitle>
        <DialogDescription>
          {stage === "capture"
            ? "One room, drawn or uploaded. Your measurements make it real."
            : "Tap a dimension to change it. Confirm only after checking walls and openings."}
        </DialogDescription>
      </DialogHeader>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {stage === "capture" ? (
        <div className="capture-body">
          {!drawing ? (
            <>
              <div className="capture-options">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDrawing(true);
                    setPoints([]);
                  }}
                >
                  <PencilRuler /> Draw the walls
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Upload />
                  {busy ? "Reading your plan…" : "Upload a floor plan"}
                </Button>
                <Button variant="outline" disabled>
                  <ScanLine /> iPhone LiDAR{" "}
                  <span className="muted">Phase 2</span>
                </Button>
                <Button variant="outline" disabled>
                  <Camera /> Room photos <span className="muted">Later</span>
                </Button>
              </div>
              <TextField
                id="known-wall"
                label={`One known wall length (${unit})`}
                type="number"
                min={inputLength(100, units)}
                max={inputLength(2000, units)}
                value={known}
                onChange={(e) => setKnown(Number(e.target.value))}
                hint="For uploaded images this sets the top wall's scale. PDFs use printed dimensions when available; you must review them."
              />
              <input
                ref={fileRef}
                className="sr-only"
                tabIndex={-1}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                aria-label="Upload PDF, PNG, or JPG floor plan"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <div className="template-row">
                <span>Or start with a shape</span>
                {(["rectangle", "dorm", "lshape"] as const).map((kind) => (
                  <Button
                    key={kind}
                    variant="ghost"
                    onClick={() => {
                      setRoom(roomTemplate(kind));
                      setStage("confirm");
                    }}
                  >
                    {kind === "lshape"
                      ? "L-shaped"
                      : kind === "dorm"
                        ? "Dorm"
                        : "Rectangle"}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                Tap corners in order; tap the first corner to close. Snaps to 10
                cm and 45°.
              </p>
              <TextField
                id="next-wall"
                label={`Next wall's exact length (${unit}, optional)`}
                type="number"
                value={length}
                onChange={(e) => setLength(e.target.value)}
              />
              <svg
                ref={drawRef}
                viewBox="-20 -20 740 640"
                className="draw-sheet"
                onPointerDown={addPoint}
                role="img"
                aria-label="Room wall drawing area; use a template and editable dimensions for keyboard entry"
              >
                <defs>
                  <pattern
                    id="draw-grid"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <path d="M20 0H0V20" className="grid-line" />
                  </pattern>
                </defs>
                <rect
                  x="0"
                  y="0"
                  width="700"
                  height="600"
                  fill="url(#draw-grid)"
                />
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  className="draw-walls"
                />
                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="6" />
                    <text x={p.x + 12} y={p.y - 10}>
                      {i + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="button-row">
                <Button
                  variant="ghost"
                  onClick={() => setPoints(points.slice(0, -1))}
                >
                  Undo corner
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDrawing(false);
                    setStage("confirm");
                  }}
                >
                  Use measured template
                </Button>
                <Button onClick={closeDrawing}>Close the room</Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={confirm} className="room-form">
          {note && <p className="review-note">{note}</p>}
          <div className="room-edit-grid">
            <div className="confirm-plan">
              <Plan
                room={room}
                items={[]}
                placements={[]}
                units={units}
                uncertain={Boolean(note)}
                onDimension={(i) => {
                  setWall(i);
                  setLength(
                    String(
                      inputLength(
                        distance(
                          room.polygon[i],
                          room.polygon[(i + 1) % room.polygon.length],
                        ),
                        units,
                      ),
                    ),
                  );
                  document.getElementById("wall-length")?.focus();
                }}
              />
              {preview && (
                <details>
                  <summary>Original uploaded plan</summary>
                  <Image
                    unoptimized
                    src={preview}
                    width={800}
                    height={800}
                    alt="Original uploaded floor plan for measurement review"
                  />
                </details>
              )}
            </div>
            <div className="room-fields">
              <TextField
                id="room-name"
                label="Room name"
                required
                maxLength={80}
                value={room.name}
                onChange={(e) => change({ name: e.target.value })}
              />
              <TextField
                id="room-address"
                label="Title-block address (optional)"
                maxLength={160}
                value={room.address}
                onChange={(e) => change({ address: e.target.value })}
                hint="Leave private addresses out of shared rooms."
              />
              <div className="form-pair">
                <TextField
                  id="ceiling-height"
                  label={`Ceiling (${unit})`}
                  type="number"
                  min={inputLength(150, units)}
                  max={inputLength(600, units)}
                  required
                  step=".1"
                  value={inputLength(room.height, units)}
                  onChange={(e) =>
                    change({ height: fromInput(Number(e.target.value), units) })
                  }
                />
                <TextField
                  id="north"
                  label="North (degrees)"
                  type="number"
                  min="0"
                  max="359"
                  value={room.north}
                  onChange={(e) => change({ north: Number(e.target.value) })}
                />
              </div>
              <Choice
                id="wall-number"
                label="Wall to measure"
                value={String(wall)}
                options={room.polygon.map((a, i) => ({
                  value: String(i),
                  label: `Wall ${i + 1}: ${formatLength(distance(a, room.polygon[(i + 1) % room.polygon.length]), units)}`,
                }))}
                onChange={(v) => {
                  setWall(Number(v));
                  setLength("");
                }}
              />
              <div className="inline-field">
                <TextField
                  id="wall-length"
                  label={`Exact wall length (${unit})`}
                  type="number"
                  min="1"
                  step=".1"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={applyLength}>
                  Apply length
                </Button>
              </div>
              <details>
                <summary>Edit corner coordinates</summary>
                <div className="corner-table">
                  {room.polygon.map((p, i) => (
                    <div className="form-pair" key={i}>
                      {(["x", "y"] as const).map((axis) => (
                        <TextField
                          key={axis}
                          id={`corner-${i}-${axis}`}
                          label={`Corner ${i + 1} ${axis} (${unit})`}
                          type="number"
                          min="0"
                          step=".1"
                          value={inputLength(p[axis], units)}
                          onChange={(e) =>
                            change({
                              polygon: room.polygon.map((v, j) =>
                                j === i
                                  ? {
                                      ...v,
                                      [axis]: fromInput(
                                        Number(e.target.value),
                                        units,
                                      ),
                                    }
                                  : v,
                              ),
                            })
                          }
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
          <section className="openings-editor">
            <div className="section-head">
              <h3>Doors and windows</h3>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  change({
                    openings: [
                      ...room.openings,
                      {
                        id: crypto.randomUUID(),
                        wall: 0,
                        type: "door",
                        offset: 20,
                        width: 91.44,
                        sill: 0,
                        hinge: "left",
                      },
                    ],
                  })
                }
              >
                <Plus />
                Add opening
              </Button>
            </div>
            {!room.openings.length && (
              <p className="muted">
                Add the entry door so the layout can protect its swing and
                walkway.
              </p>
            )}
            {room.openings.map((o, i) => {
              const update = (value: Partial<typeof o>) =>
                change({
                  openings: room.openings.map((v, j) =>
                    i === j ? { ...v, ...value } : v,
                  ),
                });
              return (
                <div className="opening-row" key={o.id}>
                  <Choice
                    id={`opening-type-${i}`}
                    label="Type"
                    value={o.type}
                    options={[
                      { value: "door", label: "Door" },
                      { value: "window", label: "Window" },
                    ]}
                    onChange={(v) =>
                      update({
                        type: v as typeof o.type,
                        sill: v === "window" ? 100 : 0,
                      })
                    }
                  />
                  <Choice
                    id={`opening-wall-${i}`}
                    label="Wall"
                    value={String(o.wall)}
                    options={room.polygon.map((_, n) => ({
                      value: String(n),
                      label: `Wall ${n + 1}`,
                    }))}
                    onChange={(v) => update({ wall: Number(v) })}
                  />
                  <TextField
                    id={`opening-offset-${i}`}
                    label={`Start (${unit})`}
                    type="number"
                    min="0"
                    step=".1"
                    value={inputLength(o.offset, units)}
                    onChange={(e) =>
                      update({
                        offset: fromInput(Number(e.target.value), units),
                      })
                    }
                  />
                  <TextField
                    id={`opening-width-${i}`}
                    label={`Width (${unit})`}
                    type="number"
                    min="1"
                    step=".1"
                    value={inputLength(o.width, units)}
                    onChange={(e) =>
                      update({
                        width: fromInput(Number(e.target.value), units),
                      })
                    }
                  />
                  {o.type === "door" ? (
                    <Choice
                      id={`hinge-${i}`}
                      label="Swing hinge"
                      value={o.hinge}
                      options={[
                        { value: "left", label: "Left, inward" },
                        { value: "right", label: "Right, inward" },
                      ]}
                      onChange={(v) => update({ hinge: v as typeof o.hinge })}
                    />
                  ) : (
                    <TextField
                      id={`sill-${i}`}
                      label={`Sill (${unit})`}
                      type="number"
                      min="0"
                      step=".1"
                      value={inputLength(o.sill, units)}
                      onChange={(e) =>
                        update({
                          sill: fromInput(Number(e.target.value), units),
                        })
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    aria-label={`Remove opening ${i + 1}`}
                    onClick={() =>
                      change({
                        openings: room.openings.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
          </section>
          <section className="openings-editor">
            <div className="section-head">
              <h3>Fixed features</h3>
              <Button
                variant="outline"
                type="button"
                onClick={() =>
                  change({
                    features: [
                      ...room.features,
                      {
                        id: crypto.randomUUID(),
                        type: "radiator",
                        x: b.width / 2,
                        y: 15,
                        width: 90,
                        depth: 20,
                      },
                    ],
                  })
                }
              >
                <Plus />
                Add feature
              </Button>
            </div>
            {room.features.map((f, i) => (
              <div className="opening-row" key={f.id}>
                <Choice
                  id={`feature-type-${i}`}
                  label="Type"
                  value={f.type}
                  options={["closet", "radiator", "outlet"].map((v) => ({
                    value: v,
                    label: v[0].toUpperCase() + v.slice(1),
                  }))}
                  onChange={(v) =>
                    change({
                      features: room.features.map((x, j) =>
                        j === i ? { ...x, type: v as typeof f.type } : x,
                      ),
                    })
                  }
                />
                {(["x", "y", "width", "depth"] as const).map((key) => (
                  <TextField
                    key={key}
                    id={`feature-${i}-${key}`}
                    label={`${key} (${unit})`}
                    type="number"
                    min="0"
                    step=".1"
                    value={inputLength(f[key], units)}
                    onChange={(e) =>
                      change({
                        features: room.features.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                [key]: fromInput(Number(e.target.value), units),
                              }
                            : x,
                        ),
                      })
                    }
                  />
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove feature ${i + 1}`}
                  onClick={() =>
                    change({
                      features: room.features.filter((_, j) => j !== i),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </section>
          <div className="dialog-actions">
            {creating && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setStage("capture")}
              >
                <ArrowLeft />
                Capture options
              </Button>
            )}
            <span className="muted">Dimensions are yours to verify.</span>
            <Button type="submit">
              <DoorOpen />
              Confirm the room
            </Button>
          </div>
        </form>
      )}
    </DialogContent>
  );
}
