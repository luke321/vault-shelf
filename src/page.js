/* ===================================================================== types ==
 * The three boundaries of this file, as JSDoc: what comes IN as data and options, and what
 * goes OUT as the __vs api. Comments only -- the exporter inlines this file as text and the
 * plugin bundles it as JavaScript; typescript-eslint reads these through tsconfig.json's
 * allowJs, and plugin/main.js imports them as `import("../src/page.js").X`. Typedefs live at
 * module scope for that reason: one declared inside mountVaultShelf would be local to it.
 */

/**
 * One note, as both producers emit it: src/build-shelf.mjs into the standalone file, and
 * plugin/main.js from Obsidian's metadata cache. src/core/types.ts declares the same shape
 * for the TypeScript side; these two must agree, and check-parity in the suite says so.
 * @typedef {Object} ShelfNote
 * @property {string} id        vault-relative path with "/" separators
 * @property {string} path
 * @property {string} title
 * @property {string} folder    first path segment, or "(vault root)"
 * @property {string|null} date ISO YYYY-MM-DD, or null for Undated
 * @property {string[]} people
 * @property {string[]} tags
 * @property {Record<string,string>} props
 * @property {string} excerpt
 * @property {string} body
 */

/**
 * @typedef {Object} ShelfData
 * @property {string} vault
 * @property {string} generated
 * @property {ShelfNote[]} notes
 * @property {{ path: string, count: number, slot: number }[]} folders
 * @property {{ notes: number, dated: number, people: number, tags: number }} stats
 */

/**
 * THE CORE IS TYPED AS EXACTLY THE MEMBERS THIS FILE CALLS and nothing more -- the module
 * under src/core, handed in rather than imported so the two hosts can bundle it their own
 * way. Anything a future caller needs that is not named here shows up on the no-unsafe
 * meter, which is the point.
 * @typedef {typeof import("./core/index")} ShelfCore
 */

/** @typedef {import("./core/index").Persisted} Persisted */
/** @typedef {import("./core/index").Shelf} Shelf */
/** @typedef {import("./core/index").Book} Book */
/** @typedef {import("./core/index").ShelfView} ShelfView */

/**
 * @typedef {Object} MountOptions
 * @property {ShelfCore} core            the src/core module namespace, from the host
 * @property {unknown} [settings]        persisted settings, migrated on the way in
 * @property {(next: Persisted) => void} [onSettings]
 * @property {(path: string) => void} [onOpenNote]  "Edit in Obsidian", host-supplied
 */

/* ================================================================== palette ==
 * design/0005 -- the twelve slots are Vault Graph's, by name and by value, because a folder
 * that is teal on the disc has to be teal on a spine or the two views describe different
 * vaults.
 */
var SLOTS = [
  "#7fb3c8", "#c8a06a", "#8fbf88", "#c98f8f", "#a89fd0", "#9a8fc9",
  "#c9b06a", "#6fae9c", "#c07fa8", "#8a9fc9", "#b0a37f", "#7fc9b8"
];

var ID = "vs-";

/**
 * Mount the library into `root`. One call, one library; `destroy()` on the returned handle
 * takes everything back off again, including the listeners on the document.
 * @param {HTMLElement} root
 * @param {ShelfData} data
 * @param {MountOptions} [options]
 */
