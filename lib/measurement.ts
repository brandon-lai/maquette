export function printedMeasurements(text: string) {
  const matches =
    text.match(
      /\d+(?:\.\d+)?\s*(?:ft|feet|′|')(?:\s*\d+(?:\.\d+)?\s*(?:in|inches|″|"))?|\d+(?:\.\d+)?\s*(?:centimeters?|centimetres?|cm|meters?|metres?|m)\b/gi,
    ) ?? [];
  return matches
    .map(measurement)
    .filter((v): v is number => v !== null && v >= 100);
}

export function measurement(value: unknown): number | null {
  if (typeof value === "number") return null;
  if (value && typeof value === "object" && "value" in value) {
    const v = value as Record<string, unknown>;
    return measurement(`${v.value} ${v.unitText ?? v.unitCode ?? ""}`);
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/,/g, ".").trim().toLowerCase();
  const feet = normalized.match(
    /(\d+(?:\.\d+)?)\s*(?:ft|feet|′|')\s*(?:(\d+(?:\.\d+)?)\s*(?:in|inches|″|"))?/,
  );
  if (feet) return Number(feet[1]) * 30.48 + Number(feet[2] ?? 0) * 2.54;
  const m = normalized.match(
    /(\d+(?:\.\d+)?)\s*(centimet(?:er|re)s?|millimet(?:er|re)s?|inches?|inch|meters?|metres?|cmt|cm|mmt|mm|inh|in|mtr|m|″|")/,
  );
  if (!m) return null;
  const factors: Record<string, number> = {
    cm: 1,
    cmt: 1,
    mm: 0.1,
    mmt: 0.1,
    in: 2.54,
    inh: 2.54,
    inch: 2.54,
    inches: 2.54,
    "″": 2.54,
    '"': 2.54,
    m: 100,
    mtr: 100,
  };
  const unit = m[2];
  const factor =
    factors[unit] ??
    (unit.startsWith("centi") ? 1 : unit.startsWith("milli") ? 0.1 : 100);
  const number = Number(m[1]) * factor;
  return number > 0 && number <= 1000 ? Number(number.toFixed(2)) : null;
}
