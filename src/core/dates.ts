/* ---- date keys -----------------------------------------------------------
 * design/0001
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A date is a string here, never a Date: a Date carries a timezone and a day does not. */
export function isIsoDay(value: string): boolean {
  const m = ISO_DAY.exec(value);
  if (!m) return false;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d;
}

/**
 * The one place a note's day is decided: a configured frontmatter field, then a recognised
 * daily-note title, then whatever creation metadata the host could supply. Anything else is
 * Undated -- decisions/0003 says why guessing is worse than admitting.
 */
export function resolveDate(
  props: Record<string, string>,
  title: string,
  fallback: string | null,
  fields: string[],
): string | null {
  for (const field of fields) {
    const raw = props[field];
    if (!raw) continue;
    const day = raw.trim().slice(0, 10);
    if (isIsoDay(day)) return day;
  }
  const fromTitle = title.trim().slice(0, 10);
  if (isIsoDay(fromTitle)) return fromTitle;
  if (fallback && isIsoDay(fallback.slice(0, 10))) return fallback.slice(0, 10);
  return null;
}

export function yearOf(day: string): string {
  return day.slice(0, 4);
}

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function monthLabel(key: string): string {
  const month = Number(key.slice(5, 7));
  const name = MONTHS[month - 1];
  return (name === undefined ? key.slice(5, 7) : name) + " " + key.slice(0, 4);
}

/**
 * ISO-8601 week: Monday starts it, and the week-year is not always the calendar year --
 * 2027-01-01 is a Friday and belongs to 2026-W53. Books keyed on the calendar year instead
 * would split that week across two shelves, which is the bug this function exists to avoid.
 */
export function isoWeekOf(day: string): string {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)), d = Number(day.slice(8, 10));
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dow + 3);
  const weekYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  const firstDow = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDow + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return weekYear + "-W" + String(week).padStart(2, "0");
}

export function weekLabel(key: string): string {
  return "Week " + key.slice(6) + ", " + key.slice(0, 4);
}

/** The Monday and Sunday of an ISO week key, as ISO days. */
export function weekRange(key: string): { from: string; to: string } {
  const weekYear = Number(key.slice(0, 4)), week = Number(key.slice(6));
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4.getTime() - dow * 86400000 + (week - 1) * 7 * 86400000);
  const sunday = new Date(monday.getTime() + 6 * 86400000);
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}

export function addDays(day: string, n: number): string {
  const y = Number(day.slice(0, 4)), m = Number(day.slice(5, 7)), d = Number(day.slice(8, 10));
  return new Date(Date.UTC(y, m - 1, d) + n * 86400000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000);
}
