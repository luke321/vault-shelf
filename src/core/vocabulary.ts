import type { Note, ShelfView } from "./types";
import { isReference } from "./shelves";

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
 * github#41, design/0026 -- THE SAME FOLDING `matchesQuery` USES, deliberately.
 * @param {string} text @returns {string}
 */
export function foldTerm(text: string): string {
  return text.toLowerCase();
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
      /* design/0020 -- a reference is not a place a note lives; a made book is. */
      if (isReference(view.shelf, book)) continue;
      add(book.label, "book", book.notes.map((n) => n.id));
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

/** github#41, design/0026 -- a term with no kind but "note" is only a title. */
function structural(term: Term): boolean {
  return term.kinds.some((k) => k !== "note");
}

/**
 * github#41, design/0026 -- OFFERED ON CONTAINS, RANKED ON PREFIX.
 * @param {Term[]} vocabulary @param {string} typed @param {number} rows @returns {Term[]}
 */
export function suggest(vocabulary: Term[], typed: string, rows: number = SUGGEST_ROWS): Term[] {
  const needle = foldTerm((typed || "").trim());
  if (!needle) return [];

  const hits: { term: Term; at: number }[] = [];
  for (const term of vocabulary) {
    const at = term.fold.indexOf(needle);
    if (at >= 0) hits.push({ term, at });
  }

  hits.sort((a, b) => {
    const aPrefix = a.at === 0 ? 0 : 1;
    const bPrefix = b.at === 0 ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    const aStruct = structural(a.term) ? 0 : 1;
    const bStruct = structural(b.term) ? 0 : 1;
    if (aStruct !== bStruct) return aStruct - bStruct;
    if (a.term.notes !== b.term.notes) return b.term.notes - a.term.notes;
    if (a.term.text.length !== b.term.text.length) return a.term.text.length - b.term.text.length;
    return a.term.fold < b.term.fold ? -1 : a.term.fold > b.term.fold ? 1 : 0;
  });

  /* github#41, design/0026 -- titles are 4,938 of 5,700 terms here, so they are capped. */
  const out: Term[] = [];
  let titles = 0;
  for (const hit of hits) {
    if (out.length >= rows) break;
    const onlyTitle = !structural(hit.term);
    if (onlyTitle && titles >= NOTE_ROWS) continue;
    if (onlyTitle) titles++;
    out.push(hit.term);
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
