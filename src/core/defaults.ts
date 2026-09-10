import type { Shelf } from "./types";

/* ---- the six default shelves ---------------------------------------------
 * design/0002
 *
 * The same note is meant to appear on several of these at once. That overlap is the product,
 * not a duplication bug: each shelf is another useful address into one vault.
 */
export function defaultShelves(): Shelf[] {
  return [
    {
      id: "encyclopedia", name: "Encyclopedia", source: { kind: "all" },
      classifier: "initial", direction: "alphabetical", hidden: false, position: 0,
      plaques: false,
    },
    {
      id: "years", name: "Years", source: { kind: "all" },
      classifier: "year", direction: "chronological", hidden: false, position: 1,
      plaques: false,
    },
    {
      id: "months", name: "Months", source: { kind: "all" },
      classifier: "month", direction: "chronological", hidden: false, position: 2,
      plaques: true,
    },
    {
      id: "weeks", name: "Weeks", source: { kind: "all" },
      classifier: "week", direction: "chronological", hidden: false, position: 3,
      plaques: true,
    },
    {
      id: "people", name: "People", source: { kind: "all" },
      classifier: "person", direction: "alphabetical", hidden: false, position: 4,
      plaques: false,
    },
    {
      id: "tags", name: "Tags", source: { kind: "all" },
      classifier: "tag", direction: "alphabetical", hidden: false, position: 5,
      plaques: false, includeSubtags: true,
    },
  ];
}

/* ---- recipes -------------------------------------------------------------
 * design/0002
 */

export interface Recipe {
  key: string;
  name: string;
  blurb: string;
  shelf: Omit<Shelf, "id" | "position">;
}

export function recipes(): Recipe[] {
  return [
    {
      key: "journal", name: "Monthly journal",
      blurb: "Every note with a date, one notebook per calendar month, years on plaques.",
      shelf: {
        name: "Journal", source: { kind: "all" }, classifier: "month",
        direction: "chronological", hidden: false, plaques: true,
      },
    },
    {
      key: "people", name: "A book for each person",
      blurb: "One volume per person named in a note's people property.",
      shelf: {
        name: "People", source: { kind: "all" }, classifier: "person",
        direction: "alphabetical", hidden: false, plaques: false,
      },
    },
    {
      key: "ideas", name: "Anthology of ideas",
      blurb: "Notes tagged #idea, collected by their other tags.",
      shelf: {
        name: "Ideas", source: { kind: "tag", value: "idea" }, classifier: "tag",
        direction: "alphabetical", hidden: false, plaques: false, includeSubtags: true,
      },
    },
  ];
}

/* ---- migration -----------------------------------------------------------
 * decisions/0001
 */

export const SETTINGS_SCHEMA = 1;

export interface Persisted {
  schema: number;
  shelves: Shelf[];
  reading: { noteId: string; shelfId: string; bookId: string; at: number }[];
  /**
   * design/0008 -- how many times each book has been opened, keyed by its stable address.
   * This is the only state the library keeps ABOUT you rather than about your notes, and it
   * is what makes a shelf look handled instead of printed.
   */
  wear: Record<string, number>;
  dateFields: string[];
  peopleProperty: string;
  /** decisions/0003 -- off by default; a file's mtime is almost never the note's date. */
  useFileStamp: boolean;
  /**
   * design/0014 -- which LOOK the page paints in. "" is the default look, which follows the
   * host's theme; "leather" is the opt-in binding. It is a paint setting and nothing else:
   * no shelf, no book and no address depends on it.
   */
  look: Look;
}

/** design/0014 -- the looks that exist. A blob naming any other one falls back to "". */
export type Look = "" | "leather";

/**
 * A deep copy that keeps its type. The page edits drafts of shelves and hands settings back
 * to a host that may keep the object; a shared reference between the two is how an edit
 * cancelled in the builder still reaches the saved file.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function emptySettings(): Persisted {
  return {
    schema: SETTINGS_SCHEMA,
    shelves: defaultShelves(),
    reading: [],
    wear: {},
    dateFields: ["date", "created"],
    peopleProperty: "people",
    useFileStamp: false,
    look: "",
  };
}

/**
 * A settings blob from any earlier schema, or from a hand-edited file, comes back as
 * something the rest of the code can assume is well-formed. Anything unreadable falls back
 * to the defaults rather than throwing: a corrupt setting must never cost a person their
 * library, and a shelf definition is cheap to re-make.
 */
export function migrate(raw: unknown): Persisted {
  const base = emptySettings();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Partial<Persisted>;
  const shelves = Array.isArray(data.shelves) ? data.shelves.filter(isShelf) : base.shelves;
  return {
    schema: SETTINGS_SCHEMA,
    shelves: shelves.length ? shelves.map((s, i) => ({ ...s, position: i })) : base.shelves,
    reading: Array.isArray(data.reading) ? data.reading.filter(isMark) : [],
    wear: wearOf(data.wear),
    dateFields: Array.isArray(data.dateFields) && data.dateFields.length
      ? data.dateFields.filter((f): f is string => typeof f === "string")
      : base.dateFields,
    peopleProperty: typeof data.peopleProperty === "string" && data.peopleProperty
      ? data.peopleProperty : base.peopleProperty,
    useFileStamp: data.useFileStamp === true,
    look: data.look === "leather" ? "leather" : "",
  };
}

/** Only positive finite counts survive: a hand-edited file cannot make a spine infinitely worn. */
function wearOf(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      out[key] = Math.min(Math.round(value), 9999);
    }
  }
  return out;
}

/* ---- shelf wear ----------------------------------------------------------
 * design/0008
 */

/** Four steps and a floor, so a shelf reads as handled rather than as a bar chart. */
export function wearLevel(opens: number): 0 | 1 | 2 | 3 {
  if (opens >= 12) return 3;
  if (opens >= 5) return 2;
  if (opens >= 2) return 1;
  return 0;
}

function isShelf(value: unknown): value is Shelf {
  if (!value || typeof value !== "object") return false;
  const s = value as Partial<Shelf>;
  return typeof s.id === "string" && typeof s.name === "string" &&
         typeof s.classifier === "string" && !!s.source && typeof s.source === "object";
}

function isMark(value: unknown): value is Persisted["reading"][number] {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<Persisted["reading"][number]>;
  return typeof m.noteId === "string" && typeof m.bookId === "string";
}
