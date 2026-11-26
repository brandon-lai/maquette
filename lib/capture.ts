import type { Room } from "./schema";
import { roomTemplate } from "./seed";
import { measurement, printedMeasurements } from "./measurement";
import { MATERIAL } from "./materials";

export type CaptureResult = { room: Room; preview: string; note: string };
function clusters(values: number[]) {
  const groups: number[][] = [];
  for (const v of values) {
    if (groups.length && v - groups[groups.length - 1].at(-1)! <= 5)
      groups[groups.length - 1].push(v);
    else groups.push([v]);
  }
  return groups.map((g) => Math.round(g.reduce((s, x) => s + x, 0) / g.length));
}
export function detectBoundary(
  data: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const ink = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return data[i + 3] > 100 && data[i] + data[i + 1] + data[i + 2] < 420;
  };
  const rows: number[] = [],
    cols: number[] = [];
  for (let y = 0; y < height; y++) {
    let longest = 0,
      run = 0;
    for (let x = 0; x < width; x++) {
      run = ink(x, y) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    if (longest >= width * 0.22) rows.push(y);
  }
  for (let x = 0; x < width; x++) {
    let longest = 0,
      run = 0;
    for (let y = 0; y < height; y++) {
      run = ink(x, y) ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
    if (longest >= height * 0.22) cols.push(x);
  }
  const ys = clusters(rows),
    xs = clusters(cols);
  if (xs.length < 2 || ys.length < 2)
    throw new Error(
      "No clear room boundary was found. Use a higher-contrast plan, or draw the room from its measurements.",
    );
  const box = {
    left: xs[0],
    right: xs.at(-1)!,
    top: ys[0],
    bottom: ys.at(-1)!,
  };
  if (box.right - box.left < 80 || box.bottom - box.top < 80)
    throw new Error(
      "The detected room is too small in this image. Crop to one room and upload again.",
    );
  const openings: {
    wall: number;
    offset: number;
    width: number;
    type: "door" | "window";
  }[] = [];
  const edges = [
    {
      length: box.right - box.left,
      point: (n: number) => [box.left + n, box.top],
    },
    {
      length: box.bottom - box.top,
      point: (n: number) => [box.right, box.top + n],
    },
    {
      length: box.right - box.left,
      point: (n: number) => [box.right - n, box.bottom],
    },
    {
      length: box.bottom - box.top,
      point: (n: number) => [box.left, box.bottom - n],
    },
  ];
  edges.forEach((edge, wall) => {
    let start = -1;
    for (let n = 0; n <= edge.length; n++) {
      const [x, y] = edge.point(n);
      const exists = [-2, -1, 0, 1, 2].some((d) =>
        wall % 2
          ? ink(
              Math.max(0, Math.min(width - 1, x + d)),
              Math.min(height - 1, y),
            )
          : ink(
              Math.min(width - 1, x),
              Math.max(0, Math.min(height - 1, y + d)),
            ),
      );
      if (!exists && start < 0) start = n;
      if ((exists || n === edge.length) && start >= 0) {
        const gap = n - start;
        if (
          start > 5 &&
          n < edge.length - 5 &&
          gap > edge.length * 0.07 &&
          gap < edge.length * 0.35
        ) {
          const [mx, my] = edge.point(start + Math.floor(gap / 2));
          const parallel = [-10, -6, 6, 10].some((d) =>
            wall % 2
              ? ink(Math.max(0, Math.min(width - 1, mx + d)), my)
              : ink(mx, Math.max(0, Math.min(height - 1, my + d))),
          );
          openings.push({
            wall,
            offset: start / edge.length,
            width: gap / edge.length,
            type: parallel ? "window" : "door",
          });
        }
        start = -1;
      }
    }
  });
  return { ...box, openings: openings.slice(0, 8) };
}
export async function capturePlan(
  file: File,
  knownWidth: number,
): Promise<CaptureResult> {
  if (file.size > 12_000_000)
    throw new Error(
      "The plan must be smaller than 12 MB. Crop to one room or use a smaller PDF.",
    );
  if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PDF, PNG, or JPG floor plan.");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx)
    throw new Error(
      "This browser cannot read a floor-plan image. Draw the room instead.",
    );
  let printed: number[] = [];
  let ocrNote = "";
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    });
    const pdf = await task.promise;
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: 1000 / Math.max(base.width, base.height),
      });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const text = await page.getTextContent();
      printed = text.items
        .flatMap((item) => ("str" in item ? [measurement(item.str)] : []))
        .filter((v): v is number => v !== null && v >= 100);
    } finally {
      await task.destroy();
    }
  } else {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    ctx.fillStyle = MATERIAL.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
  }
  if (!printed.length) {
    const { createWorker, PSM } = await import("tesseract.js");
    try {
      const worker = await createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr",
        langPath: "/ocr",
        gzip: false,
      });
      try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        const result = await worker.recognize(canvas);
        printed = printedMeasurements(result.data.text);
        if (result.data.confidence < 65)
          ocrNote =
            " Printed text was uncertain; use your own known wall length if it differs.";
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.warn("Local floor-plan OCR failed:", error);
      ocrNote =
        " Printed text could not be read; the entered wall length sets scale.";
    }
  }
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const box = detectBoundary(pixels.data, canvas.width, canvas.height);
  const w = printed[0] ?? knownWidth;
  const d = printed[1] ?? (w * (box.bottom - box.top)) / (box.right - box.left);
  const room = roomTemplate("rectangle");
  room.name = file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "My room";
  room.polygon = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: d },
    { x: 0, y: d },
  ];
  room.openings = box.openings.map((o, i) => ({
    id: `detected-${i}`,
    wall: o.wall,
    type: o.type,
    offset: Math.round(o.offset * (o.wall % 2 ? d : w)),
    width: Math.max(30, Math.round(o.width * (o.wall % 2 ? d : w))),
    sill: o.type === "window" ? 100 : 0,
    hinge: "left",
  }));
  return {
    room,
    preview: canvas.toDataURL("image/png"),
    note:
      (printed.length
        ? "Printed dimensions and line gaps were found. Every wall and opening is a low-confidence proposal; check them against the original."
        : "Boundary and opening gaps are low-confidence proposals. The entered wall length sets scale; review all dimensions and openings.") +
      ocrNote,
  };
}
