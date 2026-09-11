import type { Book, ClassifierKind, Filters, Note, Shelf, ShelfView, Source } from "./types";
import { isoWeekOf, monthLabel, monthOf, weekLabel, yearOf } from "./dates";
import type { NoteOrder } from "./defaults";

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
/**
 * decisions/0003 -- ONE READING OF A PERSON'S NAME, for the plugin and the exporter both.
 *
 * A people property in a real vault is rarely a bare name. It is `"[[Ada Lovelace]]"`, or
 * `"[[People/Ada Lovelace|Ada]]"`, or a quoted scalar, or an entry in a block list -- and the
 * two hosts each used to unwrap it their own way, which is the shape of bug that once had the
 * exporter inventing a fifteenth month (design/0013).
 *
 * A `{{placeholder}}` is not a person. Templater and the core template plugin leave those in
 * the template file itself, and a vault that keeps its templates alongside its notes would
 * otherwise grow a person called `{{VALUE}}` with a book of its own.
 */
export function cleanPerson(value: string): string {
  const trimmed = String(value).trim().replace(/^["']|["']$/g, "").trim();
  const inner = trimmed.replace(/^\[\[/, "").replace(/\]\]$/, "");
  const label = inner.split("|").pop() ?? inner;
  const leaf = label.split("/").pop() ?? label;
  const name = leaf.trim();
  return /\{\{|\}\}/.test(name) ? "" : name;
}

/**
 * decisions/0003 -- WHAT MAKES A NOTE A PERSON'S NOTE, as one declared rule.
 *
 * A vault that keeps a note per person does not usually repeat the name in a property of every
 * note that mentions them: it links to the person's note and lets the link be the record. That
 * is still a declaration -- the target says what it is -- so reading it is not the prose
 * scanning `decisions/0003` refuses. What is needed is a rule for which notes are people, and
 * this is it, written the way a person would write it in a settings box:
 *
 *   `type: people`   a frontmatter property with that value
 *   `#person`        a tag
 *
 * An empty rule means the vault does not do this and nothing is read from links.
 */
export function isPersonNote(rule: string, props: Record<string, string>, tags: string[]): boolean {
  const trimmed = rule.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("#")) {
    const want = trimmed.slice(1).toLowerCase();
    return tags.some((t) => t.toLowerCase() === want ||
                            t.toLowerCase().startsWith(want + "/"));
  }
  const at = trimmed.indexOf(":");
  if (at < 0) return false;
  const key = trimmed.slice(0, at).trim();
  const want = trimmed.slice(at + 1).trim().toLowerCase();
  const have = props[key];
  return have !== undefined && String(have).trim().toLowerCase() === want;
}

/** Every `[[target]]` in a note's text, as link targets with any alias and heading removed. */
export function linkTargets(body: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m = re.exec(body);
  while (m !== null) {
    const target = m[1].trim();
    if (target) out.push(target);
    m = re.exec(body);
  }
  return out;
}

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
  if (!shelf.plaques || shelf.classifier === "pick") return null;
  if (key === UNDATED) return null;
  if (shelf.classifier === "month") return key.slice(0, 4);
  if (shelf.classifier === "week") return key.slice(0, 4);
  if (shelf.classifier === "year") return decadeOf(key);
  /* A shelf of people or of tags is an alphabet, and an alphabet is exactly what a plaque is
   * for: 126 names in a run are a list to be read, and the same 126 under A, B, C are a shelf
   * to be scanned. `-unfiled` is left without one for the same reason `-undated` is: it is not
   * a letter and it sorts last. */
  if (key === UNFILED) return null;
  return firstLetter(key);
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

/**
 * design/0019 -- a pick shelf classifies nothing. Its books are other shelves' books, resolved
 * against `sources` -- the views of every other shelf, hidden ones included -- so `buildLibrary`
 * is the caller that has them; handed nothing, a pick shelf is simply empty.
 */
export function buildShelf(shelf: Shelf, notes: Note[], order: NoteOrder = "oldest",
                           sources: ShelfView[] = []): ShelfView {
  if (shelf.classifier === "pick") return buildPicks(shelf, sources);
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
      notes: list.slice().sort(alphabetical(shelf)
        ? byTitleThenDate
        : (a, b) => (order === "newest" ? 1 : -1) * byDateThenTitle(a, b)),
      bands: bandsOf(list),
      matches: 0,
    });
  }

  books.sort((a, b) => compareKeys(a.key, b.key, autoDirection(shelf, order)));
  return {
    shelf,
    books: shelf.direction === "manual" ? arrange(books, shelf.order) : books,
    noteCount: members.length,
  };
}

