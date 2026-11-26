"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Link2, Plus, Ruler } from "lucide-react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Field, FieldLabel } from "./ui/field";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { TextField, Choice } from "./form-controls";
import {
  categories,
  DEFAULT_CLEARANCE,
  fromInput,
  inputLength,
  itemSchema,
  type Category,
  type Item,
  type Units,
} from "@/lib/schema";
import { makeItem } from "@/lib/seed";
import type { ProductDraft } from "@/lib/product";

const presets: {
  category: Category;
  name: string;
  size: [number, number, number];
}[] = [
  { category: "bed", name: "Double bed", size: [140, 200, 95] },
  { category: "desk", name: "Writing desk", size: [120, 60, 75] },
  { category: "sofa", name: "Two-seat sofa", size: [160, 85, 82] },
  { category: "chair", name: "Lounge chair", size: [65, 70, 85] },
  { category: "dresser", name: "Drawer chest", size: [80, 45, 90] },
  { category: "nightstand", name: "Bedside table", size: [40, 40, 50] },
  { category: "table", name: "Dining table", size: [120, 80, 75] },
  { category: "tv", name: "TV console", size: [120, 35, 90] },
];
export function ItemEditor({
  initial,
  units,
  onSave,
}: {
  initial?: Item;
  units: Units;
  onSave: (item: Item) => void;
}) {
  const [item, setItem] = useState(() =>
    initial ? structuredClone(initial) : makeItem("desk", "", 120, 60, 75),
  );
  const [dimensions, setDimensions] = useState(
    () =>
      Object.fromEntries(
        (["width", "depth", "height", "clearance"] as const).map((key) => [
          key,
          String(inputLength((initial ?? item)[key], units)),
        ]),
      ) as Record<"width" | "depth" | "height" | "clearance", string>,
  );
  const [price, setPrice] = useState(
    initial?.price !== null && initial?.price !== undefined
      ? String(initial.price / 100)
      : "",
  );
  const [link, setLink] = useState(initial?.url ?? "");
  const [error, setError] = useState("");
  const [review, setReview] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const unit = units === "metric" ? "cm" : "inches";
  function preset(p: (typeof presets)[number]) {
    setItem((i) => ({
      ...i,
      category: p.category,
      name: p.name,
      clearance: DEFAULT_CLEARANCE[p.category],
    }));
    setDimensions({
      width: String(inputLength(p.size[0], units)),
      depth: String(inputLength(p.size[1], units)),
      height: String(inputLength(p.size[2], units)),
      clearance: String(inputLength(DEFAULT_CLEARANCE[p.category], units)),
    });
  }
  async function importLink() {
    if (!link.trim()) {
      setError("Paste a public product link first.");
      document.getElementById("product-link")?.focus();
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link.trim() }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "The product page could not be imported.",
        );
      const data = result as ProductDraft;
      setFailedImage(null);
      setItem((i) => ({
        ...i,
        name: data.name,
        source: data.source,
        url: data.url,
        image: data.image,
        currency: data.currency,
        owned: false,
      }));
      setDimensions((d) => ({
        ...d,
        width:
          data.width === null ? "" : String(inputLength(data.width, units)),
        depth:
          data.depth === null ? "" : String(inputLength(data.depth, units)),
        height:
          data.height === null ? "" : String(inputLength(data.height, units)),
      }));
      setPrice(data.price === null ? "" : String(data.price / 100));
      setReview([
        ...data.review,
        ...(data.color
          ? [`Store color: ${data.color}. Choose the closest material below.`]
          : []),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Import failed. Enter the item dimensions manually.",
      );
    } finally {
      setBusy(false);
    }
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const data = {
      ...item,
      ...Object.fromEntries(
        Object.entries(dimensions).map(([key, v]) => [
          key,
          fromInput(Number(v), units),
        ]),
      ),
      price: price.trim() === "" ? null : Math.round(Number(price) * 100),
      url: link.trim() || null,
    };
    const parsed = itemSchema.safeParse(data);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(`${String(issue.path[0] ?? "Item")}: ${issue.message}`);
      document.getElementById(`item-${String(issue.path[0])}`)?.focus();
      return;
    }
    onSave(parsed.data);
  }
  return (
    <DialogContent className="item-dialog">
      <DialogHeader>
        <DialogTitle>
          {initial ? "Measure this piece" : "Bring your furniture"}
        </DialogTitle>
        <DialogDescription>
          Any store, or something you already own. Dimensions are what matter.
        </DialogDescription>
      </DialogHeader>
      <div className="product-import">
        <div className="inline-field">
          <TextField
            id="product-link"
            label="Product link (optional)"
            type="url"
            value={link}
            placeholder="https://store.com/product"
            onChange={(e) => setLink(e.target.value)}
          />
          <Button variant="outline" disabled={busy} onClick={importLink}>
            <Link2 />
            {busy ? "Reading page…" : "Read product"}
          </Button>
        </div>
        <p className="muted">
          Public metadata only. Stores that block access still work with manual
          measurements.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {review.length > 0 && (
        <div className="review-note" role="status">
          {review.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      )}
      {item.image && (
        <div className="product-preview">
          {failedImage === item.image ? (
            <p role="status">
              The store image could not load. Check the original listing.
            </p>
          ) : (
            <Image
              unoptimized
              src={item.image}
              width={96}
              height={96}
              alt={item.name || "Imported product"}
              onError={() => setFailedImage(item.image)}
            />
          )}
          <div>
            <strong>{item.source}</strong>
            <a href={item.url ?? link} target="_blank" rel="noreferrer">
              Check original listing <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}
      <form onSubmit={save}>
        {!initial && (
          <div className="preset-pieces">
            <span className="muted">Measured starting shapes</span>
            <div className="preset-buttons">
              {presets.map((p) => (
                <Button
                  type="button"
                  variant="ghost"
                  key={p.category}
                  onClick={() => preset(p)}
                >
                  {p.category[0].toUpperCase() + p.category.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="form-pair">
          <TextField
            id="item-name"
            label="Piece name"
            required
            maxLength={80}
            value={item.name}
            onChange={(e) => setItem({ ...item, name: e.target.value })}
          />
          <Choice
            id="item-category"
            label="Shape category"
            value={item.category}
            options={categories.map((c) => ({
              value: c,
              label: c[0].toUpperCase() + c.slice(1),
            }))}
            onChange={(v) => {
              setItem({ ...item, category: v as Category });
              setDimensions({
                ...dimensions,
                clearance: String(
                  inputLength(DEFAULT_CLEARANCE[v as Category], units),
                ),
              });
            }}
          />
        </div>
        <div className="dimension-fields">
          {(["width", "depth", "height"] as const).map((key) => (
            <TextField
              key={key}
              id={`item-${key}`}
              label={`${key[0].toUpperCase() + key.slice(1)} (${unit})`}
              required
              type="number"
              min={inputLength(5, units)}
              max={inputLength(1000, units)}
              step=".1"
              value={dimensions[key]}
              onChange={(e) =>
                setDimensions({ ...dimensions, [key]: e.target.value })
              }
            />
          ))}
        </div>
        <div className="form-pair">
          <TextField
            id="item-clearance"
            label={`Use clearance (${unit})`}
            type="number"
            required
            min="0"
            max={inputLength(200, units)}
            step=".1"
            value={dimensions.clearance}
            onChange={(e) =>
              setDimensions({ ...dimensions, clearance: e.target.value })
            }
            hint={
              item.category === "bed"
                ? "Both sides and foot. Headboard may meet a wall."
                : item.category === "table"
                  ? "All sides, for seating and chair movement."
                  : "In front, for use, chair pull-out or drawers."
            }
          />
          <Choice
            id="item-color"
            label="Model material"
            value={item.color}
            options={["linen", "sage", "walnut", "oat", "charcoal"].map(
              (v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }),
            )}
            onChange={(v) => setItem({ ...item, color: v as Item["color"] })}
          />
        </div>
        <div className="form-pair">
          <TextField
            id="item-price"
            label="Price (optional)"
            type="number"
            min="0"
            step=".01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <TextField
            id="item-currency"
            label="Currency"
            maxLength={3}
            pattern="[A-Z]{3}"
            value={item.currency}
            onChange={(e) =>
              setItem({ ...item, currency: e.target.value.toUpperCase() })
            }
          />
        </div>
        <div className="check-row">
          <Field orientation="horizontal">
            <Checkbox
              id="item-owned"
              checked={item.owned}
              onCheckedChange={(v) => setItem({ ...item, owned: v })}
            />
            <FieldLabel htmlFor="item-owned">I already own it</FieldLabel>
          </Field>
          <Field orientation="horizontal">
            <Checkbox
              id="item-required"
              checked={item.mustHave}
              onCheckedChange={(v) => setItem({ ...item, mustHave: v })}
            />
            <FieldLabel htmlFor="item-required">Must-have piece</FieldLabel>
          </Field>
        </div>
        <div className="dialog-actions">
          <p className="muted model-note">
            <Ruler size={16} /> Approximate shape, exact size
          </p>
          <Button type="submit" disabled={busy}>
            <Plus />
            {initial ? "Save measurements" : "Add this piece"}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
