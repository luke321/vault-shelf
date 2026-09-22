import type { Book, ClassifierKind, ColorRule, Filters, MatchReason, Note, Shelf, ShelfView, Source } from "./types";
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

/* ---- a book made on the shelf --------------------------------------------
 * design/0020 -- the key is fixed at creation and is never an address.
 */

const MADE = "-made-";

export function isMadeKey(key: string): boolean {
  return key.indexOf(MADE) === 0;
}

/** design/0020 -- a slug, unique against `taken`. */
export function madeKey(name: string, taken: string[]): string {
  const base = MADE + (name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book");
  let key = base;
  for (let n = 2; taken.indexOf(key) >= 0; n++) key = base + "-" + n;
  return key;
}

/** design/0020 -- a reference is not a place a note lives; a made book is. */
export function isReference(shelf: Shelf, book: Book): boolean {
  return shelf.classifier === "pick" && !isMadeKey(book.key);
}

export function madeKeys(shelf: Shelf): string[] {
  return Object.keys(shelf.made ?? {});
}

/** design/0020 -- a made key is live by definition. */
export function liveOn(shelf: Shelf, live: Set<string>): Set<string> {
  const out = new Set(live);
  for (const key of madeKeys(shelf)) out.add(key);
  return out;
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

/** github#70, design/0035 */
export function leadingNumber(title: string): string {
  const m = /^\d+/.exec(title.replace(/^[^\p{L}\p{N}]+/u, ""));
  return m ? m[0] : "";
}

/** github#70, design/0035 */
export function numericBook(notes: Note[]): boolean {
  return notes.length > 0 && notes.every((n) => leadingNumber(n.title) !== "");
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

/* github#12, design/0002 -- the cover drops the hash; every horizontal place keeps it. */
export function coverFor(key: string, kind: ClassifierKind): string {
  return kind === "tag" && key !== UNFILED ? key : labelFor(key, kind);
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
  if (shelf.classifier === "pick") return buildPicks(shelf, notes, order, sources);
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
      cover: coverFor(key, shelf.classifier),
      plaque: plaqueFor(key, shelf),
      notes: list.slice().sort(readingOrder(shelf, order, key, list)),
      bands: bandsOf(list),
      matches: 0,
    });
  }

  books.sort((a, b) => compareKeys(a.key, b.key, autoDirection(shelf, order)));
  /* design/0020 -- a made book stands on any shelf; its notes count once. */
  const seen = new Set(members.map((n) => n.id));
  for (const key of madeKeys(shelf)) {
    const made = madeBookOf(shelf, key, notes, order);
    if (!made) continue;
    books.push(made);
    for (const n of made.notes) seen.add(n.id);
  }
  return {
    shelf,
    books: shelf.direction === "manual" ? arrange(books, shelf.order) : books,
    noteCount: seen.size,
  };
}

