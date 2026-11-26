"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowDownToLine,
  Armchair,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  DoorOpen,
  ExternalLink,
  Grid2X2,
  Layers3,
  Maximize2,
  Move,
  Pencil,
  Plus,
  RotateCcw,
  RotateCw,
  Settings2,
  Share2,
  ShoppingBag,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Field, FieldLabel } from "./ui/field";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { TextField, Choice } from "./form-controls";
import { Plan } from "./plan";
import { RoomEditor } from "./room-editor";
import { ItemEditor } from "./item-editor";
import { PositionEditor } from "./position-editor";
import { SharePanel } from "./share-panel";
import { projectStore } from "@/lib/project-store";
import { browserCapabilities } from "@/lib/browser-capabilities";
import {
  briefSchema,
  formatLength,
  fromInput,
  inputLength,
  money,
  type Item,
  type Placement,
  type Project,
} from "@/lib/schema";
import { allWarnings, solveLayouts, type Layout } from "@/lib/solver";
import { sampleProject } from "@/lib/seed";
import { validateProject } from "@/lib/storage";
import { area, bounds } from "@/lib/geometry";
import type { SceneView } from "./room-scene";

const RoomScene = dynamic(() => import("./room-scene"), {
  ssr: false,
  loading: () => (
    <div className="scene-loading" role="status">
      Unfolding your miniature…
    </div>
  ),
});
const inputKey = (p: Project) => JSON.stringify([p.room, p.items, p.brief]);
type Panel =
  "new" | "room" | "item" | "position" | "share" | "settings" | "shop" | null;
const clockTime = (time: number) =>
  `${time >= 12 ? Math.floor(time) - 12 || 12 : Math.floor(time)}:${time % 1 ? "30" : "00"} ${time >= 12 ? "pm" : "am"}`;