function mountVaultShelf(root, data, options) {
  var opts = options || /** @type {MountOptions} */ ({});
  var core = opts.core;
  if (!core) throw new Error("vault-shelf: mountVaultShelf needs options.core");

  var DOC = root.ownerDocument;
  var WIN = DOC.defaultView;
  var $ = function (id) { return root.querySelector("#" + ID + id); };
  /** @type {(() => void)[]} */
  var onDestroy = [];
  var API = null;

  /**
   * Swallow and return, so a teardown step that fails does not strand the rest.
   * @param {() => void} fn
   * @returns {unknown}
   */
  function attempt(fn) {
    try { fn(); return null; } catch (e) { return e; }
  }

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListener} fn
   * @param {boolean} [capture]
   */
  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, capture);
    onDestroy.push(function () { target.removeEventListener(type, fn, capture); });
  }

  /**
   * @param {string} tag
   * @param {string} [className]
   * @param {string|number} [text]
   * @returns {HTMLElement}
   */
  function el(tag, className, text) {
    var node = DOC.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  /** @param {Element} node */
  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /**
   * @param {string} id
   * @returns {HTMLElement}
   */
  function node(id) {
    return /** @type {HTMLElement} */ ($(id));
  }

  /**
   * The one place a value is read back off a form control. `$` hands back an Element, which
   * has no `.value` and no `.checked`; casting once here beats casting at thirty call sites.
   * @param {string} id
   * @returns {HTMLInputElement}
   */
  function field(id) {
    return /** @type {HTMLInputElement} */ ($(id));
  }

  /**
   * @param {string[][]} lists
   * @returns {string[]}
   */
  function flat(lists) {
    /** @type {string[]} */
    var out = [];
    lists.forEach(function (list) { list.forEach(function (v) { out.push(v); }); });
    return out;
  }

  /**
   * @param {string[]} values
   * @returns {string[]}
   */
  function uniqueSorted(values) {
    /** @type {Record<string, boolean>} */
    var seen = {};
    /** @type {string[]} */
    var out = [];
    values.forEach(function (v) { if (!seen[v]) { seen[v] = true; out.push(v); } });
    return out.sort();
  }

  /* ================================================================== state == */

  var settings = core.migrate(opts.settings || null);
  var notes = data.notes.slice();
  var folders = data.folders.slice();
  /** @type {Record<string, string>} */
  var slotOf = {};
  folders.forEach(function (f) { slotOf[f.path] = SLOTS[f.slot % SLOTS.length]; });

  /** @type {import("./core/index").Filters} */
  var filters = { search: "", folders: [], from: null, to: null };
  /** @type {ShelfView[]} */
  var views = [];
  /** @type {{ book: Book, index: number, noteId: string|null, within: string, opener: HTMLElement|null }|null} */
  var reader = null;
  /** @type {{ bookId: string, noteId: string|null }[]} */
  var history = [];
  /** @type {{ editing: string|null, draft: Shelf }|null} */
  var builder = null;
  /** @type {string|null} */
  var calYear = null;

  var reduceMotion = WIN.matchMedia
    ? WIN.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  function persist() {
    if (opts.onSettings) opts.onSettings(core.clone(settings));
  }

  /* =============================================================== membership ==
   * design/0002 -- one pass over the filtered notes per shelf, and the shelf order is the
   * saved position. A hidden shelf is still built: it holds a reading place, and "also
   * shelved in" has to know it exists before deciding not to offer it.
   */
  function rebuild() {
    var visible = core.applyFilters(notes, filters);
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    views = ordered.map(function (shelf) {
      var view = core.buildShelf(shelf, visible);
      view.books.forEach(function (book) {
        book.bands.forEach(function (band) { band.slot = slotOf[band.folder] || "#6f6c66"; });
      });
      return view;
    });
  }

  /* ==================================================================== chrome == */

  function renderDirectory() {
    $("vname").textContent = data.vault || "Vault Shelf";
    $("skin").textContent = settings.skin === "paper" ? "Graphite" : "Paper";

    var list = $("shelflist");
    clear(list);
    var shown = 0;
    views.forEach(function (view) {
      if (view.shelf.hidden) return;
      shown++;
      var b = el("button", "shelflink");
      b.type = "button";
      b.setAttribute("data-shelf", view.shelf.id);
      b.appendChild(el("span", "name", view.shelf.name));
      b.appendChild(el("span", "count", view.books.length + " / " + view.noteCount));
      on(b, "click", function () { scrollToShelf(view.shelf.id); });
      list.appendChild(b);
    });
    $("shelfcount").textContent = shown + " of " + views.length;

    renderFolders();
    renderCalendar();
    renderReading();
  }

  function renderFolders() {
    var box = $("folders");
    clear(box);
    folders.forEach(function (f) {
      var b = el("button", "folderrow");
      b.type = "button";
      var pressed = filters.folders.indexOf(f.path) >= 0;
      b.setAttribute("aria-pressed", pressed ? "true" : "false");
      var sw = el("span", "swatch");
      sw.style.setProperty("--slot", slotOf[f.path]);
      b.appendChild(sw);
      b.appendChild(el("span", "name", f.path));
      b.appendChild(el("span", "count", String(f.count)));
      on(b, "click", function () {
        var i = filters.folders.indexOf(f.path);
        if (i >= 0) filters.folders.splice(i, 1); else filters.folders.push(f.path);
        refresh();
      });
      box.appendChild(b);
    });
  }

  /**
   * The activity calendar is the year's own days, seven rows of a week each, so a gap in
   * the vault is a gap on screen rather than a number nobody reads.
   */
  function renderCalendar() {
    var years = {};
    notes.forEach(function (n) { if (n.date) years[n.date.slice(0, 4)] = true; });
    var list = Object.keys(years).sort().reverse();
    if (calYear === null || list.indexOf(calYear) < 0) calYear = list[0] || null;

    var bar = $("years");
    clear(bar);
    list.forEach(function (y) {
      var b = el("button", "", y);
      b.type = "button";
      b.setAttribute("aria-pressed", y === calYear ? "true" : "false");
      on(b, "click", function () { calYear = y; renderCalendar(); });
      bar.appendChild(b);
    });

    var grid = $("calendar");
    clear(grid);
    if (!calYear) return;

    /** @type {Record<string, number>} */
    var counts = {};
    notes.forEach(function (n) {
      if (n.date && n.date.slice(0, 4) === calYear) counts[n.date] = (counts[n.date] || 0) + 1;
    });

    var day = calYear + "-01-01";
    var end = calYear + "-12-31";
    var lead = new Date(day + "T00:00:00Z").getUTCDay();
    lead = (lead + 6) % 7;
    for (var i = 0; i < lead; i++) grid.appendChild(el("span", "day"));

    while (day <= end) {
      var n = counts[day] || 0;
      var cell = el("button", "day");
      cell.type = "button";
      cell.setAttribute("data-level", n === 0 ? "0" : n === 1 ? "1" : n <= 3 ? "2" : n <= 6 ? "3" : "4");
      cell.setAttribute("data-day", day);
      cell.title = day + " -- " + n + (n === 1 ? " note" : " notes");
      cell.setAttribute("aria-label", cell.title);
      (function (d) {
        on(cell, "click", function () {
          if (filters.from === d && filters.to === d) { filters.from = null; filters.to = null; }
          else { filters.from = d; filters.to = d; }
          refresh();
        });
      })(day);
      grid.appendChild(cell);
      day = core.addDays(day, 1);
    }
  }

  function renderReading() {
    var box = $("reading");
    clear(box);
    if (!settings.reading.length) {
      box.appendChild(el("p", "hint", "Nothing saved yet. The bookmark in a book puts a note here."));
      return;
    }
    settings.reading.slice().sort(function (a, b) { return b.at - a.at; }).forEach(function (mark) {
      var note = noteById(mark.noteId);
      if (!note) return;
      var book = core.resolveReading(mark.noteId, mark.bookId, views);
      var b = el("button", "readingrow");
      b.type = "button";
      b.appendChild(el("span", "name", note.title));
      b.appendChild(el("span", "where", book ? book.label : "no shelf holds it"));
      b.disabled = !book;
      on(b, "click", function () { if (book) openBook(book, mark.noteId); });
      box.appendChild(b);
    });
  }

  /** @param {string} id @returns {ShelfNote|null} */
  function noteById(id) {
    for (var i = 0; i < notes.length; i++) if (notes[i].id === id) return notes[i];
    return null;
  }

  /* ================================================================= library == */

  function renderLibrary() {
    var box = $("shelves");
    clear(box);
    var anyVisible = false;

    views.forEach(function (view) {
      if (view.shelf.hidden) return;
      anyVisible = true;
      box.appendChild(renderShelf(view));
    });

    if (!anyVisible) {
      var card = el("div", "endcard");
      card.appendChild(el("p", "", "Every shelf is hidden. Nothing was deleted -- Manage " +
                                   "shelves brings them back."));
      var restore = el("button", "primary", "Show every shelf");
      restore.type = "button";
      on(restore, "click", function () {
        settings.shelves.forEach(function (s) { s.hidden = false; });
        persist();
        refresh();
      });
      card.appendChild(restore);
      box.appendChild(card);
    }

    var filtered = core.applyFilters(notes, filters).length;
    $("endtext").textContent = anyVisible
      ? "That is the whole library -- " + filtered + " of " + notes.length + " notes on " +
        views.filter(function (v) { return !v.shelf.hidden; }).length + " shelves."
      : "";
  }

  /** @param {ShelfView} view @returns {HTMLElement} */
  function renderShelf(view) {
    var wrap = el("section", "shelf");
    wrap.setAttribute("data-shelf", view.shelf.id);

    var head = el("header", "shelfhead");
    head.appendChild(el("h2", "", view.shelf.name));
    head.appendChild(el("span", "meta",
      view.books.length + (view.books.length === 1 ? " book" : " books") + " \u00b7 " +
      view.noteCount + (view.noteCount === 1 ? " note" : " notes")));
    var menu = el("div", "mini");
    var edit = el("button", "", "Edit");
    edit.type = "button";
    on(edit, "click", function () { openBuilder(view.shelf); });
    var hide = el("button", "", "Hide");
    hide.type = "button";
    on(hide, "click", function () {
      view.shelf.hidden = true;
      persist();
      refresh();
    });
    menu.appendChild(edit);
    menu.appendChild(hide);
    head.appendChild(menu);
    wrap.appendChild(head);

    var rail = el("div", "shelfrail");
    rail.appendChild(renderTrack(view.books, view.shelf));
    wrap.appendChild(rail);
    return wrap;
  }

  /**
   * design/0003 -- the plaque sits in the SAME horizontal scroller as the books it names, so
   * the two cannot drift apart while the rail scrolls. A shelf with no plaques renders one
   * anonymous group, which keeps the DOM shape identical in both cases.
   */
  /** @param {Book[]} books @param {Shelf} shelf @returns {HTMLElement} */
  function renderTrack(books, shelf) {
    var track = el("div", "track");
    /** @type {{ plaque: string|null, books: Book[] }[]} */
    var groups = [];
    /** @type {Record<string, { plaque: string|null, books: Book[] }>} */
    var byPlaque = {};
    books.forEach(function (book) {
      var key = book.plaque === null ? "" : book.plaque;
      if (!byPlaque[key]) { byPlaque[key] = { plaque: book.plaque, books: [] }; groups.push(byPlaque[key]); }
      byPlaque[key].books.push(book);
    });

    groups.forEach(function (group) {
      var g = el("div", "group");
      var row = el("div", "books");
      group.books.forEach(function (book) { row.appendChild(renderSpine(book, shelf)); });
      g.appendChild(row);
      if (group.plaque !== null) g.appendChild(el("div", "plaque", group.plaque));
      track.appendChild(g);
    });
    return track;
  }

  /** @param {Book} book @param {Shelf} shelf @returns {HTMLElement} */
  function renderSpine(book, shelf) {
    var b = el("button", "spine");
    b.type = "button";
    b.setAttribute("data-book", book.id);
    if (!book.notes.length) b.setAttribute("data-empty", "1");

    var band = el("span", "band");
    var total = book.bands.slice(0, 3).reduce(function (n, part) { return n + part.count; }, 0) || 1;
    book.bands.slice(0, 3).forEach(function (part) {
      var i = el("i");
      i.style.width = (100 * part.count / total) + "%";
      i.style.setProperty("--slot", part.slot);
      band.appendChild(i);
    });
    b.appendChild(band);
    /* design/0005 -- the board takes 14% of its dominant folder's colour. Enough that a shelf
     * reads as books rather than slats; little enough that the band at the head is still the
     * thing carrying the information. */
    if (book.bands.length) b.style.setProperty("--spine-tint", book.bands[0].slot);
    b.appendChild(el("span", "title", book.label));
    b.appendChild(el("span", "n", String(book.notes.length)));

    var peek = book.label + " -- " + book.notes.length +
      (book.notes.length === 1 ? " note" : " notes");
    if (book.bands.length) {
      peek += " \u00b7 " + book.bands.slice(0, 3).map(function (p) {
        return p.folder + " " + p.count;
      }).join(", ");
    }
    if (book.notes.length) {
      peek += "\n" + book.notes.slice(0, 3).map(function (n) { return n.title; }).join("\n");
    }
    b.title = peek;
    b.setAttribute("aria-label", shelf.name + ": " + peek.split("\n")[0]);

    on(b, "click", function () { openBook(book, null); });
    return b;
  }

  /** @param {string} id */
  function scrollToShelf(id) {
    var found = $("shelves").querySelector('[data-shelf="' + cssEscape(id) + '"]');
    if (found) {
      if (reduceMotion) found.scrollIntoView(true);
      else found.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /** @param {string} value @returns {string} */
  function cssEscape(value) {
    return String(value).replace(/["\\]/g, "\\$&");
  }

  /* ================================================================== reader ==
   * design/0004 -- the shelf keeps its scroll position while a book is open, because the
   * reader is an overlay rather than a route. Escape puts focus back on the spine.
   */
  /** @param {Book} book @param {string|null} noteId */
  function openBook(book, noteId) {
    if (reader && reader.book.id !== book.id) {
      history.push({ bookId: reader.book.id, noteId: reader.noteId });
    }
    var index = 0;
    if (noteId) {
      for (var i = 0; i < book.notes.length; i++) if (book.notes[i].id === noteId) index = i;
    }
    reader = { book: book, index: index, noteId: book.notes.length ? book.notes[index].id : null,
               within: "", opener: /** @type {HTMLElement|null} */ (DOC.activeElement) };
    $("reader").hidden = false;
    renderReader();
    node("reader").focus();
  }

  function closeReader() {
    if (!reader) return;
    var opener = reader.opener;
    reader = null;
    history.length = 0;
    $("reader").hidden = true;
    if (opener && root.contains(opener)) opener.focus();
    else node("library").focus();
  }

  function renderReader() {
    if (!reader) return;
    var book = reader.book;
    var shelf = shelfById(book.shelfId);
    $("readertitle").textContent = (shelf ? shelf.name + " \u00b7 " : "") + book.label;
    $("bookname").textContent = book.label;
    $("bookmeta").textContent = book.notes.length +
      (book.notes.length === 1 ? " note" : " notes") +
      (book.bands.length ? " \u00b7 " + book.bands.length + " source folders" : "");
    $("prevcollection").disabled = !history.length;

    renderContents();
    renderTabs();
    renderNote();
  }

  function renderContents() {
    var box = $("contents");
    clear(box);
    var needle = reader.within.trim().toLowerCase();
    reader.book.notes.forEach(function (note, i) {
      if (needle && note.title.toLowerCase().indexOf(needle) < 0) return;
      var li = el("li");
      var b = el("button");
      b.type = "button";
      if (note.id === reader.noteId) b.setAttribute("aria-current", "true");
      b.appendChild(el("span", "t", note.title));
      if (note.date) b.appendChild(el("span", "when", note.date));
      on(b, "click", function () { goTo(i); });
      li.appendChild(b);
      box.appendChild(li);
    });
    if (!box.firstChild) {
      var empty = el("li");
      empty.appendChild(el("span", "hint", needle ? "Nothing in this book matches." : "This book is empty."));
      box.appendChild(empty);
    }
  }

  /**
   * The index tabs are the book's own shape: months for a year, days for a month or a week,
   * initial ranges for anything alphabetical. A vault with thousands of entries gets ranges
   * rather than thousands of tabs -- a tab you cannot hit is decoration.
   */
  /** @param {Book} book @returns {{ label: string, at: number }[]} */
  function indexSections(book) {
    var shelf = shelfById(book.shelfId);
    var kind = shelf ? shelf.classifier : "initial";
    /** @type {{ label: string, at: number }[]} */
    var out = [];
    /** @type {Record<string, number>} */
    var seen = {};
    if (kind === "year") {
      book.notes.forEach(function (n, i) {
        if (!n.date) return;
        var key = n.date.slice(0, 7);
        if (seen[key] === undefined) { seen[key] = i; out.push({ label: core.monthLabel(key).slice(0, 3), at: i }); }
      });
    } else if (kind === "month" || kind === "week") {
      book.notes.forEach(function (n, i) {
        if (!n.date) return;
        var key = n.date;
        if (seen[key] === undefined) { seen[key] = i; out.push({ label: key.slice(8), at: i }); }
      });
    } else {
      book.notes.forEach(function (n, i) {
        var key = core.firstLetter(n.title);
        if (seen[key] === undefined) { seen[key] = i; out.push({ label: key, at: i }); }
      });
    }
    if (out.length <= 26) return out;
    /** @type {{ label: string, at: number }[]} */
    var parts = [];
    var per = Math.ceil(out.length / 12);
    for (var i = 0; i < out.length; i += per) {
      parts.push({ label: out[i].label + "\u2013" + out[Math.min(i + per, out.length) - 1].label,
                   at: out[i].at });
    }
    return parts;
  }

  function renderTabs() {
    var box = $("tabs");
    clear(box);
    indexSections(reader.book).forEach(function (section) {
      var b = el("button", "", section.label);
      b.type = "button";
      if (section.at <= reader.index) b.setAttribute("aria-current", "true");
      on(b, "click", function () { goTo(section.at); });
      box.appendChild(b);
    });
  }

  function renderNote() {
    var box = $("note");
    clear(box);
    var note = reader.book.notes[reader.index];
    if (!note) {
      box.appendChild(el("p", "hint", "This book has no notes under the current filters."));
      clear($("alsoin"));
      $("ribbon").disabled = true;
      return;
    }
    reader.noteId = note.id;
    $("ribbon").disabled = false;
    $("ribbon").setAttribute("aria-pressed", isBookmarked(note.id) ? "true" : "false");
    $("prevnote").disabled = reader.index <= 0;
    $("nextnote").disabled = reader.index >= reader.book.notes.length - 1;

    renderMarkdownInto(box, note);

    var also = $("alsoin");
    clear(also);
    var others = core.alsoShelvedIn(note.id, views, reader.book.id);
    if (!others.length) return;
    also.appendChild(el("span", "lbl", "Also shelved in"));
    others.slice(0, 8).forEach(function (other) {
      var shelf = shelfById(other.shelfId);
      var b = el("button", "", (shelf ? shelf.name + ": " : "") + other.label);
      b.type = "button";
      on(b, "click", function () { openBook(other, note.id); });
      also.appendChild(b);
    });
  }

  /**
   * Markdown, rendered as elements rather than assembled as a string: the note body is the
   * user's own text, and building HTML out of it is how a vault ends up executing itself.
   * The host can hand in a real renderer through options.renderMarkdown; this is the
   * standalone's fallback and covers headings, lists, quotes and paragraphs.
   */
  /** @param {HTMLElement} box @param {ShelfNote} note */
  function renderMarkdownInto(box, note) {
    box.appendChild(el("h1", "", note.title));
    /** @type {string[]} */
    var meta = [];
    if (note.date) meta.push(note.date);
    if (note.folder) meta.push(note.folder);
    if (note.people.length) meta.push(note.people.join(", "));
    if (note.tags.length) meta.push(note.tags.map(function (t) { return "#" + t; }).join(" "));
    if (meta.length) box.appendChild(el("p", "hint", meta.join(" \u00b7 ")));

    var lines = String(note.body || note.excerpt || "").split("\n");
    /** @type {HTMLElement|null} */
    var list = null;
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      var head = /^(#{1,3})\s+(.*)$/.exec(line);
      var item = /^\s*[-*]\s+(.*)$/.exec(line);
      var quote = /^>\s?(.*)$/.exec(line);
      if (!item && list) list = null;
      if (head) { box.appendChild(el("h" + (head[1].length + 1), "", head[2])); return; }
      if (item) {
        var into = list;
        if (!into) { into = el("ul"); box.appendChild(into); list = into; }
        into.appendChild(el("li", "", item[1]));
        return;
      }
      if (quote) { box.appendChild(el("blockquote", "", quote[1])); return; }
      if (line.trim()) box.appendChild(el("p", "", line));
    });

    if (opts.onOpenNote) {
      var open = /** @type {HTMLButtonElement} */ (el("button", "", "Edit in Obsidian"));
      open.type = "button";
      var openNote = opts.onOpenNote;
      on(open, "click", function () { openNote(note.path); });
      box.appendChild(open);
    }
  }

  /** @param {number} index */
  function goTo(index) {
    if (!reader) return;
    reader.index = Math.max(0, Math.min(index, reader.book.notes.length - 1));
    renderContents();
    renderTabs();
    renderNote();
  }

  /** @param {string} id @returns {Shelf|null} */
  function shelfById(id) {
    for (var i = 0; i < settings.shelves.length; i++) {
      if (settings.shelves[i].id === id) return settings.shelves[i];
    }
    return null;
  }

  /** @param {string} noteId @returns {boolean} */
  function isBookmarked(noteId) {
    return settings.reading.some(function (m) { return m.noteId === noteId; });
  }

  function toggleBookmark() {
    if (!reader) return;
    var note = reader.book.notes[reader.index];
    if (!note) return;
    var i = -1;
    settings.reading.forEach(function (m, k) { if (m.noteId === note.id) i = k; });
    if (i >= 0) settings.reading.splice(i, 1);
    else settings.reading.push({ noteId: note.id, shelfId: reader.book.shelfId,
                                 bookId: reader.book.id, at: Date.now() });
    persist();
    $("ribbon").setAttribute("aria-pressed", isBookmarked(note.id) ? "true" : "false");
    renderReading();
  }

  function previousCollection() {
    var last = history.pop();
    if (!last) return;
    var book = findBook(last.bookId);
    if (!book) return;
    reader = { book: book, index: 0, noteId: last.noteId, within: "", opener: reader ? reader.opener : null };
    if (last.noteId) {
      for (var i = 0; i < book.notes.length; i++) if (book.notes[i].id === last.noteId) reader.index = i;
    }
    renderReader();
  }

  /** @param {string} id @returns {Book|null} */
  function findBook(id) {
    for (var i = 0; i < views.length; i++) {
      for (var k = 0; k < views[i].books.length; k++) {
        if (views[i].books[k].id === id) return views[i].books[k];
      }
    }
    return null;
  }

  /* ================================================================= builder ==
   * design/0002 -- two questions, and the preview answers them with the real numbers before
   * anything is saved. A builder that previews a guess is worse than one that previews
   * nothing, so this runs the same core.buildShelf the library runs.
   */
  /** @param {Shelf|null} existing */
  function openBuilder(existing) {
    builder = existing
      ? { editing: existing.id, draft: core.clone(existing) }
      : { editing: null, draft: {
          id: "", name: "New shelf", source: { kind: "all" }, classifier: "initial",
          direction: "alphabetical", hidden: false, position: settings.shelves.length,
          plaques: false, includeSubtags: true
        } };

    $("buildertitle").textContent = existing ? "Edit shelf" : "New shelf";
    $("bsave").textContent = existing ? "Save changes" : "Save shelf";
    fillSourceValues();
    fillProperties();
    fillRecipes();
    writeBuilderFields();
    $("builder").hidden = false;
    node("bname").focus();
    previewBuilder();
  }

  function closeBuilder() {
    builder = null;
    $("builder").hidden = true;
    node("library").focus();
  }

  function writeBuilderFields() {
    var d = builder.draft;
    field("bname").value = d.name;
    field("bsource").value = d.source.kind;
    $("bsourceval").hidden = d.source.kind === "all";
    if (d.source.value) field("bsourceval").value = d.source.value;
    field("bclassifier").value = d.classifier;
    $("bproperty").hidden = d.classifier !== "property";
    if (d.property) field("bproperty").value = d.property;
    field("bdirection").value = d.direction;
    field("bplaques").checked = !!d.plaques;
    field("bplaques").disabled = d.classifier !== "month" && d.classifier !== "week";
    field("bsubtags").checked = d.includeSubtags !== false;
    field("bsubtags").disabled = d.classifier !== "tag" && d.source.kind !== "tag";
  }

  function readBuilderFields() {
    var d = builder.draft;
    d.name = field("bname").value.trim() || "Untitled shelf";
    d.source = { kind: /** @type {import("./core/index").SourceKind} */ (field("bsource").value) };
    if (d.source.kind !== "all") {
      fillSourceValues();
      d.source.value = field("bsourceval").value;
    }
    d.classifier = /** @type {import("./core/index").ClassifierKind} */ (field("bclassifier").value);
    if (d.classifier === "property") {
      fillProperties();
      d.property = field("bproperty").value;
    }
    d.direction = field("bdirection").value === "chronological" ? "chronological" : "alphabetical";
    d.plaques = (d.classifier === "month" || d.classifier === "week") && field("bplaques").checked;
    d.includeSubtags = field("bsubtags").checked;
    writeBuilderFields();
  }

  function fillSourceValues() {
    var kind = field("bsource").value;
    var select = field("bsourceval");
    var chosen = builder && builder.draft.source ? builder.draft.source.value : "";
    /** @type {string[]} */
    var values = [];
    if (kind === "tag") values = uniqueSorted(flat(notes.map(function (n) { return n.tags; })));
    if (kind === "person") values = uniqueSorted(flat(notes.map(function (n) { return n.people; })));
    if (kind === "folder") values = folders.map(function (f) { return f.path; });
    clear(select);
    values.forEach(function (v) {
      var o = DOC.createElement("option");
      o.value = v;
      o.textContent = kind === "tag" ? "#" + v : v;
      select.appendChild(o);
    });
    if (chosen && values.indexOf(chosen) >= 0) select.value = chosen;
  }

  function fillProperties() {
    var select = field("bproperty");
    var chosen = builder ? builder.draft.property : "";
    /** @type {Record<string, number>} */
    var counts = {};
    notes.forEach(function (n) {
      Object.keys(n.props).forEach(function (k) { counts[k] = (counts[k] || 0) + 1; });
    });
    var names = Object.keys(counts).sort();
    clear(select);
    names.forEach(function (name) {
      var o = DOC.createElement("option");
      o.value = name;
      o.textContent = name + " (" + counts[name] + ")";
      select.appendChild(o);
    });
    if (chosen && names.indexOf(chosen) >= 0) select.value = chosen;
  }

  function fillRecipes() {
    var box = $("recipes");
    clear(box);
    core.recipes().forEach(function (recipe) {
      var b = el("button", "", recipe.name);
      b.type = "button";
      b.title = recipe.blurb;
      on(b, "click", function () {
        var keep = builder.draft.id;
        builder.draft = core.clone(recipe.shelf);
        builder.draft.id = keep;
        builder.draft.position = settings.shelves.length;
        writeBuilderFields();
        previewBuilder();
      });
      box.appendChild(b);
    });
  }

  function previewBuilder() {
    if (!builder) return;
    var draft = core.clone(builder.draft);
    draft.id = draft.id || "preview";
    var view = core.buildShelf(draft, core.applyFilters(notes, filters));
    view.books.forEach(function (book) {
      book.bands.forEach(function (band) { band.slot = slotOf[band.folder] || "#6f6c66"; });
    });
    var plaques = view.books.filter(function (b) { return b.plaque !== null; }).length;
    $("previewcount").textContent =
      view.noteCount + (view.noteCount === 1 ? " note" : " notes") + " \u00b7 " +
      view.books.length + (view.books.length === 1 ? " book" : " books") +
      (draft.plaques ? " \u00b7 " + plaques + " under year plaques" : "");
    var box = $("preview");
    clear(box);
    box.appendChild(renderTrack(view.books.slice(0, 60), draft));
  }

  function saveBuilder() {
    readBuilderFields();
    var draft = builder.draft;
    if (builder.editing) {
      var i = -1;
      settings.shelves.forEach(function (s, k) { if (s.id === builder.editing) i = k; });
      if (i >= 0) settings.shelves[i] = draft;
    } else {
      draft.id = uniqueId(core.slug(draft.name));
      draft.position = settings.shelves.length;
      settings.shelves.push(draft);
    }
    persist();
    closeBuilder();
    refresh();
  }

  /** @param {string} base @returns {string} */
  function uniqueId(base) {
    var id = base, n = 2;
    while (shelfById(id)) { id = base + "-" + n; n++; }
    return id;
  }

  /* ================================================================== manage == */

  function openManage() {
    renderManage();
    $("manage").hidden = false;
    node("mclose").focus();
  }

  function renderManage() {
    var box = $("managelist");
    clear(box);
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    ordered.forEach(function (shelf, i) {
      var row = el("div", "managerow");
      row.appendChild(el("span", "name", shelf.name));
      row.appendChild(el("span", "meta", shelf.classifier + (shelf.hidden ? " \u00b7 hidden" : "")));

      var up = el("button", "", "\u2191");
      up.type = "button";
      up.title = "Move up";
      up.setAttribute("aria-label", "Move " + shelf.name + " up");
      up.disabled = i === 0;
      on(up, "click", function () { reorder(shelf.id, -1); });

      var down = el("button", "", "\u2193");
      down.type = "button";
      down.title = "Move down";
      down.setAttribute("aria-label", "Move " + shelf.name + " down");
      down.disabled = i === ordered.length - 1;
      on(down, "click", function () { reorder(shelf.id, 1); });

      var vis = el("button", "", shelf.hidden ? "Show" : "Hide");
      vis.type = "button";
      on(vis, "click", function () {
        shelf.hidden = !shelf.hidden;
        persist();
        renderManage();
        refresh();
      });

      var edit = el("button", "", "Edit");
      edit.type = "button";
      on(edit, "click", function () { $("manage").hidden = true; openBuilder(shelf); });

      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(vis);
      row.appendChild(edit);
      box.appendChild(row);
    });
  }

  /** @param {string} id @param {number} delta */
  function reorder(id, delta) {
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    var i = -1;
    ordered.forEach(function (s, k) { if (s.id === id) i = k; });
    var target = i + delta;
    if (i < 0 || target < 0 || target >= ordered.length) return;
    var moved = ordered.splice(i, 1)[0];
    ordered.splice(target, 0, moved);
    ordered.forEach(function (s, k) { s.position = k; });
    persist();
    renderManage();
    refresh();
  }

  /* ================================================================= filters == */

  function renderActiveFilters() {
    var parts = [];
    if (filters.search) parts.push('search "' + filters.search + '"');
    if (filters.folders.length) parts.push(filters.folders.length + " folder" +
      (filters.folders.length === 1 ? "" : "s"));
    if (filters.from || filters.to) parts.push((filters.from || "\u2026") + " to " + (filters.to || "\u2026"));
    var bar = $("activefilters");
    bar.hidden = !parts.length;
    $("filtertext").textContent = parts.length
      ? "Filtered by " + parts.join(", ") + " \u2014 " +
        core.applyFilters(notes, filters).length + " of " + notes.length + " notes"
      : "";
    $("hits").textContent = filters.search
      ? core.applyFilters(notes, filters).length + " notes match"
      : "";
  }

  function clearFilters() {
    filters = { search: "", folders: [], from: null, to: null };
    field("q").value = "";
    refresh();
  }

  /* ================================================================= refresh == */

  function refresh() {
    rebuild();
    renderDirectory();
    renderLibrary();
    renderActiveFilters();
    if (builder) previewBuilder();
    if (reader) {
      var again = findBook(reader.book.id);
      if (again) {
        reader.book = again;
        reader.index = Math.min(reader.index, Math.max(0, again.notes.length - 1));
        renderReader();
      } else {
        closeReader();
      }
    }
  }

  /* ============================================================ the wiring == */

  on($("q"), "input", function () {
    filters.search = field("q").value;
    refresh();
  });
  on($("folderclear"), "click", clearFilters);
  on($("clearfilters"), "click", clearFilters);
  on($("newshelf"), "click", function () { openBuilder(null); });
  on($("newshelf2"), "click", function () { openBuilder(null); });
  on($("manageopen"), "click", openManage);
  on($("mclose"), "click", function () { $("manage").hidden = true; node("library").focus(); });
  on($("mrestore"), "click", function () {
    settings.shelves.forEach(function (s) { s.hidden = false; });
    persist();
    renderManage();
    refresh();
  });
  on($("skin"), "click", function () {
    settings.skin = settings.skin === "paper" ? "graphite" : "paper";
    root.setAttribute("data-skin", settings.skin);
    $("skin").textContent = settings.skin === "paper" ? "Graphite" : "Paper";
    persist();
  });

  on($("bsave"), "click", saveBuilder);
  on($("bcancel"), "click", closeBuilder);
  ["bname", "bsource", "bsourceval", "bclassifier", "bproperty", "bdirection",
   "bplaques", "bsubtags"].forEach(function (id) {
    on($(id), "change", function () { readBuilderFields(); previewBuilder(); });
    on($(id), "input", function () { readBuilderFields(); previewBuilder(); });
  });

  on($("back"), "click", closeReader);
  on($("prevcollection"), "click", previousCollection);
  on($("prevnote"), "click", function () { goTo(reader.index - 1); });
  on($("nextnote"), "click", function () { goTo(reader.index + 1); });
  on($("ribbon"), "click", toggleBookmark);
  on($("within"), "input", function () {
    reader.within = field("within").value;
    renderContents();
  });

  /* Global keys go on the OWNING document, not `document`: in a popout window those are two
   * different objects, and check-scope refuses the second one for exactly that reason. */
  on(DOC, "keydown", function (e) {
    if (e.key === "Escape") {
      if (!$("builder").hidden) { closeBuilder(); return; }
      if (!$("manage").hidden) { $("manage").hidden = true; node("library").focus(); return; }
      if (reader) closeReader();
      return;
    }
    if (!reader) return;
    if (e.altKey && e.key === "ArrowLeft") { previousCollection(); e.preventDefault(); return; }
    if (e.key === "ArrowLeft") { goTo(reader.index - 1); e.preventDefault(); }
    if (e.key === "ArrowRight") { goTo(reader.index + 1); e.preventDefault(); }
  });

  root.setAttribute("data-skin", settings.skin);
  refresh();

  /* ---- BEGIN: debug api -- stripped from the plugin build, see scripts/build-plugin.mjs (stripDebug) ---- */
  API = {
    version: 1,
    data: function () { return data; },
    views: function () { return views; },
    settings: function () { return settings; },
    filters: function () { return filters; },
    reader: function () { return reader ? { book: reader.book.id, index: reader.index, note: reader.noteId } : null; },
    /** @param {Partial<import("./core/index").Filters>} next */
    setFilters: function (next) { filters = Object.assign(filters, next); refresh(); },
    /** @param {string} bookId @param {string} [noteId] */
    openBook: function (bookId, noteId) {
      var book = findBook(bookId);
      if (book) openBook(book, noteId || null);
      return !!book;
    },
    closeReader: closeReader,
    /** @param {string} skin */
    setSkin: function (skin) {
      settings.skin = skin === "paper" ? "paper" : "graphite";
      root.setAttribute("data-skin", settings.skin);
      persist();
    },
    /** @param {boolean} on_ */
    setListMode: function (on_) {
      if (on_) root.setAttribute("data-list", "1"); else root.removeAttribute("data-list");
    },
    /** @param {Shelf} shelf */
    addShelf: function (shelf) {
      settings.shelves.push(Object.assign({ position: settings.shelves.length }, shelf));
      persist();
      refresh();
    },
    /**
     * The membership law, checked from the page rather than argued about: every note a
     * shelf's predicate admits appears in at least one of its books, and the shelf's note
     * count is the number of UNIQUE notes, not the sum of the books.
     */
    checkMembership: function () {
      /** @type {{ shelf: string, unique: number, claimed: number, sum: number, ok: boolean }[]} */
      var report = [];
      views.forEach(function (view) {
        /** @type {Record<string, boolean>} */
        /** @type {Record<string, boolean>} */
        var seen = {};
        var sum = 0;
        view.books.forEach(function (book) {
          sum += book.notes.length;
          book.notes.forEach(function (n) { seen[n.id] = true; });
        });
        report.push({
          shelf: view.shelf.id,
          unique: Object.keys(seen).length,
          claimed: view.noteCount,
          sum: sum,
          ok: Object.keys(seen).length === view.noteCount
        });
      });
      return report;
    },
    /** Every book's address, so a check can assert they are stable across a rebuild. */
    addresses: function () {
      /** @type {string[]} */
      var out = [];
      views.forEach(function (view) {
        view.books.forEach(function (book) { out.push(book.id); });
      });
      return out;
    },
    counts: function () {
      return {
        notes: notes.length,
        filtered: core.applyFilters(notes, filters).length,
        shelves: views.length,
        visible: views.filter(function (v) { return !v.shelf.hidden; }).length,
        books: views.reduce(function (n, v) { return n + v.books.length; }, 0),
        spines: root.querySelectorAll("#" + ID + "shelves .spine").length,
        plaques: root.querySelectorAll("#" + ID + "shelves .plaque").length
      };
    }
  };
  window.__vs = API;
  /* ---- END: debug api ---- */

  return {
    /** @param {ShelfData} [next] */
    refresh: function (next) {
      if (next) {
        data = next;
        notes = next.notes.slice();
        folders = next.folders.slice();
        slotOf = {};
        folders.forEach(function (f) { slotOf[f.path] = SLOTS[f.slot % SLOTS.length]; });
      }
      refresh();
    },
    /** @param {unknown} next */
    setSettings: function (next) {
      settings = core.migrate(next);
      root.setAttribute("data-skin", settings.skin);
      refresh();
    },
    destroy: function () {
      for (var i = onDestroy.length - 1; i >= 0; i--) attempt(onDestroy[i]);
      onDestroy.length = 0;
      if (window.__vs === API) delete window.__vs;
      API = null;
      clear(root);
    }
  };
}

export { mountVaultShelf };
