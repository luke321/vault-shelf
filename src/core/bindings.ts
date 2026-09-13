import type { Shelf } from "./types";

/** design/0029 */
export const SPINE_STYLES = [
  { id: "original", name: "Original", trim: 0, description: "The original leather, raised bands and gilt frame" },
  { id: "minimal", name: "Minimal", trim: 1, description: "Plain leather, a quiet title and straight-cut ribbon" },
  { id: "gilt", name: "Gilt", trim: 2, description: "Polished calfskin, double gold tooling and forked silk" },
  { id: "pebbled", name: "Morocco", trim: 4, description: "Pebbled leather, copper stitching and pointed silk" },
  { id: "vellum", name: "Vellum", trim: 6, description: "Dyed parchment, dark ink and a narrow linen ribbon" },
  { id: "weathered", name: "Aged", trim: 8, description: "Creased leather, faded tooling and a frayed ribbon" },
] as const;

export type SpineStyle = typeof SPINE_STYLES[number]["id"];
export type SpineSeries = "one" | "book" | "year" | "decade";

export function isSpineStyle(value: unknown): value is SpineStyle {
  return SPINE_STYLES.some((s) => s.id === value);
}

/** design/0029 */
export function bindingHash(key: string): number {
  let seed = 2166136261;
  for (let i = 0; i < key.length; i++) seed = Math.imul(seed ^ key.charCodeAt(i), 16777619) >>> 0;
  return seed;
}

export function bindingUnit(shelf: Shelf, key: string): string {
  const year = /^(\d{4})/.exec(key);
  if (year && shelf.spineSeries === "decade") return shelf.id + "/decade/" + Math.floor(Number(year[1]) / 10);
  if (year && shelf.spineSeries === "year") return shelf.id + "/year/" + year[1];
  return shelf.id + (shelf.spineSeries === "one" || !shelf.spineSeries ? "" : "/" + key);
}

export function automaticSpine(shelf: Shelf, key: string): SpineStyle {
  if (!shelf.spineSeries || shelf.spineSeries === "one") return shelf.spineStyle || "original";
  return SPINE_STYLES[bindingHash(bindingUnit(shelf, key)) % SPINE_STYLES.length].id;
}

/** design/0029 */
export function bookSpinesOf(raw: unknown): Record<string, SpineStyle> {
  const out: Record<string, SpineStyle> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    if (isSpineStyle(value)) out[key] = value;
  }
  return out;
}
