import { ImageResponse } from "next/og";
import { MATERIAL as M } from "@/lib/materials";
export const alt = "Maquette: a measured room plan on an architect's desk";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: M.walnut,
        padding: 48,
        display: "flex",
      }}
    >
      <div
        style={{
          background: M.paper,
          width: "100%",
          display: "flex",
          padding: 48,
          alignItems: "center",
          gap: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", width: 490 }}>
          <div style={{ color: M.ink, fontSize: 88, fontFamily: "serif" }}>
            maquette
          </div>
          <div style={{ color: M.mutedInk, fontSize: 30, marginTop: 24 }}>
            Measure first. Move once.
          </div>
          <div style={{ color: M.ink, fontSize: 24, marginTop: 52 }}>
            Your room. Your pieces. Room to move.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 350,
              height: 320,
              border: `5px solid ${M.ink}`,
              padding: 18,
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 95,
                height: 170,
                border: `2px solid ${M.walnut}`,
                background: M.linen,
                marginTop: 42,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 100,
                height: 46,
                border: `2px solid ${M.walnut}`,
                background: M.oak,
                marginLeft: 34,
              }}
            />
            <div
              style={{
                display: "flex",
                width: 136,
                height: 65,
                position: "absolute",
                bottom: 16,
                right: 16,
                background: M.sage,
                border: `2px solid ${M.walnut}`,
              }}
            />
          </div>
          <div style={{ color: M.mutedInk, fontSize: 20 }}>540 cm × 460 cm</div>
        </div>
      </div>
    </div>,
    size,
  );
}
