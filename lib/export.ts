import { MATERIAL as M } from "./materials";
import type { Project } from "./schema";

export function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportRoom(project: Project) {
  download(
    new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }),
    "maquette-room.json",
  );
}
export function planSvg(svg: SVGSVGElement) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", "1400");
  copy.setAttribute("height", "1400");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    svg{background:${M.paper};font-family:monospace;color:${M.ink}}
    .grid-line{fill:none;stroke:${M.oat};stroke-width:.3}
    .plan-floor{stroke:${M.ink};stroke-width:4}
    .furniture-outline{fill:${M.linen};stroke:${M.ink};stroke-width:1.5}
    .tone-sage{fill:${M.sage}}.tone-walnut{fill:${M.oak}}.tone-oat{fill:${M.oat}}.tone-charcoal{fill:${M.charcoal}}
    .furniture-detail{fill:none;stroke:${M.mutedInk};stroke-width:1}
    .plan-label{font-size:12px;fill:${M.ink};text-anchor:middle}
    .dimension{fill:${M.ink};stroke:${M.mutedInk};stroke-width:.7}
    .dimension text{stroke:none;font-size:14px;text-anchor:middle;paint-order:stroke;stroke:${M.paper};stroke-width:5}
    .title-block,.north-arrow{fill:${M.ink};stroke:none;font-size:12px}.title-block line,.north-arrow path{stroke:${M.ink};stroke-width:1;fill:none}
    .plan-title{font-family:serif;font-size:22px}
    .opening-erase{stroke:${M.paper};stroke-width:6}
    .window-line,.door-line,.door-arc{stroke:${M.ink};stroke-width:1;fill:none}
    .opening-label{font-size:10px;fill:${M.mutedInk};text-anchor:middle}
    .fixed-feature{fill:${M.wallEdge};stroke:${M.ink};stroke-width:1}
    .plan-use-zone{stroke:${M.amber};stroke-width:.5}
    .hatch-line{stroke:${M.amber};stroke-width:1;opacity:.3}
  `;
  copy.prepend(style);
  return new XMLSerializer().serializeToString(copy);
}
export async function exportPlan(svg: SVGSVGElement, png: boolean) {
  const text = planSvg(svg),
    blob = new Blob([text], { type: "image/svg+xml" });
  if (!png) {
    download(blob, "maquette-plan.svg");
    return;
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1800;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "This browser cannot export a PNG. Download the SVG instead.",
      );
    context.fillStyle = M.paper;
    context.fillRect(0, 0, 1800, 1800);
    context.drawImage(img, 0, 0, 1800, 1800);
    const output = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("The plan image could not be created.")),
        "image/png",
      ),
    );
    download(output, "maquette-plan.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
