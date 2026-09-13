import type { Book, ShelfView } from "./types";
import { isIsoDay } from "./dates";
import type { Persisted } from "./defaults";
import { isReference, plaqueBookId } from "./shelves";

export type WearLevel = 0 | 1 | 2 | 3;

/** design/0033 */
export function ageWearLevel(latest: string | null, today: string): WearLevel {
  if (!latest || !isIsoDay(latest) || !isIsoDay(today) || latest > today) return 0;
  const years = Number(today.slice(0, 4)) - Number(latest.slice(0, 4)) -
    (today.slice(5) < latest.slice(5) ? 1 : 0);
  if (years >= 7) return 3;
  if (years >= 3) return 2;
  if (years >= 1) return 1;
  return 0;
}

/** design/0033 */
export function bookAgeWear(book: Book, today: string): WearLevel {
  let latest: string | null = null;
  for (const note of book.notes) {
    if (note.date && (!latest || note.date > latest)) latest = note.date;
  }
  return ageWearLevel(latest, today);
}

/** design/0033 */
export function buildAgeWear(views: ShelfView[], today: string): Record<string, WearLevel> {
  const age: Record<string, WearLevel> = {};
  for (const view of views) {
    for (const book of view.books) {
      age[book.id] = bookAgeWear(book, today);
    }
  }
  return age;
}

/** design/0033 */
export function reconcileBookHistory(settings: Persisted, views: ShelfView[]): { changed: boolean; books: number; added: number } {
  const membership = new Map<string, Set<string>>();
  const include = (id: string, book: Book) => {
    let ids = membership.get(id);
    if (!ids) { ids = new Set<string>(); membership.set(id, ids); }
    for (const note of book.notes) ids.add(note.id);
  };
  for (const view of views) {
    for (const book of view.books) {
      if (isReference(view.shelf, book)) continue;
      include(book.id, book);
      if (book.plaque !== null) include(plaqueBookId(view.shelf.id, book.plaque), book);
    }
  }
  let changed = false, added = 0;
  for (const id of Object.keys(settings.wear)) {
    if (!settings.lastOpened[id]) { settings.lastOpened[id] = "never"; changed = true; }
  }
  for (const [id, ids] of membership) {
    const before = settings.bookNotes[id];
    const known = new Set(before || []);
    const next = Array.from(new Set([...(before || []), ...ids])).sort();
    const additions = next.filter((noteId) => !known.has(noteId)).length;
    if (!before || additions) {
      settings.wear[id] = Math.min((settings.wear[id] || 0) + additions, Number.MAX_SAFE_INTEGER);
      added += additions;
      changed = true;
    }
    if (!before || before.length !== next.length || before.some((noteId, i) => noteId !== next[i])) {
      settings.bookNotes[id] = next;
      changed = true;
    }
    if (!settings.lastOpened[id]) {
      settings.lastOpened[id] = "never";
      changed = true;
    }
  }
  return { changed, books: membership.size, added };
}
