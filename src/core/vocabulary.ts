import type { Note, ShelfView } from "./types";
import { fold, searchableBook } from "./shelves";

/* ---- what the vault spells -----------------------------------------------
 * github#41, design/0026
 */

export type TermKind = "person" | "tag" | "folder" | "book" | "note";

/** github#41, design/0026 -- structural first, so a tag outranks a note title. */
export const KIND_ORDER: TermKind[] = ["person", "tag", "folder", "book", "note"];

/** github#41, design/0026 -- at most this many rows; NOTE_ROWS are titles */
export const SUGGEST_ROWS = 8;
export const NOTE_ROWS = 3;

export interface Term {
  /** github#41 -- what goes in the box when this row is picked */
  text: string;
  /** github#41, design/0026 -- `text` folded the way `matchesQuery` folds. */
  fold: string;
  /** github#41 -- every kind that spells this text, in KIND_ORDER */
  kinds: TermKind[];
  /** github#41 -- how many distinct notes this term names */
  notes: number;
}

/**
 * github#41, github#58, design/0026 -- THE SAME FOLDING `matchesQuery` USES, deliberately.
 * @param {string} text @returns {string}
 */
export function foldTerm(text: string): string {
  return fold(text);
}

/**
 * github#41, design/0026 -- built ONCE, where the books are built, never per keystroke.
 * @param {ShelfView[]} views @param {Note[]} notes @returns {Term[]}
 */
export function buildVocabulary(views: ShelfView[], notes: Note[]): Term[] {
  const byFold = new Map<string, { text: string; kinds: Set<TermKind>; notes: Set<string> }>();

  const add = (text: string, kind: TermKind, noteIds: string[]): void => {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    const fold = foldTerm(trimmed);
    if (!fold) return;
    let term = byFold.get(fold);
    if (!term) {
      term = { text: trimmed, kinds: new Set<TermKind>(), notes: new Set<string>() };
      byFold.set(fold, term);
    }
    term.kinds.add(kind);
    for (const id of noteIds) term.notes.add(id);
  };

  for (const note of notes) {
    for (const person of note.people) add(person, "person", [note.id]);
    for (const tag of note.tags) add(tag, "tag", [note.id]);
    add(note.folder, "folder", [note.id]);
    add(note.title, "note", [note.id]);
  }

  /* github#41, design/0026 -- a hidden shelf is not somewhere a reader can be sent. */
  for (const view of views) {
    if (view.shelf.hidden) continue;
    for (const book of view.books) {
      /* github#58, design/0026 -- THE COVER, which is what the search reads and a spine says. */
      if (!searchableBook(view.shelf, book)) continue;
      add(book.cover, "book", book.notes.map((n) => n.id));
    }
  }

  const out: Term[] = [];
  byFold.forEach((term, fold) => {
    out.push({
      text: term.text,
      fold,
      kinds: KIND_ORDER.filter((k) => term.kinds.has(k)),
      notes: term.notes.size
    });
  });
  /* github#41 -- one stable order, so two runs offer the same list */
  out.sort((a, b) => (b.notes - a.notes) || (a.fold < b.fold ? -1 : a.fold > b.fold ? 1 : 0));
  return out;
}

/** github#41, design/0026 -- "note" sorts last in KIND_ORDER, so first is enough */
function structural(term: Term): boolean {
  return term.kinds[0] !== "note";
}

/**
 * github#41, design/0026 -- offered on CONTAINS, ranked on PREFIX
 * github#41, design/0026 -- no sort: the vocabulary is already in rank order
 * @param {Term[]} vocabulary @param {string} typed @param {number} rows @returns {Term[]}
 */
export function suggest(vocabulary: Term[], typed: string, rows: number = SUGGEST_ROWS): Term[] {
  const needle = foldTerm((typed || "").trim());
  if (!needle) return [];

  /* github#41, design/0026 -- prefix before contains, structural before a bare title */
  const buckets: Term[][] = [[], [], [], []];
  for (let i = 0; i < vocabulary.length; i++) {
    const term = vocabulary[i];
    const at = term.fold.indexOf(needle);
    if (at < 0) continue;
    const bucket = buckets[(at === 0 ? 0 : 2) + (structural(term) ? 0 : 1)];
    if (bucket.length < rows) bucket.push(term);
  }

  /* github#41, design/0026 -- titles are 4,938 of the 5,147 terms here, so they are capped */
  const out: Term[] = [];
  let titles = 0;
  for (let b = 0; b < buckets.length && out.length < rows; b++) {
    for (const term of buckets[b]) {
      if (out.length >= rows) break;
      const onlyTitle = !structural(term);
      if (onlyTitle && titles >= NOTE_ROWS) continue;
      if (onlyTitle) titles++;
      out.push(term);
    }
  }
  return out;
}

/**
 * github#41, design/0026 -- the kinds, as a person reads them.
 * @param {Term} term @returns {string}
 */
export function kindsLabel(term: Term): string {
  return term.kinds.join(" · ");
}
