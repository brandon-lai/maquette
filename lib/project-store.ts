"use client";

import { sampleProject } from "./seed";
import { decodeProject, STORAGE_KEY, validateProject } from "./storage";
import type { Project } from "./schema";

type Snapshot = {
  project: Project;
  ready: boolean;
  readOnly: boolean;
  error: string;
  invalid: boolean;
};
const initial: Snapshot = {
  project: sampleProject,
  ready: false,
  readOnly: false,
  error: "",
  invalid: false,
};
let current = initial;
let loadedKey = "";
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}
export const projectStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => current,
  getServerSnapshot: () => initial,
  load() {
    const key = window.location.pathname + window.location.hash;
    if (current.ready && key === loadedKey) return;
    loadedKey = key;
    const readOnly = window.location.pathname === "/share";
    try {
      const text = readOnly
        ? window.location.hash.slice(1)
        : localStorage.getItem(STORAGE_KEY);
      const project = readOnly
        ? decodeProject(text ?? "")
        : text
          ? validateProject(JSON.parse(text))
          : sampleProject;
      current = { project, ready: true, readOnly, error: "", invalid: false };
    } catch (error) {
      console.warn("Room storage could not be loaded:", error);
      current = {
        ...initial,
        ready: true,
        readOnly,
        invalid: readOnly,
        error: readOnly
          ? "This shared room is incomplete or invalid. Ask the sender for a fresh link."
          : "Your stored room could not be read. The sample is shown; export or clear browser storage before starting again.",
      };
    }
    emit();
  },
  update(project: Project, persist = true) {
    if (current.readOnly) return;
    let error = current.error;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
        error = "";
      } catch (e) {
        console.warn("Browser room save failed:", e);
        error =
          "Your browser could not save this room. Export it before closing this page.";
      }
    }
    current = { ...current, project, error };
    emit();
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
    current = { ...initial, ready: true };
    emit();
  },
};
