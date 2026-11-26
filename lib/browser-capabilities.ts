"use client";

type Capabilities = { supported: boolean | null; reduced: boolean };
const server: Capabilities = { supported: null, reduced: false };
let current: Capabilities | null = null;
export const browserCapabilities = {
  getServerSnapshot: () => server,
  getSnapshot() {
    if (!current) {
      const context = document.createElement("canvas").getContext("webgl2");
      current = {
        supported: Boolean(context),
        reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
      context?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    return current;
  },
  subscribe(listener: () => void) {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      current = {
        ...browserCapabilities.getSnapshot(),
        reduced: media.matches,
      };
      listener();
    };
    const lost = () => {
      current = { ...browserCapabilities.getSnapshot(), supported: false };
      listener();
    };
    media.addEventListener("change", changed);
    window.addEventListener("maquette-webgl-lost", lost);
    return () => {
      media.removeEventListener("change", changed);
      window.removeEventListener("maquette-webgl-lost", lost);
    };
  },
};
