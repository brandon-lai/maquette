"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { TextField } from "./form-controls";
import {
  fromInput,
  inputLength,
  placementSchema,
  type Placement,
  type Units,
} from "@/lib/schema";

export function PositionEditor({
  placement,
  units,
  onSave,
}: {
  placement: Placement;
  units: Units;
  onSave: (placement: Placement) => void;
}) {
  const [x, setX] = useState(String(inputLength(placement.x, units)));
  const [y, setY] = useState(String(inputLength(placement.y, units)));
  const [error, setError] = useState("");
  const unit = units === "metric" ? "cm" : "inches";
  return (
    <DialogContent className="position-dialog">
      <DialogHeader>
        <DialogTitle>Move this piece</DialogTitle>
        <DialogDescription>
          Set its exact center from the plan&apos;s origin, without dragging.
          Fit warnings update when you apply.
        </DialogDescription>
      </DialogHeader>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = placementSchema.safeParse({
            ...placement,
            x: x.trim() ? fromInput(Number(x), units) : Number.NaN,
            y: y.trim() ? fromInput(Number(y), units) : Number.NaN,
          });
          if (!parsed.success) {
            setError(
              `Enter valid coordinates between ${inputLength(-1000, units)} and ${inputLength(3000, units)} ${unit}.`,
            );
            document
              .getElementById(
                `position-${String(parsed.error.issues[0].path[0])}`,
              )
              ?.focus();
            return;
          }
          onSave(parsed.data);
        }}
      >
        <div className="form-pair">
          <TextField
            id="position-x"
            label={`Center X (${unit})`}
            type="number"
            step="any"
            value={x}
            onChange={(e) => setX(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "position-error" : undefined}
          />
          <TextField
            id="position-y"
            label={`Center Y (${unit})`}
            type="number"
            step="any"
            value={y}
            onChange={(e) => setY(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "position-error" : undefined}
          />
        </div>
        {error && (
          <p id="position-error" className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <Button type="submit">Apply position</Button>
        </div>
      </form>
    </DialogContent>
  );
}
