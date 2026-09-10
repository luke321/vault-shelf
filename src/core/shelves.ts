import type { Book, ClassifierKind, Filters, Note, Shelf, ShelfView, Source } from "./types";
import { isoWeekOf, monthLabel, monthOf, weekLabel, yearOf } from "./dates";

/* ---- stable addresses ----------------------------------------------------
 * decisions/0002
 */

const UNDATED = "-undated";
const UNFILED = "-unfiled";

/** A book's address is the shelf's id and the classifier key, and nothing else. */
export function bookId(shelfId: string, key: string): string {
  return shelfId + "/" + key;
}

export function slug(text: string): string {
  const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || "shelf";
}

/* ---- the source predicate ------------------------------------------------
 * design/0002
 */

export function matchesSource(note: Note, source: Source, includeSubtags: boolean): boolean {
  const value = source.value === undefined ? "" : source.value;
  switch (source.kind) {
    case "all": return true;
    case "tag": return note.tags.some((t) => t === value || (includeSubtags && t.startsWith(value + "/")));
    case "person": return note.people.indexOf(value) >= 0;
    case "folder": return note.folder === value || note.folder.startsWith(value + "/");
    default: return false;
  }
}

/* ---- the eight classifiers -----------------------------------------------
 * design/0002
 *
 * A classifier answers "what makes a book" with a LIST of keys, not one: a note with three
 * people belongs in three books, and the count of unique notes on the shelf is still one.
 */
export function keysFor(note: Note, shelf: Shelf): string[] {
  const kind: ClassifierKind = shelf.classifier;
  switch (kind) {
    case "initial": {
      const ch = firstLetter(note.title);
      return [ch];
    }
    case "year": return [note.date ? yearOf(note.date) : UNDATED];
    case "month": return [note.date ? monthOf(note.date) : UNDATED];
    case "week": return [note.date ? isoWeekOf(note.date) : UNDATED];
    case "person": return note.people.length ? note.people.slice() : [UNFILED];
    case "tag": {
      const tags = shelf.includeSubtags === false
        ? note.tags.filter((t) => t.indexOf("/") < 0)
        : note.tags;
      return tags.length ? tags.slice() : [UNFILED];
    }
    case "folder": return [note.folder || UNFILED];
    case "property": {
      const name = shelf.property === undefined ? "" : shelf.property;
      const raw = note.props[name];
      return raw ? [raw] : [UNFILED];
    }
    default: return [UNFILED];
  }
}

/**
 * The Encyclopedia's 0-9 volume is a decision, not a fallback: a vault whose titles start
 * with a date would otherwise open with ten single-note books before it reached A.
 */
export function firstLetter(title: string): string {
  const trimmed = title.replace(/^[^\p{L}\p{N}]+/u, "");
  const ch = trimmed.slice(0, 1).toUpperCase();
  if (!ch) return "#";
  if (ch >= "0" && ch <= "9") return "0-9";
  if (ch >= "A" && ch <= "Z") return ch;
  return ch;
}

export function labelFor(key: string, kind: ClassifierKind): string {
  if (key === UNDATED) return "Undated";
  if (key === UNFILED) return kind === "person" ? "No one named"
                            : kind === "tag" ? "Untagged"
                            : kind === "property" ? "No value" : "Unfiled";
  switch (kind) {
    case "month": return monthLabel(key);
    case "week": return weekLabel(key);
    case "tag": return "#" + key;
    case "folder": return key.split("/").pop() || key;
    default: return key;
  }
}

/**
 * design/0003 -- plaques are date classifiers only; anything else groups under nothing.
 *
 * Each date classifier groups under the next unit up: months and weeks under their year,
 * years under their DECADE. A vault fifteen years deep has sixteen year-books in a row, which
 * is a row you have to read rather than scan; `2010-2019` over the first seven of them is the
 * same favour the year plaque does for forty-three months.
 *
 * The label is the decade it actually holds. `2000-2010` would read more naturally and would
 * be a lie: 2010 is in the next plaque's run, and two plaques claiming the same year is worse
 * than an unfamiliar-looking label.
 */
export function plaqueFor(key: string, shelf: Shelf): string | null {
  if (!shelf.plaques) return null;
  if (key === UNDATED) return null;
  if (shelf.classifier === "month") return key.slice(0, 4);
  if (shelf.classifier === "week") return key.slice(0, 4);
  if (shelf.classifier === "year") return decadeOf(key);
  return null;
}

/** "2014" -> "2010-2019". The key is a four-digit year; anything else has no decade. */
export function decadeOf(year: string): string | null {
  if (!/^\d{4}$/.test(year)) return null;
  const start = Math.floor(Number(year) / 10) * 10;
  return start + "-" + (start + 9);
}

/* ---- building the shelf --------------------------------------------------
 * design/0002
 */

