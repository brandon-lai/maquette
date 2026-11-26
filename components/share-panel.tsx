"use client";

import { useRef, useState } from "react";
import { Copy, Download, FileImage, Link2 } from "lucide-react";
import { Button } from "./ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { TextField } from "./form-controls";
import { Plan } from "./plan";
import { encodeProject } from "@/lib/storage";
import { exportPlan, exportRoom } from "@/lib/export";
import type { Project } from "@/lib/schema";

export function SharePanel({ project }: { project: Project }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [link] = useState(() => {
    try {
      return `${window.location.origin}/share#${encodeProject(project)}`;
    } catch {
      return "";
    }
  });
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setError("");
    } catch {
      setError(
        "Clipboard access was denied. Select and copy the link manually.",
      );
      document.getElementById("share-link")?.focus();
    }
  }
  async function save(png: boolean) {
    setExporting(true);
    setError("");
    try {
      const svg = ref.current?.querySelector("svg");
      if (!svg)
        throw new Error("The plan preview has not loaded yet. Try again.");
      await exportPlan(svg, png);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The plan could not be exported.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <DialogContent className="share-dialog">
      <DialogHeader>
        <DialogTitle>A room worth passing around</DialogTitle>
        <DialogDescription>
          The link opens this exact arrangement, view-only. Later edits stay
          private.
        </DialogDescription>
      </DialogHeader>
      <div className="share-preview" ref={ref}>
        <Plan
          room={project.room}
          items={project.items}
          placements={project.placements}
          units={project.units}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {link ? (
        <>
          <div className="inline-field">
            <TextField
              id="share-link"
              label="View-only room link"
              value={link}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <Button variant="outline" onClick={copy}>
              <Copy />
              {copied ? "Copied link" : "Copy link"}
            </Button>
          </div>
          <p className="muted">
            Anyone with this link can see the room and its title block. The
            snapshot is in the link, not a cloud database.
          </p>
        </>
      ) : (
        <p className="form-error">
          This room is too large or invalid for a share link. Check the
          measurements or export the room file.
        </p>
      )}
      <div className="export-actions">
        <Button
          variant="outline"
          disabled={exporting}
          onClick={() => save(true)}
        >
          <FileImage />
          {exporting ? "Creating plan…" : "Save plan PNG"}
        </Button>
        <Button
          variant="outline"
          disabled={exporting}
          onClick={() => save(false)}
        >
          <Download />
          Save plan SVG
        </Button>
        <Button variant="ghost" onClick={() => exportRoom(project)}>
          <Link2 />
          Export room file
        </Button>
      </div>
      <p className="muted">
        Use printed dimension labels, not screen or printer scale. No CAD
        export.
      </p>
    </DialogContent>
  );
}
