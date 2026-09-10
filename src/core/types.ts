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
  | "initial" | "year" | "month" | "week" | "person" | "tag" | "folder" | "property";

export type SourceKind = "all" | "tag" | "person" | "folder";

export interface Source {
  kind: SourceKind;
  /** The tag, person or folder the predicate is about. Ignored when kind is "all". */
  value?: string;
}

export interface Shelf {
  /** decisions/0002 */
  id: string;
  name: string;
  source: Source;
  classifier: ClassifierKind;
  /** Frontmatter property name, for the "property" classifier. */
  property?: string;
  direction: "alphabetical" | "chronological";
  hidden: boolean;
  position: number;
  /** design/0003 */
  plaques: boolean;
  /** Whether `#garden` also collects `#garden/seeds`. */
  includeSubtags?: boolean;
}

export interface Book {
  /** decisions/0002 */
  id: string;
  shelfId: string;
  /** The raw classifier key -- "2026-09", "A", "Mira". Sorting is done on this. */
  key: string;
  label: string;
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