function IconAction({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label} {...props} />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function Planner({
  shared = false,
  cloudStorage = false,
}: {
  shared?: boolean;
  cloudStorage?: boolean;
}) {
  const snapshot = useSyncExternalStore(
    projectStore.subscribe,
    projectStore.getSnapshot,
    projectStore.getServerSnapshot,
  );
  const { reduced } = useSyncExternalStore(
    browserCapabilities.subscribe,
    browserCapabilities.getSnapshot,
    browserCapabilities.getServerSnapshot,
  );
  const { project, ready, error, invalid } = snapshot;
  const readOnly = shared || snapshot.readOnly;
  const saveStatus = readOnly
    ? "View-only snapshot"
    : project.sample
      ? "Sample room"
      : error
        ? "Not saved"
        : "Saved in this browser";
  const [view, setView] = useState<SceneView>("miniature");
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [editing, setEditing] = useState<Item | undefined>();
  const [clearance, setClearance] = useState(false);
  const [time, setTime] = useState(16.5);
  const [buildKey, setBuildKey] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);
  const [partCount, setPartCount] = useState(0);
  const [inventory, setInventory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeLayout, setActiveLayout] = useState(-1);
  const [result, setResult] = useState(() => ({
    key: inputKey(sampleProject),
    layouts: solveLayouts(
      sampleProject.room,
      sampleProject.items,
      sampleProject.brief,
    ),
  }));
  const worker = useRef<Worker | null>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const onReady = useCallback(() => setSceneReady(true), []);
  const roomBounds = bounds(project.room.polygon);
  const selectedItem = project.items.find((i) => i.id === selected);
  const selectedPlacement = project.placements.find(
    (p) => p.itemId === selected,
  );
  const warnings = useMemo(
    () =>
      allWarnings(
        project.room,
        project.items,
        project.placements,
        project.brief,
      ),
    [project],
  );
  const missing = project.items.filter(
    (i) => !project.placements.some((p) => p.itemId === i.id),
  );
  const layouts = result.key === inputKey(project) ? result.layouts : [];
  const knownAside = layouts[activeLayout]?.aside;
  const fitPending =
    !project.items.length || (missing.length > 0 && !knownAside?.length);
  const totalParts =
    project.room.polygon.length +
    project.room.openings.length +
    project.placements.length;
  const update = (p: Project, persist = true) =>
    projectStore.update(p, persist);
  useEffect(() => {
    projectStore.load();
  }, [shared]);
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (!ready || (!sceneReady && view !== "plan")) return;
    if (reduced) return;
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setPartCount(Math.min(count, totalParts));
      if (count >= totalParts) clearInterval(timer);
    }, 110);
    return () => clearInterval(timer);
  }, [buildKey, sceneReady, totalParts, ready, view, reduced]);
  function move(p: Placement, commit: boolean) {
    const next = {
      ...p,
      x: Math.max(-1000, Math.min(3000, p.x)),
      y: Math.max(-1000, Math.min(3000, p.y)),
    };
    update(
      {
        ...project,
        placements: project.placements.map((v) =>
          v.itemId === next.itemId ? next : v,
        ),
      },
      commit,
    );
    setActiveLayout(-1);
  }
  function generate() {
    if (!project.items.length) {
      setEditing(undefined);
      setPanel("item");
      return;
    }
    setBusy(true);
    setActiveLayout(-1);
    const currentKey = inputKey(project);
    const job = new Worker(new URL("../lib/layout-worker.ts", import.meta.url));
    worker.current = job;
    const timeout = setTimeout(() => {
      job.terminate();
      setBusy(false);
      toast.error(
        "The layout search took too long. Try fewer pieces or smaller clearance zones.",
      );
    }, 30000);
    job.onmessage = (
      event: MessageEvent<{ layouts?: Layout[]; error?: string }>,
    ) => {
      clearTimeout(timeout);
      job.terminate();
      worker.current = null;
      setBusy(false);
      if (event.data.error) {
        toast.error(event.data.error);
        return;
      }
      const generated = event.data.layouts ?? [];
      setResult({ key: currentKey, layouts: generated });
      if (!generated.length) {
        toast.error(
          "No complete arrangement fits the current constraints. Reduce furniture sizes or revise the room measurements.",
        );
        return;
      }
      update({ ...project, placements: generated[0].placements });
      setActiveLayout(0);
      setSelected(null);
      setBuildKey((k) => k + 1);
      if (generated.length < 3)
        toast.info(
          `Only ${generated.length} distinct feasible arrangement${generated.length === 1 ? "" : "s"} fit. No duplicate layouts were added.`,
        );
    };
    job.onerror = () => {
      clearTimeout(timeout);
      job.terminate();
      setBusy(false);
      toast.error(
        "The layout engine could not start. Reload the page and try again.",
      );
    };
    job.postMessage(project);
  }
  function confirmRoom(room: Project["room"]) {
    update({ ...project, room, placements: [], sample: false });
    setSelected(null);
    setPanel(null);
    setActiveLayout(-1);
    setBuildKey((k) => k + 1);
  }
  function saveItem(item: Item) {
    if (!editing && project.items.length >= 24) {
      toast.error(
        "A room can contain at most 24 pieces. Remove one before adding another.",
      );
      return;
    }
    update({
      ...project,
      sample: false,
      items: editing
        ? project.items.map((i) => (i.id === item.id ? item : i))
        : [...project.items, item],
    });
    setPanel(null);
    setSelected(item.id);
    setActiveLayout(-1);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000)
        throw new Error("The room file must be smaller than 100 KB.");
      update(validateProject(JSON.parse(await file.text())));
      setSelected(null);
      setActiveLayout(-1);
      setBuildKey((k) => k + 1);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "The room file could not be read.",
      );
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  if (invalid)
    return (
      <main className="document-page">
        <Box size={36} />
        <h1>This room link lost its plan</h1>
        <p>{error}</p>
        <Link href="/">Open Maquette</Link>
      </main>
    );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#room-workspace">
        Skip to the room
      </a>
      <header className="app-header">
        <Link href="/" className="wordmark" aria-label="Maquette home">
          <Box size={23} strokeWidth={1.5} />
          maquette
          <span className="brand-caption">Measure first. Move once.</span>
        </Link>
        <div className="header-actions">
          <span className="save-status">{saveStatus}</span>
          <Button
            variant="ghost"
            className="unit-switch"
            aria-label={`${project.units === "imperial" ? "ft / in" : "cm"}. Switch to ${project.units === "imperial" ? "metric" : "feet and inches"}`}
            onClick={() =>
              update({
                ...project,
                units: project.units === "imperial" ? "metric" : "imperial",
              })
            }
            disabled={readOnly || busy}
          >
            {project.units === "imperial" ? "ft / in" : "cm"}
          </Button>
          {!readOnly && (
            <IconAction
              label="Room settings"
              disabled={busy}
              onClick={() => setPanel("settings")}
            >
              <Settings2 />
            </IconAction>
          )}
          <Button variant="outline" onClick={() => setPanel("share")}>
            <Share2 />
            Share room
          </Button>
        </div>
      </header>
      {error && (
        <div className="storage-warning" role="alert">
          {error}
        </div>
      )}
      {readOnly && (
        <div className="shared-note">
          <span>
            Someone’s room, exactly as they arranged it. This link cannot edit
            their original.
          </span>
          <Link href="/">Plan your own room</Link>
        </div>
      )}
      <main className="workspace" id="room-workspace">
        <aside
          className={`inventory-tray ${inventory ? "inventory-open" : ""}`}
        >
          <button
            className="inventory-disclosure"
            type="button"
            aria-expanded={inventory}
            onClick={() => setInventory(!inventory)}
          >
            <Armchair size={18} />
            Your pieces <span>{project.items.length}</span>
            <ChevronDown size={18} />
          </button>
          <div className="inventory-content">
            <div className="tray-heading">
              <h2>{readOnly ? "The pieces" : "Your pieces"}</h2>
              <span className="measure">{project.items.length}</span>
            </div>
            <p className="tray-intro">
              {project.sample
                ? "Sample furniture. Replace it with yours."
                : "Owned, borrowed, or on your wish list."}
            </p>
            <div className="piece-list">
              {project.items.length ? (
                project.items.map((item) => {
                  const placed = project.placements.some(
                    (p) => p.itemId === item.id,
                  );
                  return (
                    <div
                      className={`piece-row ${selected === item.id ? "piece-selected" : ""}`}
                      key={item.id}
                    >
                      <button
                        type="button"
                        className="piece-select"
                        onClick={() => setSelected(item.id)}
                        aria-pressed={selected === item.id}
                      >
                        <span className={`piece-swatch tone-${item.color}`}>
                          <Armchair size={22} strokeWidth={1.3} />
                        </span>
                        <span className="piece-copy">
                          <strong>{item.name}</strong>
                          <span className="measure">
                            {formatLength(item.width, project.units)} ×{" "}
                            {formatLength(item.depth, project.units)}
                          </span>
                          <span className="piece-state">
                            {item.owned ? "Already owned" : "To buy"}
                            {item.mustHave ? ", must-have" : ""}
                            {!placed
                              ? knownAside?.some((a) => a.itemId === item.id)
                                ? ", set aside"
                                : ", not placed yet"
                              : ""}
                          </span>
                        </span>
                      </button>
                      {!readOnly && (
                        <IconAction
                          label={`Edit ${item.name}`}
                          disabled={busy}
                          onClick={() => {
                            setEditing(item);
                            setPanel("item");
                          }}
                        >
                          <Pencil size={15} />
                        </IconAction>
                      )}
                    </div>
                  );
                })
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No furniture yet</EmptyTitle>
                    <EmptyDescription>
                      Add a measured piece, then find where it fits.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
            {!readOnly && (
              <Button
                className="add-piece"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(undefined);
                  setPanel("item");
                }}
              >
                <Plus />
                Add a piece
              </Button>
            )}
            <div className="tray-brief">
              <h3> The room’s brief</h3>
              <p>
                {project.brief.purpose[0].toUpperCase() +
                  project.brief.purpose.slice(1)}
                {project.brief.deskByWindow ? ", desk by the window" : ""}
              </p>
              <span className="measure">
                {formatLength(project.brief.walkway, project.units)} main
                walkway
              </span>
              {!readOnly && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPanel("settings")}
                >
                  Change the brief
                </Button>
              )}
            </div>
            {!readOnly && (
              <Button
                className="generate-button"
                disabled={busy || !ready}
                onClick={generate}
              >
                <Layers3 />
                {busy
                  ? "Finding room for everything…"
                  : "Suggest three layouts"}
              </Button>
            )}
            <p className="solver-note">
              {busy
                ? "Checking collisions, use zones and connected paths."
                : "Real sizes. Door swings. Room to move."}
            </p>
            <div className="tray-footer">
              <Button variant="ghost" onClick={() => setPanel("shop")}>
                <ShoppingBag />
                Shopping list
              </Button>
              <a href="/privacy">Privacy</a>
            </div>
          </div>
        </aside>
        <section className="room-work">
          <div className="room-heading">
            <div>
              <h1>{project.room.name}</h1>
              <p className="room-dimensions">
                <span>
                  {formatLength(roomBounds.width, project.units)} ×{" "}
                  {formatLength(roomBounds.depth, project.units)}
                </span>
                <span>
                  {(Math.abs(area(project.room.polygon)) / 10000).toFixed(1)} m²
                  floor area
                </span>
              </p>
              <p className="mobile-save-status">{saveStatus}</p>
            </div>
            {!readOnly && (
              <div className="room-heading-actions">
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setPanel("room")}
                >
                  <Pencil size={16} />
                  Edit room
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => setPanel("new")}
                >
                  <Plus size={16} />
                  New room
                </Button>
              </div>
            )}
          </div>
          {!readOnly && (
            <div className="mobile-primary-actions">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setEditing(undefined);
                  setPanel("item");
                }}
              >
                <Plus />
                Add a piece
              </Button>
              <Button disabled={busy || !ready} onClick={generate}>
                <Layers3 />
                {busy ? "Finding layouts…" : "Suggest layouts"}
              </Button>
            </div>
          )}
          <div className="desk-stage">
            <div className="view-toolbar">
              <Tabs value={view} onValueChange={(v) => setView(v as SceneView)}>
                <TabsList aria-label="Room view">
                  <TabsTrigger value="miniature">
                    <Box />
                    Miniature
                  </TabsTrigger>
                  <TabsTrigger value="plan">
                    <Grid2X2 />
                    Plan
                  </TabsTrigger>
                  <TabsTrigger value="walkin">
                    <DoorOpen />
                    Walk in
                  </TabsTrigger>
                </TabsList>
                {(["miniature", "plan", "walkin"] as const).map((v) => (
                  <TabsContent className="sr-only" key={v} value={v}>
                    {v} room view
                  </TabsContent>
                ))}
              </Tabs>
              <IconAction
                label={
                  clearance ? "Hide use clearances" : "Show use clearances"
                }
                aria-pressed={clearance}
                onClick={() => setClearance(!clearance)}
              >
                <Maximize2 />
              </IconAction>
            </div>
            <div
              className="scene-canvas"
              style={
                view === "plan"
                  ? { visibility: "hidden", pointerEvents: "none" }
                  : undefined
              }
            >
              <RoomScene
                project={project}
                view={view}
                time={time}
                selected={selected}
                clearance={clearance}
                buildKey={buildKey}
                onSelect={setSelected}
                onMove={!readOnly && !busy ? move : undefined}
                onReady={onReady}
              />
            </div>
            {view === "plan" && (
              <div className="plan-sheet">
                <Plan
                  room={project.room}
                  items={project.items}
                  placements={project.placements}
                  units={project.units}
                  selected={selected}
                  clearance={clearance}
                  onSelect={setSelected}
                  onMove={!readOnly && !busy ? move : undefined}
                />
              </div>
            )}
            {view !== "plan" && (
              <div className="parts-ledger" aria-live="polite">
                <span>Parts assembled</span>
                <strong className="measure">
                  {reduced ? totalParts : partCount}
                  <span> / {totalParts}</span>
                </strong>
                <div>
                  <span>Walls</span>
                  <span>{project.room.polygon.length}</span>
                </div>
                <div>
                  <span>Openings</span>
                  <span>{project.room.openings.length}</span>
                </div>
                <div>
                  <span>Furniture</span>
                  <span>{project.placements.length}</span>
                </div>
                <p>
                  {sceneReady
                    ? reduced || partCount >= totalParts
                      ? "The room geometry is ready."
                      : "Settling into place…"
                    : "Preparing the model…"}
                </p>
              </div>
            )}
            <div className="scene-caption">
              <Move size={15} />
              <span>
                {view === "plan"
                  ? "Drag a piece. Arrow keys move; R rotates."
                  : view === "walkin"
                    ? "Drag to look around. Scroll to move closer."
                    : selected
                      ? "Drag the selected piece to move it."
                      : "Drag to orbit. Scroll to come closer."}
              </span>
            </div>
            {selectedItem && selectedPlacement && !readOnly && (
              <div className="selected-tools">
                <span>{selectedItem.name}</span>
                <IconAction
                  label="Move selected piece"
                  disabled={busy}
                  onClick={() => setPanel("position")}
                >
                  <Move size={16} />
                </IconAction>
                <IconAction
                  label="Rotate selected piece left 15 degrees"
                  disabled={busy}
                  onClick={() =>
                    move(
                      {
                        ...selectedPlacement,
                        rotation: (selectedPlacement.rotation + 345) % 360,
                      },
                      true,
                    )
                  }
                >
                  <RotateCcw />
                </IconAction>
                <span className="measure">{selectedPlacement.rotation}°</span>
                <IconAction
                  label="Rotate selected piece right 15 degrees"
                  disabled={busy}
                  onClick={() =>
                    move(
                      {
                        ...selectedPlacement,
                        rotation: (selectedPlacement.rotation + 15) % 360,
                      },
                      true,
                    )
                  }
                >
                  <RotateCw />
                </IconAction>
                <IconAction
                  label="Deselect piece"
                  onClick={() => setSelected(null)}
                >
                  <X />
                </IconAction>
              </div>
            )}
          </div>
          <div className="scene-footer">
            <div
              className={`fit-status ${warnings.length || knownAside?.length ? "fit-warning" : fitPending ? "fit-pending" : ""}`}
              role="status"
            >
              {warnings.length || knownAside?.length ? (
                <TriangleAlert size={18} />
              ) : fitPending ? (
                <Layers3 size={18} />
              ) : (
                <CheckCircle2 size={18} />
              )}
              <span>
                {warnings.length
                  ? warnings[0].message
                  : knownAside?.length
                    ? `${knownAside.length} piece${knownAside.length === 1 ? "" : "s"} set aside. Review the fit notes below.`
                    : missing.length
                      ? `${missing.length} piece${missing.length === 1 ? "" : "s"} not placed yet. Suggest a layout to check fit.`
                      : !project.items.length
                        ? "Add your measured pieces to check fit."
                        : "Every placed piece has room to be used."}
              </span>
              {warnings.length > 1 && (
                <details>
                  <summary>{warnings.length - 1} more</summary>
                  {warnings.slice(1).map((w, i) => (
                    <p key={i}>{w.message}</p>
                  ))}
                </details>
              )}
            </div>
            <div className="sun-control">
              <Sun size={18} />
              <span id="sun-label">{clockTime(time)}</span>
              <Slider
                min={7}
                max={19}
                step={0.5}
                value={[time]}
                onValueChange={(v) => setTime(Array.isArray(v) ? v[0] : v)}
                getAriaLabel={() => "Time of day"}
                getAriaValueText={(_, value) => clockTime(value)}
              />
            </div>
          </div>
          {!readOnly && (
            <section className="layout-section">
              <div className="layout-heading">
                <h2>Same pieces, another possibility</h2>
                <span className="muted">
                  {layouts.length
                    ? `${layouts.length} distinct arrangements`
                    : "Set the brief, then suggest layouts"}
                </span>
              </div>
              {layouts.length ? (
                <div className="layout-options">
                  {layouts.map((layout, i) => (
                    <button
                      type="button"
                      key={layout.name}
                      className={`layout-option ${activeLayout === i ? "layout-active" : ""}`}
                      disabled={busy}
                      aria-pressed={activeLayout === i}
                      onClick={() => {
                        update({ ...project, placements: layout.placements });
                        setActiveLayout(i);
                        setSelected(null);
                        setBuildKey((k) => k + 1);
                      }}
                    >
                      <div className="layout-thumbnail">
                        <Plan
                          room={project.room}
                          items={project.items}
                          placements={layout.placements}
                          units={project.units}
                          compact
                        />
                      </div>
                      <div>
                        <strong>{layout.name}</strong>
                        <p>{layout.reason}</p>
                        <span className="measure">
                          {layout.placements.length} placed
                          {layout.aside.length
                            ? `, ${layout.aside.length} set aside`
                            : ""}
                        </span>
                      </div>
                      {activeLayout === i && (
                        <Check className="layout-check" size={16} />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="layout-empty">
                  <Layers3 size={24} />
                  <p>
                    Three options should feel different, not just nudged. The
                    solver checks real clearances before offering an
                    arrangement.
                  </p>
                </div>
              )}
              {activeLayout >= 0 && layouts[activeLayout]?.aside.length > 0 && (
                <div className="aside-items">
                  {layouts[activeLayout].aside.map((a) => {
                    const item = project.items.find((i) => i.id === a.itemId)!;
                    return (
                      <p key={a.itemId}>
                        <TriangleAlert size={16} />
                        <strong>{item.name}</strong> {a.reason}{" "}
                        {a.maxWidth > 0
                          ? `Try at most ${formatLength(a.maxWidth, project.units)} × ${formatLength(a.maxDepth, project.units)} at the same proportions.`
                          : "No usable footprint fits; remove it or change the room brief."}
                      </p>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <span>A miniature made from your measurements.</span>
        {!readOnly && (
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            <ArrowDownToLine size={15} />
            Import room file
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Import room JSON file"
          onChange={(e) => importFile(e.target.files?.[0])}
        />
        <a href="/about">About the fit check</a>
      </footer>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        {(panel === "new" || panel === "room") && (
          <RoomEditor
            key={panel}
            initial={project.room}
            units={project.units}
            creating={panel === "new"}
            onConfirm={confirmRoom}
          />
        )}
        {panel === "item" && (
          <ItemEditor
            key={editing?.id ?? "new-piece"}
            initial={editing}
            units={project.units}
            onSave={saveItem}
          />
        )}
        {panel === "share" && <SharePanel project={project} />}
        {panel === "position" && selectedPlacement && (
          <PositionEditor
            placement={selectedPlacement}
            units={project.units}
            onSave={(p) => {
              move(p, true);
              setPanel(null);
            }}
          />
        )}
        {panel === "settings" && (
          <SettingsPanel
            project={project}
            cloudStorage={cloudStorage}
            onSave={(p) => {
              update(p);
              setPanel(null);
            }}
            onClear={() => {
              try {
                projectStore.clear();
                setPanel(null);
                setSelected(null);
              } catch {
                toast.error(
                  "Browser storage could not be cleared.                   Check your browser’s site permissions.",
                );
              }
            }}
          />
        )}
        {panel === "shop" && <ShoppingPanel project={project} />}
      </Dialog>
    </div>
  );
}
function SettingsPanel({
  project,
  cloudStorage,
  onSave,
  onClear,
}: {
  project: Project;
  cloudStorage: boolean;
  onSave: (p: Project) => void;
  onClear: () => void;
}) {
  const [brief, setBrief] = useState(project.brief),
    [units, setUnits] = useState(project.units);
  const [walkway, setWalkway] = useState(
    String(inputLength(brief.walkway, units)),
  );
  const [error, setError] = useState(""),
    [clearing, setClearing] = useState(false);
  return (
    <DialogContent className="settings-dialog">
      <DialogHeader>
        <DialogTitle>Make room for your day</DialogTitle>
        <DialogDescription>
          The brief changes what the solver favors. Clearances remain hard
          constraints.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = briefSchema.safeParse({
            ...brief,
            walkway: fromInput(Number(walkway), units),
          });
          if (!parsed.success) {
            setError(
              "Choose a main walkway between 60 and 150 cm. These are planning defaults, not an accessibility certification.",
            );
            document.getElementById("walkway")?.focus();
            return;
          }
          onSave({ ...project, brief: parsed.data, units });
        }}
      >
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Choice
          id="room-purpose"
          label="Room purpose"
          value={brief.purpose}
          options={["studio", "bedroom", "living", "dorm"].map((v) => ({
            value: v,
            label: v[0].toUpperCase() + v.slice(1),
          }))}
          onChange={(v) =>
            setBrief({ ...brief, purpose: v as typeof brief.purpose })
          }
        />
        <div className="settings-checks">
          {(
            [
              { key: "deskByWindow", label: "Put the desk near natural light" },
              {
                key: "bedAwayFromDoor",
                label: "Keep the bed away from the entry",
              },
            ] as const
          ).map((c) => (
            <Field key={c.key} orientation="horizontal">
              <Checkbox
                id={c.key}
                checked={brief[c.key]}
                onCheckedChange={(v) => setBrief({ ...brief, [c.key]: v })}
              />
              <FieldLabel htmlFor={c.key}>{c.label}</FieldLabel>
            </Field>
          ))}
        </div>
        <div className="form-pair">
          <Choice
            id="units"
            label="Measurements"
            value={units}
            options={[
              { value: "imperial", label: "Feet and inches" },
              { value: "metric", label: "Centimeters" },
            ]}
            onChange={(v) => {
              const next = v as typeof units;
              setWalkway(
                String(inputLength(fromInput(Number(walkway), units), next)),
              );
              setUnits(next);
            }}
          />
          <TextField
            id="walkway"
            label={`Main walkway (${units === "metric" ? "cm" : "inches"})`}
            type="number"
            min={inputLength(60, units)}
            max={inputLength(150, units)}
            step=".1"
            required
            value={walkway}
            onChange={(e) => setWalkway(e.target.value)}
          />
        </div>
        <p className="muted">
          Default: 36 inches for main routes; category use zones follow
          published furniture-spacing guidelines. Adjust for your needs, then
          check with a tape measure.
        </p>
        <div className="local-storage-note">
          <strong>
            {cloudStorage
              ? "Cloud storage is configured"
              : "Saved here, not in the cloud"}
          </strong>
          <p>
            This room lives in this browser. Export a room file to keep a
            backup. Shared links carry independent snapshots.
          </p>
        </div>
        <div className="dialog-actions">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setClearing(true)}
          >
            Clear browser room
          </Button>
          <Button type="submit">Save the brief</Button>
        </div>
        {clearing && (
          <div className="clear-confirm">
            <p>
              Remove this browser’s saved room and return to the sample? Export
              it first if you need a backup.
            </p>
            <Button variant="destructive" type="button" onClick={onClear}>
              Remove saved room
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setClearing(false)}
            >
              Keep room
            </Button>
          </div>
        )}
      </form>
    </DialogContent>
  );
}
function ShoppingPanel({ project }: { project: Project }) {
  const items = project.items.filter((i) => !i.owned),
    currencies = [
      ...new Set(items.filter((i) => i.price !== null).map((i) => i.currency)),
    ];
  return (
    <DialogContent className="shopping-dialog">
      <DialogHeader>
        <DialogTitle>What still needs to come home</DialogTitle>
        <DialogDescription>
          Only pieces marked “to buy.” Prices are imported or entered, never
          estimated.
        </DialogDescription>
      </DialogHeader>
      {items.length ? (
        <>
          <div className="shopping-items">
            {items.map((item) => (
              <div className="shopping-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.source}</span>
                </div>
                <span className="measure">
                  {item.price === null
                    ? "Price not provided"
                    : money(item.price, item.currency)}
                </span>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    View store <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
          {currencies.map((currency) => (
            <div className="shopping-total" key={currency}>
              <span>Known prices ({currency})</span>
              <strong className="measure">
                {money(
                  items
                    .filter((i) => i.currency === currency)
                    .reduce((s, i) => s + (i.price ?? 0), 0),
                  currency,
                )}
              </strong>
            </div>
          ))}
          <p className="muted">
            Missing prices, tax, delivery and stock are not included. Check each
            store before buying.
          </p>
        </>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Everything here is already yours</EmptyTitle>
            <EmptyDescription>
              Mark a piece as “to buy” to collect its price and store link here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </DialogContent>
  );
}
