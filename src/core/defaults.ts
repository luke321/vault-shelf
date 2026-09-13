import type { MadeBook, Note, Shelf, SourceKind } from "./types";
import { buildShelf, isMadeKey, seedPicks } from "./shelves";
import { bookSpinesOf, isSpineStyle } from "./bindings";
import type { SpineStyle } from "./bindings";

/* ---- the six default shelves ---------------------------------------------
 * design/0002
 *
 * The same note is meant to appear on several of these at once. That overlap is the product,
 * not a duplication bug: each shelf is another useful address into one vault.
 */
export function defaultShelves(): Shelf[] {
  return [
    {
      /* design/0019 -- FIRST, AND EMPTY. A shelf that holds whichever books a person drags
       * onto it from the others, in the order they were dropped; its `source` is a formality
       * the type asks for, since a pick shelf classifies nothing. */
      id: "favourites", name: "Favourites", source: { kind: "all" },
      classifier: "pick", direction: "manual", hidden: false, position: 0,
      plaques: false, picks: [],
    },
    {
      id: "encyclopedia", name: "Encyclopedia", source: { kind: "all" },
      classifier: "initial", direction: "alphabetical", hidden: false, position: 1,
      plaques: false,
    },
    {
      id: "years", name: "Years", source: { kind: "all" },
      classifier: "year", direction: "chronological", hidden: false, position: 2,
      plaques: true, spineSeries: "decade",
    },
    {
      id: "months", name: "Months", source: { kind: "all" },
      classifier: "month", direction: "chronological", hidden: false, position: 3,
      plaques: true, spineSeries: "year",
    },
    {
      id: "people", name: "People", source: { kind: "all" },
      classifier: "person", direction: "alphabetical", hidden: false, position: 4,
      plaques: true, spineSeries: "book",
    },
    {
      id: "tags", name: "Tags", source: { kind: "all" },
      classifier: "tag", direction: "alphabetical", hidden: false, position: 5,
      plaques: true, includeSubtags: true, spineSeries: "book",
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

export const SETTINGS_SCHEMA = 10;

export interface Persisted {
  schema: number;
  shelves: Shelf[];
  reading: { noteId: string; shelfId: string; bookId: string; at: number }[];
  /**
   * design/0008 -- how many times each book has been opened, keyed by its stable address.
   * Alongside lastOpened, this records reading activity rather than note metadata.
   */
  wear: Record<string, number>;
  /** design/0033 */
  lastOpened: Record<string, string>;
  dateFields: string[];
  /**
   * decisions/0003 -- the frontmatter properties that name people, tried in order and merged.
   * A list rather than one name because a vault does not use one: meeting notes carry
   * `attendees`, a 1-on-1 carries `person`, and something written by hand carries `people`.
   * Naming only the first of those is how the People shelf comes up empty in a vault that is
   * full of people.
   */
  peopleFields: string[];
  /**
   * decisions/0003 -- which notes ARE people, so that a link to one counts as naming them.
   * `type: people` or `#person`; empty turns it off. A vault that keeps a note per person and
   * links to it has declared who was there just as plainly as a property would have.
   */
  personNote: string;
  /**
   * decisions/0003 -- ON since schema 3: a note with no declared date takes the earliest stamp
   * the filesystem has for it rather than going to Undated. `dates.stampOf` is what makes that
   * defensible; turning it off is still how you find out how many notes have no date of their
   * own.
   */
  useFileStamp: boolean;
  /**
   * design/0015 -- WHICH END OF A BOOK YOU OPEN. Newest-first is what a feed does and what a
   * notebook never does: it reads as if the thing were written backwards. So a book runs
   * oldest first, and this is the one setting that says otherwise. It applies to books that
   * are ordered by DATE; an Encyclopedia volume stays alphabetical either way, because "the
   * oldest of the As" is not a thing anybody wants.
   */
  noteOrder: NoteOrder;
  /**
   * design/0016 -- which LOOK the page paints in. "" is the default look, which follows the
   * host's theme; "leather" is the opt-in binding. It is a paint setting and nothing else:
   * no shelf, no book and no address depends on it.
   */
  look: Look;
  /**
   * design/0005 -- THE TWELVE, chosen. Empty means the look's own twelve, read from the
   * cascade; twelve hex colours here override them in every look. It is a person's palette,
   * not a look's, so it survives switching looks.
   */
  palette: string[];
  /**
   * design/0008 -- A RIBBON PER BOOK COLOUR: twelve entries, one for each palette slot, each
   * a hex colour or "" for the complement of that slot's dye. Twelve, because a ribbon hangs
   * off a book and a book is dyed one of twelve -- one ribbon colour for the whole library
   * was the one colour guaranteed to disappear against some of them. Sparse on purpose,
   * unlike `palette`: each entry's default is derived from its own dye, so one chosen ribbon
   * does not have to freeze the other eleven.
   */
  ribbons: string[];
  /**
   * design/0005 -- a colour a person gave one book by hand: the address of the book to the
   * slot (0-11) it wears. Beats the shelf's rule and the folder's dye. Keyed by address, so
   * it survives a rebuild the way a reading place does (decisions/0002).
   */
  bookColors: Record<string, number>;
  /** design/0029 */
  bookSpines: Record<string, SpineStyle>;
}

/** design/0016 -- the looks that exist. A blob naming any other one falls back to "". */
export type Look = "" | "leather" | "cyber";

/**
 * design/0016 -- THE ONE LIST OF LOOKS, in the order the selector offers them. The page builds
 * its control from this, `migrate` validates against it, and a look that is not here cannot be
 * asked for -- which is the whole reason a page never ends up asking for a stylesheet nobody
 * shipped.
 */
export const LOOKS: { value: Look; name: string; shelved?: true }[] = [
  { value: "leather", name: "Leather" },
  { value: "", name: "Modern", shelved: true },
  /* design/0017 -- SHELVED, NOT REMOVED. The stylesheet ships and every check still paints
   * it, but the selector does not offer it and a saved file asking for it comes up in leather
   * until the redesign lands. */
  { value: "cyber", name: "Cyber", shelved: true },
];

/** A look that exists: a stylesheet is shipped for it, whether or not it is offered. */
export function isLook(value: unknown): value is Look {
  return LOOKS.some((l) => l.value === value);
}

/** The looks the selector offers, in its order. */
export function offeredLooks(): { value: Look; name: string }[] {
  return LOOKS.filter((l) => !l.shelved).map((l) => ({ value: l.value, name: l.name }));
}

/** A look a person may have, so the one a settings file names. */
export function isOffered(value: unknown): value is Look {
  return LOOKS.some((l) => l.value === value && !l.shelved);
}

/** design/0015 -- the order the notes inside a date-ordered book are read in. */
export type NoteOrder = "oldest" | "newest";

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
    lastOpened: {},
    dateFields: ["date", "created"],
    peopleFields: ["people", "attendees", "person"],
    personNote: "type: people",
    useFileStamp: true,
    noteOrder: "oldest",
    look: "leather",
    palette: [],
    ribbons: ribbonsOf(null, null),
    bookColors: {},
    bookSpines: {},
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
  const from = typeof data.schema === "number" ? data.schema : 0;
  return {
    schema: SETTINGS_SCHEMA,
    shelves: shelves.length
      ? withFavourites(shelves.map((s) =>
          boundBy(pickedBy(arrangedBy(variesOn(alphabetOn(weeksAway(decadesOn(s, from), from), from), data))))),
          from)
      : base.shelves,
    reading: Array.isArray(data.reading) ? data.reading.filter(isMark) : [],
    wear: wearOf(data.wear),
    lastOpened: lastOpenedOf(data.lastOpened),
    dateFields: Array.isArray(data.dateFields) && data.dateFields.length
      ? data.dateFields.filter((f): f is string => typeof f === "string")
      : base.dateFields,
    peopleFields: peopleFieldsOf(data, base.peopleFields),
    personNote: typeof data.personNote === "string" ? data.personNote.trim() : base.personNote,
    /* Schema 3 turned the file-stamp fallback on. A file written under it says `false`,
     * which was the default rather than a decision -- the same argument `decadesOn` makes
     * about plaques -- so it comes up on, and a file that already says 3 means what it says. */
    useFileStamp: from >= 3 ? data.useFileStamp === true : true,
    noteOrder: data.noteOrder === "newest" ? "newest" : "oldest",
    /* Schema 6 made leather the look a fresh library opens in. A file written under an
     * earlier one says `""`, which was the only look there was to start with rather than a
     * decision -- the same argument `decadesOn` makes about plaques -- so it comes up in
     * leather, and one that already says 6 means what it says. Changing it back is one
     * selector in the top bar. */
    /* Schema 9 shelved the cyber look: a file that names a look the selector no longer
     * offers comes up in the default one, since a look a person cannot pick is not a
     * preference they can keep. */
    look: isOffered(data.look) ? (from >= 6 || data.look ? data.look : "leather") : base.look,
    palette: paletteOf(data.palette),
    /* Schema 10 gave every slot its own ribbon. A file written under an earlier one carries a
     * single `ribbon` that every book in the library wore, so it becomes all twelve -- the
     * colour was a choice, and dropping it to reintroduce it as a default would be reading
     * the person's mind rather than their file. */
    ribbons: ribbonsOf(data.ribbons, (data as { ribbon?: unknown }).ribbon),
    bookColors: bookColorsOf(data.bookColors),
    bookSpines: bookSpinesOf(data.bookSpines),
  };
}

/** design/0029 */
function boundBy(shelf: Shelf): Shelf {
  const out = { ...shelf };
  if (out.indexMode !== "az" && out.indexMode !== "date") delete out.indexMode;
  if (out.bookIndexes) {
    out.bookIndexes = Object.fromEntries(Object.entries(out.bookIndexes)
      .filter(([, mode]) => mode === "az" || mode === "date"));
  }
  if (!isSpineStyle(out.spineStyle)) delete out.spineStyle;
  if (!["one", "book", "year", "decade"].includes(out.spineSeries || "")) delete out.spineSeries;
  return out;
}

/** design/0029 */
export function demoSettings(notes: Note[]): Persisted {
  const settings = emptySettings();
  const views = settings.shelves.map((shelf) => buildShelf(shelf, notes));
  settings.shelves[0].picks = seedPicks(views);
  return settings;
}

/**
 * design/0003 -- SCHEMA 2 GAVE THE YEAR CLASSIFIER A PLAQUE, and a settings file written under
 * schema 1 has `plaques: false` on its Years shelf. That was never a decision anybody made:
 * under schema 1 the checkbox was disabled for a year shelf, so `false` was the only value the
 * option could hold. Turning it on is finishing the migration, not overriding a preference --
 * which is why it is done once, on the way up from 1, and only for a shelf still classified by
 * year. A shelf somebody has since turned the plaques off on keeps them off, because by then
 * its file says schema 2.
 */
/**
 * Schema 4 hid the Weeks shelf. `hidden: false` on it under an earlier schema was the default
 * rather than a decision -- the same argument `decadesOn` makes about plaques -- and the shelf
 * it applies to is the one that got a dozen rows long when the bookcase replaced the scroller.
 * Un-hiding it is one click in Manage, and a file that already says 4 means what it says.
 */
/**
 * design/0003 -- Schema 6 gave the alphabet a plaque, so the People and Tags shelves a file was
 * written with say `plaques: false` on a question that could not be asked when it was written:
 * `plaqueFor` returned null for every classifier that was not a date, so the checkbox did
 * nothing on those shelves. The same argument `decadesOn` makes, one classifier along.
 */
function alphabetOn(shelf: Shelf, from: number): Shelf {
  if (from >= 6 || shelf.plaques) return shelf;
  const lettered = shelf.classifier === "person" || shelf.classifier === "tag";
  return lettered ? { ...shelf, plaques: true } : shelf;
}

/**
 * design/0005 -- varying colours used to be one switch for the whole library, in schema 6 and
 * 7. It is per shelf now; a file that had the switch on comes up with it on for every shelf
 * that varied under it, which was every shelf but the Encyclopedia.
 */
function variesOn(shelf: Shelf, data: Partial<Persisted> & { varyBookColors?: unknown }): Shelf {
  if (shelf.varyColors !== undefined) return shelf;
  if (data.varyBookColors === true && shelf.classifier !== "initial") {
    return { ...shelf, varyColors: true };
  }
  return shelf;
}

/**
 * design/0018 -- NO SCHEMA BUMP: a shelf with no `order` is simply automatic, which is what
 * every shelf written before this was and what every shelf written after it still starts as.
 * What is needed instead is that a hand-edited file cannot hand the builder a sequence that is
 * not a list of keys, and that a shelf saying "manual" with nothing arranged yet is exactly an
 * A-to-Z shelf rather than an empty one.
 */
function arrangedBy(shelf: Shelf): Shelf {
  const listed = Array.isArray(shelf.order)
    ? shelf.order.filter((k): k is string => typeof k === "string" && k !== "")
    : [];
  const seen = new Set<string>();
  const order = listed.filter((k) => (seen.has(k) ? false : (seen.add(k), true)));
  const direction = shelf.direction === "manual" || shelf.direction === "chronological"
    ? shelf.direction : "alphabetical";
  if (!order.length) {
    const rest: Shelf = { ...shelf, direction };
    delete rest.order;
    return rest;
  }
  return { ...shelf, direction, order };
}

/**
 * design/0019 -- A PICK SHELF IS MANUAL AND HAS NO ORDER. Its sequence is `picks`, so an
 * `order` a hand-edited file gives it is dropped rather than left to disagree; a pick that is
 * not an address (something with a slash in it) is not a pick; duplicates collapse. A shelf
 * that is not a pick shelf loses any `picks` the same way. `plaques` is off because there is
 * no unit above a book somebody dropped.
 */
/* design/0020 -- a made key stays in picks while `made` defines it. */
function pickedBy(shelf: Shelf): Shelf {
  const made = madeOf(shelf.made);
  if (shelf.classifier !== "pick") {
    if (shelf.picks === undefined && shelf.made === undefined) return shelf;
    const rest: Shelf = { ...shelf };
    delete rest.picks;
    if (Object.keys(made).length) rest.made = made; else delete rest.made;
    return rest;
  }
  const listed = Array.isArray(shelf.picks)
    ? shelf.picks.filter((p): p is string =>
        typeof p === "string" && (p.indexOf("/") > 0 || made[p] !== undefined))
    : [];
  const seen = new Set<string>();
  const picks = listed.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  for (const key of Object.keys(made)) if (!seen.has(key)) picks.push(key);
  const out: Shelf = { ...shelf, direction: "manual", plaques: false, picks };
  delete out.order;
  if (Object.keys(made).length) out.made = made; else delete out.made;
  return out;
}

const SOURCE_KINDS: SourceKind[] = ["all", "tag", "person", "folder"];

/** design/0020 -- a name and a source of a known kind, or nothing. */
function madeOf(raw: unknown): Record<string, MadeBook> {
  const out: Record<string, MadeBook> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMadeKey(key) || !value || typeof value !== "object") continue;
    const m = value as Partial<MadeBook>;
    const name = typeof m.name === "string" ? m.name.trim() : "";
    const source = m.source && typeof m.source === "object" ? m.source : null;
    const kind = source ? source.kind : undefined;
    if (!name || !kind || SOURCE_KINDS.indexOf(kind) < 0) continue;
    out[key] = kind === "all" || typeof source?.value !== "string"
      ? { name, source: { kind } }
      : { name, source: { kind, value: source.value } };
  }
  return out;
}

