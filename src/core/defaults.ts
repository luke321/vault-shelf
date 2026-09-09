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
  skin: "graphite" | "paper";
  reading: { noteId: string; shelfId: string; bookId: string; at: number }[];
  dateFields: string[];
  peopleProperty: string;
  /** decisions/0003 -- off by default; a file's mtime is almost never the note's date. */
  useFileStamp: boolean;
}

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
    skin: "graphite",
    reading: [],
    dateFields: ["date", "created"],
    peopleProperty: "people",
    useFileStamp: false,
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
    skin: data.skin === "paper" ? "paper" : "graphite",
    reading: Array.isArray(data.reading) ? data.reading.filter(isMark) : [],
    dateFields: Array.isArray(data.dateFields) && data.dateFields.length
      ? data.dateFields.filter((f): f is string => typeof f === "string")
      : base.dateFields,
    peopleProperty: typeof data.peopleProperty === "string" && data.peopleProperty
      ? data.peopleProperty : base.peopleProperty,
    useFileStamp: data.useFileStamp === true,
  };
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
