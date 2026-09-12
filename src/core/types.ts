/* ---- notes ---------------------------------------------------------------
 * design/0001
 */

/** One note, as both hosts hand it over. Nothing here is Obsidian-specific. */
export interface Note {
  /** decisions/0002 */
  id: string;
  path: string;
  title: string;
  folder: string;
  /** ISO `YYYY-MM-DD`, or null for Undated. */
  date: string | null;
  people: string[];
  tags: string[];
  props: Record<string, string>;
  excerpt: string;
  body: string;
}

/** github#13, design/0027 -- one surface the needle was found in. */
export interface MatchReason {
  field: "title" | "tag" | "person" | "folder" | "path" | "body";
  /** github#13 -- what to show, empty where there is nothing to point at. */
  value: string;
}

export interface FolderInfo {
  path: string;
  count: number;
  slot: number;
}

export interface Library {
  generatedAt: string;
  vaultName: string;
  notes: Note[];
  folders: FolderInfo[];
}

/* ---- shelves -------------------------------------------------------------
 * design/0002
 */

export type ClassifierKind =
  | "initial" | "year" | "month" | "week" | "person" | "tag" | "folder" | "property"
  /** design/0019 -- a shelf of references to other shelves' books, in the order they were dropped. */
  | "pick";

export type SourceKind = "all" | "tag" | "person" | "folder";

export interface Source {
  kind: SourceKind;
  /** The tag, person or folder the predicate is about. Ignored when kind is "all". */
  value?: string;
}

/** design/0020 -- a book made on a pick shelf: a name and what it holds. */
export interface MadeBook {
  name: string;
  source: Source;
}

export interface Shelf {
  /** decisions/0002 */
  id: string;
  name: string;
  source: Source;
  classifier: ClassifierKind;
  /** Frontmatter property name, for the "property" classifier. */
  property?: string;
  /** design/0018 -- "manual" is the order a person put the books in, held in `order`. */
  direction: "alphabetical" | "chronological" | "manual";
  /**
   * design/0018 -- the sequence, as classifier KEYS rather than addresses or indices: a key is
   * what `decisions/0002` says survives, and the same list therefore still means something
   * after a rebuild, a filter or a rename. A key here that the vault no longer has is dropped
   * when the sequence is next saved; a key the vault has that is not here goes to the end.
   */
  order?: string[];
  /**
   * design/0019 -- what a PICK shelf holds: the ADDRESSES of other shelves' books, in the order
   * they were dropped. Membership and sequence are one list here -- a favourite exists because
   * it was placed -- so a pick shelf never carries `order`. An address the library no longer
   * resolves is skipped on read and dropped when the list is next saved, like a manual key.
   */
  picks?: string[];
  /** design/0020 -- the made books, by the key `picks` or `order` names. */
  made?: Record<string, MadeBook>;
  hidden: boolean;
  position: number;
  /** design/0003 */
  plaques: boolean;
  /** Whether `#garden` also collects `#garden/seeds`. */
  includeSubtags?: boolean;
  /**
   * design/0005 -- give each book on this shelf a fixed colour of its own, hashed from its
   * address so it stays put as notes arrive, instead of the dye of its dominant folder. Per
   * shelf, because an Encyclopedia that varies reads as a rainbow and a People shelf that
   * varies reads as people.
   */
  varyColors?: boolean;
  /** github#21 -- what a dye follows here; unset is the classifier's own. */
  colorBy?: ColorRule;
}

/** github#21, github#33 -- design/0005 */
export type ColorRule = "folder" | "year" | "decade" | "one";

export interface Book {
  /** decisions/0002 */
  id: string;
  shelfId: string;
  /** The raw classifier key -- "2026-09", "A", "Mira". Sorting is done on this. */
  key: string;
  label: string;
  /** github#12 */
  cover: string;
  /** github#6 */
  holds?: number;
  /** design/0003 */
  plaque: string | null;
  notes: Note[];
  /** Source-folder mix, biggest first: the fingerprint band on a spine. */
  bands: { folder: string; slot: number; count: number }[];
  /**
   * design/0008 -- how many of this book's notes answer the current query. A search MARKS,
   * it does not filter: every book stays on the shelf and this is what decides whether it
   * draws forward or thins to a ghost.
   */
  matches: number;
}

export interface ShelfView {
  shelf: Shelf;
  books: Book[];
  /** Unique notes across every book on this shelf. */
  noteCount: number;
}

/* ---- reading -------------------------------------------------------------
 * design/0004
 */

export interface ReadingMark {
  noteId: string;
  shelfId: string;
  bookId: string;
  at: number;
}

/**
 * design/0008 -- FILTERS NARROW, THE QUERY MARKS, and they are different things.
 * A filter removes notes from a shelf before its books are built. The query never does: it
 * is applied afterwards, to books that already exist, so the shelf keeps its shape while you
 * type and the room parts instead of emptying.
 */
export interface Filters {
  folders: string[];
  /** ISO `YYYY-MM-DD`, inclusive. */
  from: string | null;
  to: string | null;
}