/**
 * design/0019 -- SCHEMA 10 PUT A FAVOURITES SHELF FIRST. A file written under an earlier one
 * has no pick shelf because there was no such thing, which was never a decision -- the same
 * argument `decadesOn` makes about plaques -- so one is put at position 0 and every other
 * shelf moves down one place in the order it was in. A file already at 10 means what it says,
 * and one that already has a pick shelf anywhere keeps it there. The id is `favourites`
 * unless a shelf a person made already took it (`slug("Favourites")` is the same word).
 */
function withFavourites(shelves: Shelf[], from: number): Shelf[] {
  const placed = shelves.map((s, i) => ({ ...s, position: i }));
  if (from >= 10 || placed.some((s) => s.classifier === "pick")) return placed;
  const taken = new Set(placed.map((s) => s.id));
  let id = "favourites";
  for (let n = 2; taken.has(id); n++) id = "favourites-" + n;
  const favourites: Shelf = { ...defaultShelves()[0], id };
  return [favourites].concat(placed).map((s, i) => ({ ...s, position: i }));
}

const HEX = /^#[0-9a-f]{6}$/i;
function isHex(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

/** Twelve hex colours or nothing: eleven is a palette with a hole in it, which is nothing. */
function paletteOf(raw: unknown): string[] {
  if (!Array.isArray(raw) || (raw.length !== 12 && raw.length !== 14)) return [];
  return raw.every(isHex) ? raw.map((c) => String(c).toLowerCase()) : [];
}

/**
 * Twelve entries, each a hex colour or "". Anything else in a slot is "", which means the
 * complement of that slot's dye and is computed where the dye is known.
 */
function ribbonsOf(raw: unknown, legacy: unknown): string[] {
  const one = isHex(legacy) ? String(legacy).toLowerCase() : "";
  const from = Array.isArray(raw) && (raw.length === 12 || raw.length === 14) ? raw : null;
  return Array.from({ length: 14 }, (_unused, i) => {
    if (from) return isHex(from[i]) ? String(from[i]).toLowerCase() : "";
    return one;
  });
}

function bookColorsOf(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 14) {
      out[key] = value;
    }
  }
  return out;
}