/**
 * design/0019 -- A FAVOURITE IS THE SOURCE BOOK, LIVE. Its label, notes and bands are read off
 * the source on every build, so a favourite Year 2024 grows as notes arrive; only the address
 * is its own -- `<pick shelf>/<source address>`, the key being the whole source address, which
 * is what `decisions/0002` says survives. A pick that resolves to nothing is SKIPPED, not
 * dropped: reading is where a filter is in force, and a filter is not a deletion. The plaque
 * is null because a shelf arranged by dropping has no unit above the book.
 */
function buildPicks(shelf: Shelf, sources: ShelfView[]): ShelfView {
  const byId = new Map<string, Book>();
  for (const view of sources) {
    if (view.shelf.classifier === "pick") continue;
    for (const book of view.books) byId.set(book.id, book);
  }
  const books: Book[] = [];
  const seen = new Set<string>();
  for (const pick of shelf.picks ?? []) {
    const source = byId.get(pick);
    if (!source) continue;
    books.push({
      id: bookId(shelf.id, pick),
      shelfId: shelf.id,
      key: pick,
      label: source.label,
      plaque: null,
      notes: source.notes,
      bands: source.bands.map((b) => ({ ...b })),
      matches: 0,
    });
    for (const n of source.notes) seen.add(n.id);
  }
  return { shelf, books, noteCount: seen.size };
}

/**
 * design/0019 -- every shelf, in position order, with the pick shelves built LAST and against
 * the rest: a favourite at position 0 can only be resolved once the shelf it points at exists.
 * Hidden shelves are built too -- hiding keeps a shelf's books, so a favourite of one still
 * resolves.
 */
export function buildLibrary(shelves: Shelf[], notes: Note[], order: NoteOrder = "oldest"): ShelfView[] {
  const ordered = shelves.slice().sort((a, b) => a.position - b.position);
  const built = new Map<string, ShelfView>();
  const sources: ShelfView[] = [];
  for (const shelf of ordered) {
    if (shelf.classifier === "pick") continue;
    const view = buildShelf(shelf, notes, order);
    built.set(shelf.id, view);
    sources.push(view);
  }
  return ordered.map((shelf) => built.get(shelf.id) ?? buildShelf(shelf, notes, order, sources));
}

/** design/0019 -- every address a pick can currently point at: the books of every non-pick shelf. */
export function pickable(views: ShelfView[]): Set<string> {
  const out = new Set<string>();
  for (const view of views) {
    if (view.shelf.classifier === "pick") continue;
    for (const book of view.books) out.add(book.id);
  }
  return out;
}

/**
 * design/0019 -- ONE WRITE FOR ADD, MOVE AND REMOVE, and it is the write that drops dead picks.
 * `live` is what the UNFILTERED library can resolve, so a source a filter is hiding keeps its
 * place and one the vault has lost goes -- on save, the only moment either question has an
 * answer nobody has to guess (design/0018). `moveBefore` takes the pick out and puts it back
 * in front of `before`, which is what makes a drop of a new book and a drop of one already on
 * the shelf the same act.
 */
export function pickBefore(picks: string[] | undefined, live: Set<string>, sourceId: string,
                           before: string | null): string[] {
  const kept = (picks ?? []).filter((p) => live.has(p));
  if (!live.has(sourceId)) return kept;
  return moveBefore(kept, sourceId, before);
}