/** design/0020 -- one made book, from the same filtered notes as the shelf. */
function madeBookOf(shelf: Shelf, key: string, notes: Note[], order: NoteOrder): Book | null {
  const made = shelf.made?.[key];
  if (!made) return null;
  const members = notes.filter((n) => matchesSource(n, made.source, true));
  return {
    id: bookId(shelf.id, key),
    shelfId: shelf.id,
    key,
    label: made.name,
    /* github#12 -- a made book was named by a person, so its cover is that name: there is no
     * classifier key underneath it to strip a hash from. */
    cover: made.name,
    plaque: null,
    notes: members.slice().sort(readingOrder(shelf, order, key, members)),
    bands: bandsOf(members),
    matches: 0,
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
/* design/0020 -- built from the same notes; empty, never skipped. */
function buildPicks(shelf: Shelf, notes: Note[], order: NoteOrder, sources: ShelfView[]): ShelfView {
  const byId = new Map<string, Book>();
  for (const view of sources) {
    if (view.shelf.classifier === "pick") continue;
    for (const book of view.books) byId.set(book.id, book);
  }
  const books: Book[] = [];
  const seen = new Set<string>();
  for (const pick of shelf.picks ?? []) {
    const made = isMadeKey(pick) ? madeBookOf(shelf, pick, notes, order) : null;
    if (made) {
      books.push(made);
      for (const n of made.notes) seen.add(n.id);
      continue;
    }
    const source = byId.get(pick);
    if (!source) continue;
    books.push({
      id: bookId(shelf.id, pick),
      shelfId: shelf.id,
      key: pick,
      label: source.label,
      /* github#12 -- a favourite wears the source's cover, not its own: the spine on the
       * Favourites rail and the spine it points at are the same book. */
      cover: source.cover,
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
/* design/0015, design/0035 */
function readingOrder(shelf: Shelf, order: NoteOrder, key?: string, notes?: Note[]): (a: Note, b: Note) => number {
  const mode = indexMode(shelf, key, notes);
  if (mode === "number") return byNumberThenTitle;
  return mode === "az" ? byTitleThenDate : byDateThenTitle(order);
}

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
  /* design/0020 -- a made book sorts after the specials on an automatic shelf. */
  const aMade = isMadeKey(a), bMade = isMadeKey(b);
  if (aMade !== bMade) return aMade ? 1 : -1;
  const aSpecial = a === UNDATED || a === UNFILED;
  const bSpecial = b === UNDATED || b === UNFILED;
  if (aSpecial !== bSpecial) return aSpecial ? 1 : -1;
  if (a === b) return 0;
  const sign = direction === "chronological" ? -1 : 1;
  return a < b ? -sign : sign;
}

/**
 * design/0030, github#70, design/0035
 */
export function indexMode(shelf: Shelf, key?: string, notes?: Note[]): import("./types").IndexMode {
  const saved = (key && shelf.bookIndexes?.[key]) || shelf.indexMode;
  if (saved) return saved;
  const automatic = shelf.classifier === "initial" || shelf.classifier === "tag" ? "az" : "date";
  return automatic === "az" && notes && numericBook(notes) ? "number" : automatic;
}

/* github#80 -- one A-Z, so the two indexes cannot disagree. */
function byTitle(a: Note, b: Note): number {
  const at = a.title.toLowerCase();
  const bt = b.title.toLowerCase();
  return at === bt ? 0 : at < bt ? -1 : 1;
}

function byTitleThenDate(a: Note, b: Note): number {
  const byName = byTitle(a, b);
  if (byName !== 0) return byName;
  const ad = a.date === null ? "" : a.date;
  const bd = b.date === null ? "" : b.date;
  return ad === bd ? 0 : ad < bd ? 1 : -1;
}

/** github#70, design/0035 */
function byNumberThenTitle(a: Note, b: Note): number {
  const an = leadingNumber(a.title).replace(/^0+(?=\d)/, "");
  const bn = leadingNumber(b.title).replace(/^0+(?=\d)/, "");
  if (!an || !bn) return an === bn ? byTitleThenDate(a, b) : an ? -1 : 1;
  if (an.length !== bn.length) return an.length < bn.length ? -1 : 1;
  return an === bn ? byTitleThenDate(a, b) : an < bn ? -1 : 1;
}

/* github#80, decisions/0018 -- the direction is the date's, not the tie-break's. */
function byDateThenTitle(order: NoteOrder): (a: Note, b: Note) => number {
  const dir = order === "newest" ? -1 : 1;
  return (a, b) => {
    const ad = a.date === null ? "" : a.date;
    const bd = b.date === null ? "" : b.date;
    if (ad !== bd) return ad < bd ? -dir : dir;
    return byTitle(a, b);
  };
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

/** github#21 -- a shelf whose keys begin with a year. */
export function datedClassifier(classifier: string): boolean {
  return classifier === "year" || classifier === "month" || classifier === "week";
}

// github#35, design/0019
export function seedPicks(views: ShelfView[]): string[] {
  const out: string[] = [];
  const real = (view: ShelfView) =>
    view.books.filter((b) => b.key.charAt(0) !== "-" && b.notes.length > 0);
  const take = (shelfId: string, best: (a: Book, b: Book) => Book) => {
    const view = views.find((v) => v.shelf.id === shelfId);
    if (!view) return;
    const books = real(view);
    if (!books.length) return;
    const book = books.reduce(best);
    if (out.indexOf(book.id) < 0) out.push(book.id);
  };
  // github#35
  const latest = (a: Book, b: Book) => (b.key > a.key ? b : a);
  const fullest = (a: Book, b: Book) => (b.notes.length > a.notes.length ? b : a);
  take("years", latest);
  take("months", latest);
  take("people", fullest);
  take("tags", fullest);
  return out;
}

/** github#21, github#33, design/0005 -- Years by decade, Months by year, an index by nothing. */
export function colorRule(shelf: Shelf): ColorRule {
  if (shelf.colorBy) return shelf.colorBy;
  if (shelf.classifier === "year") return "decade";
  if (shelf.classifier === "month" || shelf.classifier === "week") return "year";
  if (shelf.classifier === "initial") return "one";
  return "folder";
}

/** github#33, design/0005 -- a shelf of identities varies unless the file says otherwise. */
export function variesColors(shelf: Shelf): boolean {
  if (shelf.classifier === "pick") return false;
  if (shelf.varyColors !== undefined) return shelf.varyColors;
  return shelf.classifier === "person" || shelf.classifier === "tag";
}

/** github#21 -- the period a key's dye follows, null for the folder's. */
export function dyePeriod(shelf: Shelf, key: string): number | null {
  const rule = colorRule(shelf);
  if (rule === "folder") return null;
  const m = /^(\d{4})/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  return rule === "decade" ? Math.floor(year / 10) : year;
}

/* ---- what the search reads -----------------------------------------------
 * github#58, design/0008
 */

/** github#41, github#58, design/0026 -- ONE folding, for the box and the search alike. */
export function fold(text: string): string {
  return text.toLowerCase();
}

/** github#58 -- a note's own text: its title and its declared metadata. */
export function noteText(note: Note): string {
  return fold(note.title + "\n" + note.folder + "\n" +
              note.tags.join("\n") + "\n" + note.people.join("\n"));
}

/** github#58, design/0026 -- what the box and the search both read. */
export function searchableBook(shelf: Shelf, book: Book): boolean {
  if (shelf.hidden || isReference(shelf, book)) return false;
  return book.notes.length > 0 && (book.cover || "").trim().length > 0;
}

/* github#58, github#13 -- the folded haystack, the spines unfolded */
export interface SearchEntry {
  text: string;
  covers: string[];
}

/** github#58 -- note id to what that note is searchable by. */
export type SearchIndex = Map<string, SearchEntry>;

/**
 * github#58, design/0008 -- built ONCE, where the books are, never per keystroke.
 * @param {ShelfView[]} views @param {Note[]} notes @returns {SearchIndex}
 */
export function buildSearchIndex(views: ShelfView[], notes: Note[]): SearchIndex {
  const covers = new Map<string, string[]>();
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (!searchableBook(view.shelf, book)) continue;
      const cover = book.cover.trim();
      for (const note of book.notes) {
        const mine = covers.get(note.id);
        if (!mine) covers.set(note.id, [cover]);
        else if (mine.indexOf(cover) < 0) mine.push(cover);
      }
    }
  }
  const index: SearchIndex = new Map();
  for (const note of notes) {
    const own = noteText(note);
    const mine = covers.get(note.id) || [];
    index.set(note.id, {
      text: mine.length ? own + "\n" + fold(mine.join("\n")) : own,
      covers: mine
    });
  }
  return index;
}

/** github#58 -- a folded needle; an index adds the note's covers. */
export function matchesQuery(note: Note, needle: string,
                             index?: SearchIndex | null): boolean {
  if (!needle) return false;
  const entry = index ? index.get(note.id) : undefined;
  return (entry === undefined ? noteText(note) : entry.text).indexOf(needle) >= 0;
}

/* github#13, github#58, design/0027 -- the same rule, said out loud instead of answered yes or no */
export function matchReasons(note: Note, needle: string,
                             index?: SearchIndex | null): MatchReason[] {
  const out: MatchReason[] = [];
  if (!needle) return out;
  if (note.title.toLowerCase().indexOf(needle) >= 0) out.push({ field: "title", value: note.title });
  for (const t of note.tags) {
    if (t.toLowerCase().indexOf(needle) >= 0) out.push({ field: "tag", value: t });
  }
  for (const p of note.people) {
    if (p.toLowerCase().indexOf(needle) >= 0) out.push({ field: "person", value: p });
  }
  /* github#13, design/0027 -- the folder is the part of a path a reader can see */
  if (note.folder && note.folder.toLowerCase().indexOf(needle) >= 0) {
    out.push({ field: "folder", value: note.folder });
  }
  /* github#58, design/0027 -- the one reason that is not written on the note */
  const entry = index ? index.get(note.id) : undefined;
  if (entry) {
    for (const cover of entry.covers) {
      if (fold(cover).indexOf(needle) >= 0) out.push({ field: "cover", value: cover });
    }
  }
  return out;
}

/**
 * Score every book on every shelf against the query, in place, and report the totals.
 * An empty query zeroes every score, which is what makes clearing the box put the room
 * back exactly as it was rather than rebuilding it.
 */
export function markMatches(views: ShelfView[], query: string,
                            index?: SearchIndex | null):
                            { books: number; notes: number; strong: number } {
  const needle = fold(query.trim());
  const seen = new Set<string>();
  /* github#58 -- a note in 7.6 books is read once, not 7.6 times. */
  const missed = new Set<string>();
  const hit = (note: Note): boolean => {
    if (seen.has(note.id)) return true;
    if (missed.has(note.id)) return false;
    const ok = matchesQuery(note, needle, index);
    (ok ? seen : missed).add(note.id);
    return ok;
  };
  let books = 0;
  /* github#42 -- counted where the books are, so it counts the same books */
  let strong = 0;
  for (const view of views) {
    for (const book of view.books) {
      let n = 0;
      if (needle) {
        for (const note of book.notes) {
          if (!hit(note)) continue;
          n++;
        }
      }
      book.matches = n;
      if (n > 0) books++;
      if (matchStrength(book) >= 3) strong++;
    }
  }
  return { books, notes: seen.size, strong };
}

/* ---- how much of a book answers ------------------------------------------
 * github#42, design/0008
 */

/**
 * github#42, design/0008 -- four rungs, like wear: a half, a fifth, a twentieth.
 * @param {Book} book @returns {0 | 1 | 2 | 3 | 4}
 */
export function matchStrength(book: Book): 0 | 1 | 2 | 3 | 4 {
  const of = book.notes.length;
  if (!book.matches || of <= 0) return 0;
  const share = book.matches / of;
  if (share >= 1 / 2) return 4;
  if (share >= 1 / 5) return 3;
  if (share >= 1 / 20) return 2;
  return 1;
}

/**
 * github#42, design/0008 -- the needle IS this book's cover, not merely inside it.
 * @param {Book} book @param {string} needle @returns {boolean}
 */
export function namesBook(book: Book, needle: string): boolean {
  if (!needle) return false;
  const cover = (book.cover || "").trim();
  return cover.length > 0 && fold(cover) === needle;
}

/* ---- also shelved in -----------------------------------------------------
 * design/0004
 */

export function alsoShelvedIn(noteId: string, views: ShelfView[], exceptBook: string): Book[] {
  const out: Book[] = [];
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (book.id === exceptBook || isReference(view.shelf, book)) continue;
      if (book.notes.some((n) => n.id === noteId)) out.push(book);
    }
  }
  return out;
}

/* ---- a plaque opens its run ------------------------------------------------
 * github#6, design/0019
 */

export const PLAQUE_KEY = "-plaque-";

export function plaqueBookId(shelfId: string, plaque: string): string {
  return shelfId + "/" + PLAQUE_KEY + plaque;
}

export function plaqueOfId(bookId_: string): { shelfId: string; plaque: string } | null {
  const at = bookId_.indexOf("/" + PLAQUE_KEY);
  if (at < 0) return null;
  return { shelfId: bookId_.slice(0, at), plaque: bookId_.slice(at + 1 + PLAQUE_KEY.length) };
}

/* design/0018, design/0019 */
export function runsOf(books: Book[]): { plaque: string | null; books: Book[] }[] {
  const out: { plaque: string | null; books: Book[] }[] = [];
  for (const book of books) {
    const last = out.length ? out[out.length - 1] : null;
    if (!last || last.plaque !== book.plaque) out.push({ plaque: book.plaque, books: [book] });
    else last.books.push(book);
  }
  return out;
}

/* design/0019 */
export function plaqueBook(view: ShelfView, run: Book[], order: NoteOrder = "oldest"): Book | null {
  const plaque = run.length ? run[0].plaque : null;
  if (plaque === null) return null;
  const seen = new Set<string>();
  const notes: Note[] = [];
  for (const book of run) {
    for (const note of book.notes) {
      if (seen.has(note.id)) continue;
      seen.add(note.id);
      notes.push(note);
    }
  }
  notes.sort(readingOrder(view.shelf, order, PLAQUE_KEY + plaque, notes));
  return {
    id: plaqueBookId(view.shelf.id, plaque),
    shelfId: view.shelf.id,
    key: PLAQUE_KEY + plaque,
    label: plaque,
    cover: plaque,
    plaque: null,
    notes,
    bands: bandsOf(notes),
    matches: 0,
    holds: run.length,
  };
}

/* design/0019 */
export function plaqueBookFor(view: ShelfView, plaque: string, noteId: string | null,
                              order: NoteOrder = "oldest"): Book | null {
  const runs = runsOf(view.books).filter((r) => r.plaque === plaque);
  if (!runs.length) return null;
  const holding = noteId
    ? runs.filter((r) => r.books.some((b) => b.notes.some((n) => n.id === noteId)))[0]
    : undefined;
  return plaqueBook(view, (holding || runs[0]).books, order);
}

/**
 * A saved reading place has to survive an edit, a rename and a hidden shelf, so it is
 * re-resolved rather than trusted: the book it names if that book still holds the note,
 * otherwise the first visible book anywhere that does.
 */
/* design/0019, design/0020 -- the reader skips a reference, never a made book. */
export function resolveReading(noteId: string, bookId_: string, views: ShelfView[],
                               order: NoteOrder = "oldest"): Book | null {
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (isReference(view.shelf, book)) continue;
      if (book.id === bookId_ && book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  /* github#6 */
  const plaque = plaqueOfId(bookId_);
  if (plaque) {
    for (const view of views) {
      if (view.shelf.hidden || view.shelf.id !== plaque.shelfId) continue;
      const book = plaqueBookFor(view, plaque.plaque, noteId, order);
      if (book && book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      if (isReference(view.shelf, book)) continue;
      if (book.notes.some((n) => n.id === noteId)) return book;
    }
  }
  return null;
}
