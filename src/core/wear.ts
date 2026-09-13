import type { Book, ShelfView } from "./types";
import { isIsoDay } from "./dates";

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