function weeksAway(shelf: Shelf, from: number): Shelf {
  if (from >= 4 || shelf.id !== "weeks" || shelf.hidden) return shelf;
  return { ...shelf, hidden: true };
}

function decadesOn(shelf: Shelf, from: number): Shelf {
  if (from >= 2 || shelf.classifier !== "year" || shelf.plaques) return shelf;
  return { ...shelf, plaques: true };
}

/**
 * Schema 5 turned the single `peopleProperty` into a list. A file written under it carries the
 * one name it was set to, which is kept -- that WAS a decision, unlike the defaults schema 2
 * and 3 and 4 changed -- and joined by the two conventions the default now also reads, so a
 * vault whose meeting notes use `attendees` stops having an empty People shelf.
 */
function peopleFieldsOf(data: Partial<Persisted> & { peopleProperty?: unknown },
                        fallback: string[]): string[] {
  const listed = Array.isArray(data.peopleFields)
    ? data.peopleFields.filter((f): f is string => typeof f === "string" && f.trim() !== "")
    : [];
  if (listed.length) return [...new Set(listed.map((f) => f.trim()))];
  const one = typeof data.peopleProperty === "string" ? data.peopleProperty.trim() : "";
  return one ? [...new Set([one, ...fallback])] : fallback.slice();
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

/** design/0033 */
export function lastOpenedAt(settings: Pick<Persisted, "lastOpened">, bookId: string): string {
  return settings.lastOpened[bookId] || "never";
}

/** design/0033 */
function lastOpenedOf(raw: unknown): Record<string, string> {
  const entries: [string, string][] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) continue;
    const time = Date.parse(value);
    if (Number.isFinite(time) && new Date(time).toISOString() === value) entries.push([key, value]);
  }
  return Object.fromEntries(entries);
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
