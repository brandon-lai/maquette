"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Line, OrbitControls, RoundedBox } from "@react-three/drei";
import { DepthOfField, EffectComposer } from "@react-three/postprocessing";
import {
  CanvasTexture,
  DoubleSide,
  Plane,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Group,
} from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { bounds, distance, wallFrame } from "@/lib/geometry";
import { browserCapabilities } from "@/lib/browser-capabilities";
import { MATERIAL as M } from "@/lib/materials";
import {
  formatLength,
  type Item,
  type Placement,
  type Project,
  type Room,
  type Units,
} from "@/lib/schema";
import { snapPlacement } from "@/lib/solver";
import { Plan } from "./plan";

export type SceneView = "miniature" | "plan" | "walkin";
type Props = {
  project: Project;
  view: SceneView;
  time: number;
  selected: string | null;
  clearance: boolean;
  buildKey: number;
  onSelect: (id: string) => void;
  onMove?: (p: Placement, commit: boolean) => void;
  onReady: () => void;
};
function texture(kind: "wood" | "fabric", color: string, line: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d")!;
  c.fillStyle = color;
  c.fillRect(0, 0, 512, 512);
  let seed = 17;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  c.strokeStyle = line;
  if (kind === "wood") {
    for (let i = 0; i < 500; i++) {
      const x = random() * 512;
      c.globalAlpha = random() * 0.3;
      c.lineWidth = random() * 1.5;
      c.beginPath();
      c.moveTo(x, 0);
      c.bezierCurveTo(
        x + random() * 15,
        180,
        x - random() * 12,
        350,
        x + random() * 7,
        512,
      );
      c.stroke();
    }
    c.globalAlpha = 0.5;
    for (let x = 0; x <= 512; x += 128) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 512);
      c.stroke();
    }
  } else {
    c.globalAlpha = 0.2;
    c.lineWidth = 1;
    for (let i = 0; i < 512; i += 3) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 512);
      c.moveTo(0, i);
      c.lineTo(512, i);
      c.stroke();
    }
  }
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  result.wrapS = result.wrapT = RepeatWrapping;
  result.repeat.set(2, 2);
  result.anisotropy = 4;
  return result;
}
function draftingTexture(room: Room, units: Units) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 1400;
  const c = canvas.getContext("2d")!,
    b = bounds(room.polygon);
  c.fillStyle = M.paper;
  c.fillRect(0, 0, 1600, 1400);
  let seed = 37;
  for (let i = 0; i < 22000; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % 1600;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    c.globalAlpha = 0.03;
    c.fillStyle = M.ink;
    c.fillRect(x, seed % 1400, 1, 1);
  }
  c.globalAlpha = 1;
  const sx = 1150 / b.width,
    sy = 1000 / b.depth;
  c.translate(210, 125);
  c.strokeStyle = M.mutedInk;
  c.fillStyle = M.mutedInk;
  c.lineWidth = 2;
  c.font = '24px "DM Mono", monospace';
  c.textAlign = "center";
  c.beginPath();
  room.polygon.forEach((p, i) =>
    i
      ? c.lineTo((p.x - b.minX) * sx, (p.y - b.minY) * sy)
      : c.moveTo((p.x - b.minX) * sx, (p.y - b.minY) * sy),
  );
  c.closePath();
  c.stroke();
  room.polygon.forEach((a, i) => {
    const next = room.polygon[(i + 1) % room.polygon.length],
      { normal } = wallFrame(room, i);
    const x = ((a.x + next.x) / 2 - b.minX) * sx - normal.x * 50;
    const y = ((a.y + next.y) / 2 - b.minY) * sy - normal.y * 50;
    c.save();
    c.translate(x, y);
    if (Math.abs(normal.x) > 0.5) c.rotate(-Math.PI / 2);
    c.fillText(formatLength(distance(a, next), units), 0, 0);
    c.restore();
  });
  c.textAlign = "left";
  c.font = '42px "Bodoni Moda", serif';
  c.fillStyle = M.ink;
  c.fillText(room.name, -120, 1190, 900);
  c.font = '21px "DM Mono", monospace';
  c.fillStyle = M.mutedInk;
  c.fillText(room.address || "Measured room plan", -120, 1230, 900);
  c.fillText(room.date, -120, 1260);
  c.textAlign = "right";
  c.fillText("1:50", 1190, 1190);
  c.fillText("N ↑", 1190, -45);
  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  result.anisotropy = 8;
  return result;
}
function Box({
  size,
  at = [0, 0, 0],
  color,
  map,
  radius = 0.01,
}: {
  size: [number, number, number];
  at?: [number, number, number];
  color: string;
  map?: CanvasTexture;
  radius?: number;
}) {
  return (
    <RoundedBox
      args={size}
      radius={Math.min(radius, ...size.map((v) => v / 3))}
      smoothness={2}
      position={at}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial color={color} map={map} roughness={0.86} />
    </RoundedBox>
  );
}
function Furniture({
  item,
  p,
  selected,
  clearance,
  index,
  reduced,
  onSelect,
  onMove,
  onDrag,
  center,
  buildKey,
}: {
  item: Item;
  p: Placement;
  selected: boolean;
  clearance: boolean;
  index: number;
  reduced: boolean;
  onSelect: (id: string) => void;
  onMove?: Props["onMove"];
  onDrag: (drag: boolean) => void;
  center: [number, number];
  buildKey: number;
}) {
  const ref = useRef<Group>(null),
    start = useRef(0);
  const drag = useRef<{ p: Placement; point: Vector3 } | null>(null);
  const { width, depth, height } = item,
    w = width / 100,
    d = depth / 100,
    h = height / 100;
  const color = M[item.color],
    wood = useMemo(() => texture("wood", M.oakLight, M.oakGrain), []);
  const fabric = useMemo(
    () =>
      texture(
        "fabric",
        color,
        item.color === "sage" ? M.sageThread : M.linenThread,
      ),
    [color, item.color],
  );
  const plane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  useEffect(() => {
    start.current = 0;
  }, [buildKey]);
  useEffect(() => () => wood.dispose(), [wood]);
  useEffect(() => () => fabric.dispose(), [fabric]);
  useFrame((state) => {
    if (!ref.current) return;
    if (!start.current) start.current = state.clock.elapsedTime;
    const t = reduced
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (state.clock.elapsedTime - start.current - 0.1 * index) / 0.6,
          ),
        );
    const eased = 1 - (1 - t) ** 3;
    ref.current.position.y = (1 - eased) * 0.35;
    ref.current.scale.setScalar(Math.max(0.001, eased));
  });
  const point = (e: ThreeEvent<PointerEvent>) =>
    e.ray.intersectPlane(plane, new Vector3());
  const move = (e: ThreeEvent<PointerEvent>, commit: boolean) => {
    const current = point(e),
      origin = drag.current;
    if (!current || !origin || !onMove) return;
    onMove(
      {
        ...origin.p,
        x: origin.p.x + (current.x - origin.point.x) * 100,
        y: origin.p.y + (current.z - origin.point.z) * 100,
      },
      commit,
    );
  };
  return (
    <group
      position={[p.x / 100 - center[0], 0, p.y / 100 - center[1]]}
      rotation={[0, (-p.rotation * Math.PI) / 180, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(item.id);
        const current = point(e);
        if (!onMove || !current) return;
        drag.current = { p, point: current };
        onDrag(true);
        if (
          e.target &&
          "setPointerCapture" in e.target &&
          typeof e.target.setPointerCapture === "function"
        )
          e.target.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (drag.current) {
          e.stopPropagation();
          move(e, false);
        }
      }}
      onPointerUp={(e) => {
        if (drag.current) {
          move(e, true);
          drag.current = null;
          onDrag(false);
          if (
            e.target &&
            "releasePointerCapture" in e.target &&
            typeof e.target.releasePointerCapture === "function"
          )
            e.target.releasePointerCapture(e.pointerId);
        }
      }}
      onPointerCancel={() => {
        if (drag.current) onMove?.(drag.current.p, true);
        drag.current = null;
        onDrag(false);
      }}
    >
      <group ref={ref}>
        {item.category === "bed" ? (
          <>
            <Box
              size={[w, h * 0.17, d]}
              at={[0, h * 0.19, 0]}
              color={M.walnut}
            />
            <Box
              size={[w * 0.97, h * 0.27, d * 0.95]}
              at={[0, h * 0.42, 0]}
              color={color}
              map={fabric}
              radius={0.06}
            />
            <Box
              size={[w, h, 0.07]}
              at={[0, h / 2, -d / 2 + 0.035]}
              color={M.oak}
              map={wood}
            />
            <Box
              size={[w * 0.91, 0.04, d * 0.64]}
              at={[0, h * 0.565, d * 0.13]}
              color={color}
              map={fabric}
              radius={0.025}
            />
            {[-1, 1].map((side) => (
              <Box
                key={side}
                size={[w * 0.4, 0.1, 0.38]}
                at={[side * w * 0.235, h * 0.6, -d * 0.28]}
                color={M.linen}
                map={fabric}
                radius={0.06}
              />
            ))}
            <Box
              size={[w * 0.93, 0.025, d * 0.22]}
              at={[0, h * 0.6, d * 0.32]}
              color={M.oat}
              map={fabric}
              radius={0.02}
            />
          </>
        ) : item.category === "sofa" || item.category === "chair" ? (
          <>
            <Box
              size={[w * 0.93, h * 0.23, d * 0.86]}
              at={[0, h * 0.28, 0]}
              color={color}
              map={fabric}
              radius={0.05}
            />
            <Box
              size={[w, h * 0.7, d * 0.17]}
              at={[0, h * 0.65, -d * 0.415]}
              color={color}
              map={fabric}
              radius={0.05}
            />
            {[-1, 1].map((s) => (
              <Box
                key={s}
                size={[w * 0.1, h * 0.55, d]}
                at={[s * w * 0.45, h * 0.45, 0]}
                color={color}
                map={fabric}
                radius={0.04}
              />
            ))}
            {(item.category === "sofa" ? [-1, 1] : [0]).map((s) => (
              <Box
                key={s}
                size={[
                  w * (item.category === "sofa" ? 0.39 : 0.78),
                  h * 0.18,
                  d * 0.75,
                ]}
                at={[s * w * 0.2, h * 0.46, d * 0.035]}
                color={color}
                map={fabric}
                radius={0.045}
              />
            ))}
            {[-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <Box
                  key={`${x}${z}`}
                  size={[0.045, h * 0.15, 0.045]}
                  at={[x * w * 0.4, h * 0.075, z * d * 0.36]}
                  color={M.walnut}
                />
              )),
            )}
          </>
        ) : item.category === "desk" || item.category === "table" ? (
          <>
            <Box
              size={[w, 0.045, d]}
              at={[0, h - 0.0225, 0]}
              color={item.color === "walnut" ? M.walnut : M.oakLight}
              map={wood}
              radius={0.015}
            />
            {[-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <Box
                  key={`${x}${z}`}
                  size={[0.05, h - 0.045, 0.05]}
                  at={[
                    x * (w / 2 - 0.055),
                    (h - 0.045) / 2,
                    z * (d / 2 - 0.055),
                  ]}
                  color={M.walnut}
                />
              )),
            )}
            {item.category === "desk" && (
              <Box
                size={[w * 0.36, h * 0.15, d * 0.85]}
                at={[w * 0.29, h * 0.86, 0]}
                color={M.oak}
                map={wood}
              />
            )}
          </>
        ) : item.category === "tv" ? (
          <>
            <Box
              size={[w, h * 0.4, d]}
              at={[0, h * 0.2, 0]}
              color={M.oak}
              map={wood}
            />
            <Box
              size={[w * 0.82, h * 0.56, 0.06]}
              at={[0, h * 0.72, 0]}
              color={M.charcoal}
            />
          </>
        ) : (
          <>
            <Box
              size={[w, h, d]}
              at={[0, h / 2, 0]}
              color={item.color === "walnut" ? M.walnut : M.oak}
              map={wood}
            />
            {Array.from(
              { length: item.category === "dresser" ? 3 : 1 },
              (_, n) => (
                <Box
                  key={n}
                  size={[w * 0.85, 0.02, 0.02]}
                  at={[0, h * (0.25 + n * 0.25), d / 2 + 0.001]}
                  color={M.wallEdge}
                />
              ),
            )}
          </>
        )}
      </group>
      {(selected || clearance) && (
        <Line
          points={[
            [-w / 2, 0.01, -d / 2],
            [w / 2, 0.01, -d / 2],
            [w / 2, 0.01, d / 2],
            [-w / 2, 0.01, d / 2],
            [-w / 2, 0.01, -d / 2],
          ]}
          color={M.amber}
          lineWidth={selected ? 2 : 1}
        />
      )}
      {clearance && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.008, item.clearance / 200]}
        >
          <planeGeometry
            args={[
              w +
                (item.category === "bed" || item.category === "table"
                  ? item.clearance / 50
                  : 0),
              d + item.clearance / 100,
            ]}
          />
          <meshBasicMaterial
            color={M.amberLight}
            transparent
            opacity={0.2}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