export function buildShelf(shelf: Shelf, notes: Note[]): ShelfView {
  const includeSubtags = shelf.includeSubtags !== false;
  const members = notes.filter((n) => matchesSource(n, shelf.source, includeSubtags));
  const byKey = new Map<string, Note[]>();

  for (const note of members) {
    const seen = new Set<string>();
    for (const key of keysFor(note, shelf)) {
      if (seen.has(key)) continue;
      seen.add(key);
      const list = byKey.get(key);
      if (list) list.push(note); else byKey.set(key, [note]);
    }
  }

  const books: Book[] = [];
  for (const [key, list] of byKey) {
    books.push({
      id: bookId(shelf.id, key),
      shelfId: shelf.id,
      key,
      label: labelFor(key, shelf.classifier),
      plaque: plaqueFor(key, shelf),
      notes: list.slice().sort(alphabetical(shelf) ? byTitleThenDate : byDateThenTitle),
      bands: bandsOf(list),
      matches: 0,
    });
  }

  books.sort((a, b) => compareKeys(a.key, b.key, shelf.direction));
  return { shelf, books, noteCount: members.length };
}

/**
 * Undated and Unfiled sort last in both directions. They are real books and hiding them
 * would lose notes; putting them first would open every date shelf on its least useful page.
 */
function compareKeys(a: string, b: string, direction: Shelf["direction"]): number {
  const aSpecial = a === UNDATED || a === UNFILED;
  const bSpecial = b === UNDATED || b === UNFILED;
  if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
  if (a === b) return 0;
  const sign = direction === "chronological" ? -1 : 1;
  return a < b ? -sign : sign;
}

/**
 * design/0015 -- AN ENCYCLOPEDIA VOLUME IS ALPHABETICAL INSIDE, and every other book is a
 * record of when. The order is not decoration: the reader's index tabs jump to a position in
 * this list, so tabs that read A, B, C over a list ordered by date point at nothing.
 */
function alphabetical(shelf: Shelf): boolean {
  return shelf.classifier === "initial";
}

function byTitleThenDate(a: Note, b: Note): number {
  const at = a.title.toLowerCase();
  const bt = b.title.toLowerCase();
  if (at !== bt) return at < bt ? -1 : 1;
  const ad = a.date === null ? "" : a.date;
  const bd = b.date === null ? "" : b.date;
  return ad === bd ? 0 : ad < bd ? 1 : -1;
}

function byDateThenTitle(a: Note, b: Note): number {
  const ad = a.date === null ? "" : a.date;
  const bd = b.date === null ? "" : b.date;
  if (ad !== bd) return ad < bd ? 1 : -1;
  return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
}

function bandsOf(notes: Note[]): Book["bands"] {
  const counts = new Map<string, number>();
  for (const n of notes) counts.set(n.folder, (counts.get(n.folder) || 0) + 1);
  return [...counts.entries()]
    .map(([folder, count]) => ({ folder, slot: 0, count }))
    .sort((a, b) => b.count - a.count || (a.folder < b.folder ? -1 : 1));
}

/* ---- filters -------------------------------------------------------------
 * design/0004
 */

export function applyFilters(notes: Note[], filters: Filters): Note[] {
  const folders = filters.folders;
  if (!folders.length && filters.from === null && filters.to === null) return notes;
  return notes.filter((n) => {
    if (folders.length && !folders.some((f) => n.folder === f || n.folder.startsWith(f + "/"))) return false;
    if (filters.from !== null && (n.date === null || n.date < filters.from)) return false;
    if (filters.to !== null && (n.date === null || n.date > filters.to)) return false;
    return true;
  });
}

/* ---- the query -----------------------------------------------------------
 * design/0008
 */

/** One note against one already-lowercased needle. Title, path, tags, people, then body. */
export function matchesQuery(note: Note, needle: string): boolean {
  if (!needle) return false;
  if (note.title.toLowerCase().indexOf(needle) >= 0) return true;
  if (note.path.toLowerCase().indexOf(needle) >= 0) return true;
  if (note.tags.some((t) => t.toLowerCase().indexOf(needle) >= 0)) return true;
  if (note.people.some((p) => p.toLowerCase().indexOf(needle) >= 0)) return true;
  return note.body.toLowerCase().indexOf(needle) >= 0;
}

/**
 * Score every book on every shelf against the query, in place, and report the totals.
 * An empty query zeroes every score, which is what makes clearing the box put the room
 * back exactly as it was rather than rebuilding it.
 */
export function markMatches(views: ShelfView[], query: string): { books: number; notes: number } {
  const needle = query.trim().toLowerCase();
  const seen = new Set<string>();
  let books = 0;
  for (const view of views) {
    for (const book of view.books) {
      let n = 0;
      if (needle) {
        for (const note of book.notes) {
          if (!matchesQuery(note, needle)) continue;
          n++;
          seen.add(note.id);
        }
      }
      book.matches = n;
      if (n > 0) books++;
    }
  }
  return { books, notes: seen.size };
}

/* ---- also shelved in -----------------------------------------------------
 * design/0004
 */

export function alsoShelvedIn(noteId: string, views: ShelfView[], exceptBook: string): Book[] {
  const out: Book[] = [];
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (book.id === exceptBook) continue;
      if (book.notes.some((n) => n.id === noteId)) out.push(book);
    }
  }
  return out;
}

/**
 * A saved reading place has to survive an edit, a rename and a hidden shelf, so it is
 * re-resolved rather than trusted: the book it names if that book still holds the note,
 * otherwise the first visible book anywhere that does.
 */
export function resolveReading(noteId: string, bookId_: string, views: ShelfView[]): Book | null {
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (book.id === bookId_ && book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  return null;
}
