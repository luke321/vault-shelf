// github#5 -- one measurement, for the check and the updater

export const VIEWPORT = { width: 1180, height: 900 };

// github#5 -- a plaque's box is text metrics, its packing is not
export const BOX_TOLERANCE = 2;

/* github#5 -- a skipped shelf measures nothing, so scroll it in */
export const MEASURE = `(function(){
  __vs.closeReader();
  var lib = document.getElementById("vs-library");
  var out = { room: __vs.room().width, shelves: [] };
  var shelves = [].slice.call(document.querySelectorAll("#vs-shelves > [data-shelf]"));
  shelves.forEach(function (sh) {
    sh.scrollIntoView(true);
    var top = sh.getBoundingClientRect();
    var box = function (node) {
      var b = node.getBoundingClientRect();
      return { x: Math.round(b.left - top.left), y: Math.round(b.top - top.top),
               w: Math.round(b.width), h: Math.round(b.height) };
    };
    var spines = [].slice.call(sh.querySelectorAll(".vs-spine"));
    var named = function (node, attr) {
      var b = box(node);
      b.name = attr === "text" ? node.textContent : node.getAttribute(attr);
      return b;
    };
    out.shelves.push({
      shelf: sh.getAttribute("data-shelf"),
      rows: sh.querySelectorAll(".vs-track").length,
      books: spines.length,
      plaques: [].slice.call(sh.querySelectorAll(".vs-plaque")).map(function (p) { return named(p, "text"); }),
      first: spines.length ? named(spines[0], "data-book") : null,
      last: spines.length ? named(spines[spines.length - 1], "data-book") : null
    });
  });
  lib.scrollTop = 0;
  return out;
})()`;

/** @param {{ x: number, y: number, w: number, h: number, name: string }|null} a @param {*} b @param {string} where @param {string[]} out */
function diffBox(a, b, where, out) {
  if (!a && !b) return;
  if (!a || !b) { out.push(`${where}: ${a ? "gone from" : "new in"} the page`); return; }
  if (a.name !== b.name) out.push(`${where}: named ${JSON.stringify(b.name)}, golden says ${JSON.stringify(a.name)}`);
  for (const k of ["x", "y", "w", "h"]) {
    if (Math.abs(a[k] - b[k]) > BOX_TOLERANCE) out.push(`${where}: ${k} ${a[k]} -> ${b[k]}`);
  }
}

/** @param {*} golden @param {*} now @returns {string[]} */
export function diffLayout(golden, now) {
  const out = [];
  if (golden.room !== now.room) out.push(`the room is ${now.room}px, golden says ${golden.room}px`);
  const byId = new Map(now.shelves.map((s) => [s.shelf, s]));
  for (const want of golden.shelves) {
    const got = byId.get(want.shelf);
    if (!got) { out.push(`shelf ${want.shelf} is not on the page any more`); continue; }
    byId.delete(want.shelf);
    if (want.rows !== got.rows) out.push(`${want.shelf}: ${got.rows} rows, golden says ${want.rows}`);
    if (want.books !== got.books) out.push(`${want.shelf}: ${got.books} books, golden says ${want.books}`);
    if (want.plaques.length !== got.plaques.length) {
      out.push(`${want.shelf}: ${got.plaques.length} plaques, golden says ${want.plaques.length}`);
    } else {
      want.plaques.forEach((p, i) => diffBox(p, got.plaques[i], `${want.shelf} plaque ${i}`, out));
    }
    diffBox(want.first, got.first, `${want.shelf} first spine`, out);
    diffBox(want.last, got.last, `${want.shelf} last spine`, out);
  }
  for (const extra of byId.keys()) out.push(`shelf ${extra} is on the page and not in the golden`);
  return out;
}