export function unpick(picks: string[] | undefined, live: Set<string>, sourceId: string): string[] {
  return (picks ?? []).filter((p) => live.has(p) && p !== sourceId);
}

/**
 * design/0015 -- A DATE SHELF READS THE SAME WAY ITS BOOKS DO. The reading order in the top
 * bar used to turn the notes inside a book round and leave the books themselves alone, so a
 * Years shelf ran 2026 back to 2015 while every book in it ran forwards. One control, both
 * directions. A shelf classified by anything else keeps its own A-to-Z, which the order in
 * the top bar has nothing to say about.
 *
 * design/0018 -- and a shelf arranged by hand has neither: this is only what its LEFTOVERS
 * fall into, so it is A-to-Z and the reading order in the top bar cannot reach it.
 */
function autoDirection(shelf: Shelf, order: NoteOrder): "alphabetical" | "chronological" {
  if (shelf.direction === "manual") return "alphabetical";
  const dated = shelf.classifier === "year" || shelf.classifier === "month" ||
                shelf.classifier === "week";
  if (dated) return order === "newest" ? "chronological" : "alphabetical";
  return shelf.direction;
}

/**
 * design/0018 -- THE SEQUENCE IS A LIST OF KEYS, AND NOTHING ELSE MOVES. Every book keeps the
 * address `decisions/0002` gave it; only where it stands changes. A key the list does not name
 * is not an exclusion -- it goes to the END, in the A-to-Z the shelf would otherwise have had,
 * so a note that arrives overnight never lands in the middle of somebody's arrangement.
 */
export function arrange(books: Book[], order: string[] | undefined): Book[] {
  if (!order || !order.length) return books;
  const at = new Map<string, number>();
  order.forEach((key, i) => { if (!at.has(key)) at.set(key, i); });
  const placed: Book[] = [];
  const rest: Book[] = [];
  for (const book of books) {
    if (at.has(book.key)) placed.push(book); else rest.push(book);
  }
  const rank = (key: string): number => { const i = at.get(key); return i === undefined ? 0 : i; };
  placed.sort((a, b) => rank(a.key) - rank(b.key));
  return placed.concat(rest);
}

/**
 * design/0018 -- ONE MOVE, SAID AS "BEFORE WHICH BOOK", because that is what a drop is and
 * what a filtered shelf can still answer. An index would be an index into whatever happened to
 * be on screen; a neighbour's key means the same thing whether or not the books between them
 * are being shown. `before === null` is the end of the shelf.
 */
export function moveBefore(keys: string[], key: string, before: string | null): string[] {
  const next = keys.filter((k) => k !== key);
  const at = before === null ? -1 : next.indexOf(before);
  if (at < 0) next.push(key); else next.splice(at, 0, key);
  return next;
}

/**
 * Undated and Unfiled sort last in both directions. They are real books and hiding them
 * would lose notes; putting them first would open every date shelf on its least useful page.
 */
function compareKeys(a: string, b: string, direction: "alphabetical" | "chronological"): number {
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

/** Newest first. `buildShelf` flips it for the oldest-first reading order, which is the
 * default: a notebook that opens on its last page reads as if it were written backwards. */
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
    if (view.shelf.hidden || view.shelf.classifier === "pick") continue;
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
/* design/0019 -- THE READER NEVER SEES A PICK SHELF. A favourite is its source book, so the
 * reading place, the ribbon and the also-shelved-in list all name the source; offering the
 * favourite as well would be the same book twice under two addresses. */
export function resolveReading(noteId: string, bookId_: string, views: ShelfView[]): Book | null {
  for (const view of views) {
    if (view.shelf.hidden || view.shelf.classifier === "pick") continue;
    for (const book of view.books) {
      if (book.id === bookId_ && book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  for (const view of views) {
    if (view.shelf.hidden || view.shelf.classifier === "pick") continue;
    for (const book of view.books) {
      if (book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  return null;
}