function CameraRig({
  view,
  roomWidth,
  roomDepth,
  reduced,
  controls,
}: {
  view: SceneView;
  roomWidth: number;
  roomDepth: number;
  reduced: boolean;
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, invalidate, size } = useThree();
  const destination = useMemo(
    () =>
      view === "walkin"
        ? new Vector3(roomWidth * 0.24, 1.55, roomDepth * 0.27)
        : new Vector3(
            roomWidth * 1.12,
            Math.max(roomWidth, roomDepth) * 1.15,
            roomDepth * 1.35,
          ).multiplyScalar(
            1 + Math.max(0, 1.45 - size.width / size.height) * 0.9,
          ),
    [view, roomWidth, roomDepth, size.width, size.height],
  );
  const target = useMemo(
    () =>
      view === "walkin"
        ? new Vector3(-roomWidth * 0.18, 1.3, -roomDepth * 0.25)
        : new Vector3(0, 0.25, 0),
    [view, roomWidth, roomDepth],
  );
  const moving = useRef(true);
  useEffect(() => {
    moving.current = true;
    invalidate();
  }, [destination, target, invalidate]);
  useFrame((_state, delta) => {
    if (!moving.current) return;
    const alpha = reduced ? 1 : 1 - Math.exp(-delta * 5);
    camera.position.lerp(destination, alpha);
    if (controls.current) {
      controls.current.target.lerp(target, alpha);
      controls.current.update();
    } else camera.lookAt(target);
    if (camera.position.distanceTo(destination) < 0.015) moving.current = false;
    else _state.invalidate();
  });
  return null;
}
function World({
  project,
  view,
  time,
  selected,
  clearance,
  buildKey,
  onSelect,
  onMove,
  onReady,
  reduced,
}: Props & { reduced: boolean }) {
  const { room, items, placements, units } = project,
    b = bounds(room.polygon);
  const w = b.width / 100,
    d = b.depth / 100,
    height = room.height / 100;
  const center: [number, number] = [
    (b.maxX + b.minX) / 200,
    (b.maxY + b.minY) / 200,
  ];
  const controls = useRef<OrbitControlsImpl>(null),
    wallsRef = useRef<Group>(null),
    buildStart = useRef(0);
  const [dragging, setDragging] = useState(false);
  const wood = useMemo(() => texture("wood", M.oak, M.oakGrain), []);
  const deskWood = useMemo(() => texture("wood", M.desk, M.walnut), []);
  const paper = useMemo(() => draftingTexture(room, units), [room, units]);
  const shape = useMemo(
    () =>
      new Shape(room.polygon.map((p) => new Vector2(p.x / 100, -p.y / 100))),
    [room.polygon],
  );
  const { gl } = useThree();
  useEffect(() => {
    onReady();
  }, [onReady]);
  useEffect(
    () => () => {
      wood.dispose();
      deskWood.dispose();
    },
    [wood, deskWood],
  );
  useEffect(() => () => paper.dispose(), [paper]);
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      window.dispatchEvent(new Event("maquette-webgl-lost"));
    };
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  useEffect(() => {
    buildStart.current = 0;
  }, [buildKey]);
  useFrame((state) => {
    if (!buildStart.current) buildStart.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - buildStart.current;
    if (wallsRef.current)
      wallsRef.current.scale.y = reduced
        ? 1
        : Math.max(0.001, 1 - (1 - Math.min(1, elapsed / 0.8)) ** 3);
    if (!reduced && elapsed < 1.3) state.invalidate();
  });
  const windowOpening = room.openings.find((o) => o.type === "window");
  const normal = windowOpening
    ? wallFrame(room, windowOpening.wall).normal
    : { x: 0, y: 1 };
  const north = (room.north * Math.PI) / 180,
    phase = ((time - 12) * Math.PI) / 12;
  const sunX = -normal.x * 8 + Math.sin(phase + north) * 5;
  const sunZ = -normal.y * 8 + Math.cos(phase + north) * 3;
  return (
    <>
      <color attach="background" args={[M.desk]} />
      <hemisphereLight args={[M.sky, M.walnut, 1.25]} />
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[sunX, Math.max(2, 7 * Math.cos(phase)), sunZ]}
        intensity={time > 17 ? 2.2 : 2.8}
        color={M.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.13, 0]}
        receiveShadow
      >
        <planeGeometry args={[35, 35]} />
        <meshStandardMaterial map={deskWood} roughness={0.65} />
      </mesh>
      {view !== "walkin" && (
        <>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.08, 0.32]}
            receiveShadow
          >
            <planeGeometry args={[w * 1.39, d * 1.4]} />
            <meshStandardMaterial map={paper} roughness={1} />
          </mesh>
          <group
            position={[-w * 0.68, -0.07, d * 0.47]}
            rotation={[0, 0.4, Math.PI / 2]}
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.023, 0.023, 1.65, 6]} />
              <meshStandardMaterial color={M.amberLight} roughness={0.55} />
            </mesh>
            <mesh position={[0, -0.9, 0]}>
              <coneGeometry args={[0.024, 0.15, 6]} />
              <meshStandardMaterial color={M.oakLight} />
            </mesh>
            <mesh position={[0, -0.98, 0]}>
              <coneGeometry args={[0.009, 0.04, 6]} />
              <meshStandardMaterial color={M.ink} />
            </mesh>
          </group>
          <group position={[w * 0.76, -0.065, -d * 0.42]}>
            <mesh castShadow receiveShadow>
              <cylinderGeometry args={[0.21, 0.17, 0.3, 32, 1, true]} />
              <meshStandardMaterial
                color={M.ceramic}
                roughness={0.32}
                side={DoubleSide}
              />
            </mesh>
            <mesh position={[0, 0.09, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.195, 32]} />
              <meshStandardMaterial color={M.coffee} roughness={0.2} />
            </mesh>
            <mesh position={[0.23, 0, 0]}>
              <torusGeometry args={[0.1, 0.025, 8, 24]} />
              <meshStandardMaterial color={M.ceramic} roughness={0.32} />
            </mesh>
            <mesh position={[0, -0.15, 0]}>
              <cylinderGeometry args={[0.31, 0.29, 0.015, 32]} />
              <meshStandardMaterial color={M.ceramic} roughness={0.4} />
            </mesh>
          </group>
        </>
      )}
      <group position={[-center[0], 0, -center[1]]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial
            color={M.oakLight}
            map={wood}
            roughness={0.65}
            side={DoubleSide}
          />
        </mesh>
        <group ref={wallsRef}>
          {room.polygon.map((_, wall) => {
            const { a, tangent, length } = wallFrame(room, wall),
              angle = -Math.atan2(tangent.y, tangent.x);
            const cutaway =
              view !== "walkin" &&
              (wallFrame(room, wall).normal.x < -0.1 ||
                wallFrame(room, wall).normal.y < -0.1);
            const wallHeight = cutaway ? 0.12 : height;
            const openings = room.openings
              .filter((o) => o.wall === wall)
              .sort((x, y) => x.offset - y.offset);
            const segments: {
              start: number;
              end: number;
              bottom: number;
              top: number;
            }[] = [];
            let cursor = 0;
            for (const o of openings) {
              if (o.offset > cursor)
                segments.push({
                  start: cursor,
                  end: o.offset,
                  bottom: 0,
                  top: wallHeight,
                });
              if (o.type === "window")
                segments.push({
                  start: o.offset,
                  end: o.offset + o.width,
                  bottom: 0,
                  top: Math.min(o.sill / 100, wallHeight),
                });
              if (!cutaway)
                segments.push({
                  start: o.offset,
                  end: o.offset + o.width,
                  bottom:
                    o.type === "door"
                      ? 2.1
                      : Math.min(height - 0.2, o.sill / 100 + 1.3),
                  top: height,
                });
              cursor = o.offset + o.width;
            }
            if (cursor < length)
              segments.push({
                start: cursor,
                end: length,
                bottom: 0,
                top: wallHeight,
              });
            return (
              <group
                key={wall}
                position={[a.x / 100, 0, a.y / 100]}
                rotation={[0, angle, 0]}
              >
                {segments
                  .filter((s) => s.top > s.bottom)
                  .map((s, i) => (
                    <Box
                      key={i}
                      size={[(s.end - s.start) / 100, s.top - s.bottom, 0.09]}
                      at={[(s.start + s.end) / 200, (s.top + s.bottom) / 2, 0]}
                      color={M.wall}
                      radius={0.002}
                    />
                  ))}
                {!cutaway &&
                  openings
                    .filter((o) => o.type === "window")
                    .map((o) => {
                      const ow = o.width / 100,
                        x = (o.offset + o.width / 2) / 100,
                        sill = o.sill / 100;
                      return (
                        <group key={o.id}>
                          <Box
                            size={[ow + 0.09, 0.065, 0.19]}
                            at={[x, sill, 0]}
                            color={M.wallEdge}
                          />
                          {[-1, 1].map((side) => (
                            <Box
                              key={side}
                              size={[0.06, 1.3, 0.09]}
                              at={[x + (side * ow) / 2, sill + 0.65, 0]}
                              color={M.wallEdge}
                            />
                          ))}
                          <Box
                            size={[ow, 0.05, 0.08]}
                            at={[x, sill + 1.3, 0]}
                            color={M.wallEdge}
                          />
                          <Box
                            size={[0.035, 1.3, 0.07]}
                            at={[x, sill + 0.65, 0]}
                            color={M.wallEdge}
                          />
                          <mesh position={[x, sill + 0.65, -0.015]}>
                            <planeGeometry args={[ow, 1.3]} />
                            <meshPhysicalMaterial
                              color={M.glass}
                              roughness={0.05}
                              metalness={0}
                              transparent
                              opacity={0.18}
                              side={DoubleSide}
                            />
                          </mesh>
                          {[-1, 1].map((side) => (
                            <Box
                              key={`curtain-${side}`}
                              size={[0.19, 1.7, 0.07]}
                              at={[
                                x + side * (ow / 2 + 0.08),
                                sill + 0.42,
                                0.08,
                              ]}
                              color={M.linen}
                              radius={0.03}
                            />
                          ))}
                        </group>
                      );
                    })}
              </group>
            );
          })}
        </group>
        {room.features
          .filter((f) => f.type !== "outlet")
          .map((f) => (
            <Box
              key={f.id}
              size={[
                f.width / 100,
                f.type === "radiator" ? 0.55 : height * 0.9,
                f.depth / 100,
              ]}
              at={[
                f.x / 100,
                f.type === "radiator" ? 0.275 : height * 0.45,
                f.y / 100,
              ]}
              color={M.wallEdge}
            />
          ))}
        {view === "walkin" && (
          <mesh position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <shapeGeometry args={[shape]} />
            <meshStandardMaterial color={M.wall} side={DoubleSide} />
          </mesh>
        )}
        <group position={[center[0], 0, center[1]]}>
          {placements.map((p, i) => {
            const item = items.find((v) => v.id === p.itemId);
            return (
              item && (
                <Furniture
                  key={item.id}
                  item={item}
                  p={p}
                  selected={selected === item.id}
                  clearance={clearance}
                  index={i}
                  reduced={reduced}
                  onSelect={onSelect}
                  onMove={
                    onMove
                      ? (next, commit) =>
                          onMove(snapPlacement(room, item, next), commit)
                      : undefined
                  }
                  onDrag={(value) => {
                    setDragging(value);
                    if (controls.current) controls.current.enabled = !value;
                  }}
                  center={center}
                  buildKey={buildKey}
                />
              )
            );
          })}
        </group>
        <mesh
          position={[b.width / 200, height - 0.25, b.depth / 200]}
          castShadow
        >
          <coneGeometry args={[0.21, 0.18, 24, 1, true]} />
          <meshStandardMaterial
            color={M.ceramic}
            roughness={0.6}
            side={DoubleSide}
          />
        </mesh>
        <pointLight
          position={[b.width / 200, height - 0.4, b.depth / 200]}
          color={M.sun}
          intensity={time > 16 ? 6 : 1}
          distance={5}
          decay={2}
        />
      </group>
      <OrbitControls
        ref={controls}
        enabled={!dragging}
        makeDefault
        enableDamping={!reduced}
        dampingFactor={0.12}
        minDistance={view === "walkin" ? 0.35 : 5}
        maxDistance={view === "walkin" ? 5 : 22}
        maxPolarAngle={view === "walkin" ? Math.PI * 0.85 : Math.PI / 2.15}
        enablePan={view !== "walkin"}
        rotateSpeed={0.65}
        target={[0, 0.25, 0]}
      />
      <CameraRig
        view={view}
        roomWidth={w}
        roomDepth={d}
        reduced={reduced}
        controls={controls}
      />
      {view === "miniature" && (
        <EffectComposer multisampling={0}>
          <DepthOfField
            target={[0, 0.4, 0]}
            focalLength={0.16}
            bokehScale={0.75}
            height={360}
          />
        </EffectComposer>
      )}
    </>
  );
}
class SceneBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error(
      "3D rendering failed; dimensioned plan remains available:",
      error,
    );
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function RoomScene(props: Props) {
  const { onReady } = props;
  const { supported: support, reduced } = useSyncExternalStore(
    browserCapabilities.subscribe,
    browserCapabilities.getSnapshot,
    browserCapabilities.getServerSnapshot,
  );
  useEffect(() => {
    if (support === false) onReady();
  }, [support, onReady]);
  const fallback = (
    <div className="scene-fallback">
      <p role="status">
        3D is unavailable on this device. Your measured plan still works.
      </p>
      <Plan
        room={props.project.room}
        items={props.project.items}
        placements={props.project.placements}
        units={props.project.units}
        selected={props.selected}
        clearance={props.clearance}
        onSelect={props.onSelect}
        onMove={props.onMove}
      />
    </div>
  );
  if (support === false) return fallback;
  if (support === null)
    return (
      <div className="scene-loading" role="status">
        Laying out the drafting sheet…
      </div>
    );
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        shadows
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [9, 8, 11], fov: 37, near: 0.05, far: 100 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
        role="img"
        aria-label={`Rotatable three-dimensional miniature of ${props.project.room.name}`}
        onPointerMissed={() => props.onSelect("")}
      >
        <Suspense fallback={null}>
          <World {...props} reduced={reduced} />
        </Suspense>
      </Canvas>
    </SceneBoundary>
  );
}
