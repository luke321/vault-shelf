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
 * @property {(into: HTMLElement, note: ShelfNote) => (void | Promise<void>)} [renderNote]
 *   design/0010 -- the host's own markdown renderer. Inside Obsidian this is
 *   MarkdownRenderer.render over the file's real text, so a note in the reading spread is
 *   the note: wikilinks, embeds, callouts, tasks, code. Absent, the page falls back to its
 *   own small renderer over whatever `body` the producer supplied.
 */

/* ================================================================== palette ==
 * design/0005 -- the twelve slots are VAULT GRAPH'S, and they are read out of the stylesheet
 * rather than written down here, because a copy of a palette is a palette that drifts. The
 * names are --g1..--g12 in src/page.css, which are that project's values verbatim; readTheme()
 * snapshots whatever the cascade currently resolves them to, so a theme switch re-reads them
 * instead of repainting from a stale array.
 */
var SLOT_KEYS = ["--g1", "--g2", "--g3", "--g4", "--g5", "--g6",
                 "--g7", "--g8", "--g9", "--g10", "--g11", "--g12"];

/* design/0011 -- A BOOK'S THICKNESS IS ITS NOTE COUNT, on a log scale between these two.
 * Linear would give the Encyclopedia's 0-9 volume (184 notes on the demo vault) a spine
 * fourteen times the width of a one-note book, which is not a shelf, it is a bar chart lying
 * down. Log compresses the tail so a big book is visibly big and a small one is still a book
 * you can read the title of. */
/* design/0014 -- the packing in rowsOf() and the `gap` on .vs-books are the same number, and
 * a row is mispacked by exactly their difference. */
/* design/0003 -- the classifiers that group under a bigger date: months and weeks under a
 * year, years under a decade. core.plaqueFor is the other half and the two agree by test. */
var PLAQUABLE = { month: true, week: true, year: true,
                  person: true, tag: true, folder: true, property: true };

/* design/0008 -- how many ribbons hang over an open book before the rest become a count. */
var MARKS_SHOWN = 3;

var SPINE_GAP = 3;
var SPINE_MIN = 22;
var SPINE_MAX = 58;

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
  /** design/0014 -- the measured inner width of a shelf row; 0 until the first render lands. */
  var roomWidth = 0;

  /** @type {string[]} */
  var SLOTS = [];
  /** @type {Record<string, string>} */
  var slotOf = {};

  /** @type {import("./core/index").Filters} */
  var filters = { folders: [], from: null, to: null };
  /** design/0008 -- the query MARKS; it never narrows. See applyQuery(). */
  var query = "";
  /** @type {ShelfView[]} */
  var views = [];
  /** @type {Record<string, Book>} */
  var bookIndex = {};
  /** The biggest book in the library, which every thickness is scaled against. */
  var thickest = 1;
  /** @type {{ book: Book, index: number, noteId: string|null, within: string, opener: HTMLElement|null }|null} */
  var reader = null;
  /** @type {{ bookId: string, noteId: string|null }[]} */
  var history = [];
  /** @type {{ editing: string|null, draft: Shelf }|null} */
  var builder = null;

  var reduceMotion = WIN.matchMedia
    ? WIN.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  function persist() {
    if (opts.onSettings) opts.onSettings(core.clone(settings));
  }

  /**
   * design/0005 -- snapshot the twelve slots from the cascade. Called once at mount and again
   * whenever the host says the theme changed, so light and dark each get their own values
   * rather than one set tinted twice.
   */
  function readTheme() {
    var cs = WIN.getComputedStyle(root);
    SLOTS = SLOT_KEYS.map(function (k) {
      return (cs.getPropertyValue(k) || "").trim() || "#6f6e67";
    });
    slotOf = {};
    folders.forEach(function (f) { slotOf[f.path] = SLOTS[f.slot % SLOTS.length]; });
  }

  /* =============================================================== membership ==
   * design/0002 -- one pass over the filtered notes per shelf, and the shelf order is the
   * saved position. A hidden shelf is still built: it holds a reading place, and "also
   * shelved in" has to know it exists before deciding not to offer it.
   */
  function rebuild() {
    var visible = core.applyFilters(notes, filters);
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    bookIndex = {};
    thickest = 1;
    views = ordered.map(function (shelf) {
      var view = core.buildShelf(shelf, visible, settings.noteOrder);
      view.books.forEach(function (book) {
        book.bands.forEach(function (band) { band.slot = slotOf[band.folder] || "#6f6e67"; });
        bookIndex[book.id] = book;
        if (book.notes.length > thickest) thickest = book.notes.length;
      });
      return view;
    });
    core.markMatches(views, query);
  }

  /* ================================================================= the rail ==
   * design/0009 -- the only chrome in the room. A shelf jump-list, a search box, and the
   * number the search found; no panel, no filters, no calendar.
   */

  function renderRail() {
    $("vname").textContent = data.vault || "Vault Shelf";

    var jump = $("jump");
    clear(jump);
    views.forEach(function (view) {
      if (view.shelf.hidden) return;
      var b = el("button", "vs-jump");
      b.type = "button";
      b.setAttribute("data-jump", view.shelf.id);
      b.appendChild(el("span", "", view.shelf.name));
      b.appendChild(el("span", "vs-n", String(view.books.length)));
      on(b, "click", function () { scrollToShelf(view.shelf.id); });
      jump.appendChild(b);
    });
  }

  /* ---- the reading shelf --------------------------------------------------
   * design/0008 -- the places you left a ribbon, as a shelf of their own at the head of the
   * room rather than a list in a panel. Every book here is a real book on a real shelf; this
   * one just collects the ones with something hanging out of them.
   */

  /** @returns {Book[]} */
  function readingBooks() {
    /** @type {Book[]} */
    var out = [];
    /** @type {Record<string, boolean>} */
    var seen = {};
    settings.reading.slice().sort(function (a, b) { return b.at - a.at; }).forEach(function (mark) {
      var book = core.resolveReading(mark.noteId, mark.bookId, views);
      if (!book || seen[book.id]) return;
      seen[book.id] = true;
      out.push(book);
    });
    return out;
  }

  /* ================================================================= library == */

  /* design/0014 -- draw, then check the room you drew into, and draw once more if it was not
   * the room you assumed. `settleRoom` can only say yes once per width. */
  function renderLibrary() {
    drawLibrary();
    if (settleRoom()) drawLibrary();
  }

  function drawLibrary() {
    var box = $("shelves");
    clear(box);
    var anyVisible = false;

    var marked = readingBooks();
    if (marked.length) box.appendChild(renderReadingShelf(marked));

    views.forEach(function (view) {
      if (view.shelf.hidden) return;
      anyVisible = true;
      box.appendChild(renderShelf(view));
    });

    var card = $("endcard");
    card.hidden = anyVisible;
    if (!anyVisible) {
      clear(card);
      card.appendChild(el("p", "", "Every shelf is hidden. Nothing was deleted -- Manage " +
                                   "brings them back."));
      var restore = el("button", "vs-primary", "Show every shelf");
      restore.type = "button";
      on(restore, "click", function () {
        settings.shelves.forEach(function (s) { s.hidden = false; });
        persist();
        refresh();
      });
      card.appendChild(restore);
    }
  }

  /** @param {Book[]} books @returns {HTMLElement} */
  function renderReadingShelf(books) {
    var wrap = el("section", "vs-shelf");
    wrap.setAttribute("data-shelf", "-reading");
    var head = el("header", "vs-shelfhead");
    head.appendChild(el("h2", "", "Reading"));
    head.appendChild(el("span", "vs-meta",
      books.length + (books.length === 1 ? " book" : " books") + " with a ribbon in it"));
    wrap.appendChild(head);
    var rail = el("div", "vs-shelfrail");
    /* It packs into rows like any other shelf (design/0014): one ribbon can put a book on it
     * from each of six shelves, so it is not as short as it sounds. */
    rowsOf(books).forEach(function (row) {
      var track = el("div", "vs-track");
      var line = el("div", "vs-books");
      row.forEach(function (book) {
        var shelf = shelfById(book.shelfId);
        line.appendChild(renderSpine(book, shelf || { name: "Reading" }));
      });
      track.appendChild(line);
      rail.appendChild(track);
    });
    wrap.appendChild(rail);
    return wrap;
  }

  /** @param {ShelfView} view @returns {HTMLElement} */
  function renderShelf(view) {
    var wrap = el("section", "vs-shelf");
    wrap.setAttribute("data-shelf", view.shelf.id);

    var head = el("header", "vs-shelfhead");
    head.appendChild(el("h2", "", view.shelf.name));
    head.appendChild(el("span", "vs-meta",
      view.books.length + (view.books.length === 1 ? " book" : " books") + " \u00b7 " +
      view.noteCount + (view.noteCount === 1 ? " note" : " notes")));
    var menu = el("div", "vs-mini");
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

    var rail = el("div", "vs-shelfrail");
    rowsOf(view.books).forEach(function (row) {
      rail.appendChild(renderTrack(row, view.shelf));
    });
    wrap.appendChild(rail);
    return wrap;
  }

  /**
   * design/0014 -- A BOOKCASE, NOT A CONVEYOR BELT. A shelf used to be one row in a horizontal
   * scroller, so a vault with 126 people had 126 books on a rail four screens long and no way
   * to see them at once. A run that outgrows the room now continues on the next shelf down,
   * which is what a bookcase does and what makes the Encyclopedia readable at 543 notes.
   *
   * THE PACKING IS DONE HERE, NOT BY `flex-wrap`, because the plaques are the reason the rows
   * exist: a wrapped flex row cannot tell you where it broke, and a plaque has to be drawn
   * under the part of its run that landed on THIS shelf. Every width is already known --
   * `thicknessOf` is arithmetic on the note count -- so the packing needs no layout pass.
   *
   * @param {Book[]} books @returns {Book[][]}
   */
  function rowsOf(books) {
    var avail = room();
    /** @type {Book[][]} */
    var rows = [];
    /** @type {Book[]} */
    var row = [];
    var used = 0;
    var plaque = false;      // whether a run is open, and what it is labelled
    /** @type {string|null} */
    var label = null;
    var runStart = 0;        // where in this row the open run began

    /* THE PLATE IS PART OF THE RUN'S WIDTH. A plaque is `align-self: stretch`, so a run of one
     * thin book under `2010-2019` is as wide as the words, not as wide as the book -- and a
     * row packed on the books alone then overflowed by exactly that difference. Every run is
     * given room for its own plate before it is allowed to start. */
    function closeRun() {
      if (label !== null) used = Math.max(used, runStart + plaqueWidth(label));
      label = null;
      plaque = false;
    }
    function flush() {
      closeRun();
      if (row.length) { rows.push(row); row = []; used = 0; }
      runStart = 0;
    }

    books.forEach(function (book) {
      var w = thicknessOf(book.notes.length) + SPINE_GAP;
      var mine = book.plaque;
      if (!plaque || mine !== label) {
        closeRun();
        if (row.length && used + Math.max(w, plaqueWidth(mine)) > avail) flush();
        label = mine;
        plaque = true;
        runStart = used;
      } else if (row.length && used + w > avail) {
        flush();
        label = mine;
        plaque = true;
        runStart = 0;
      }
      row.push(book);
      used += w;
    });
    closeRun();
    if (row.length || !rows.length) rows.push(row);
    return rows;
  }

  /**
   * How wide a plaque insists on being, without asking the document. The label is a year or a
   * decade in a known face at a known size, so an upper bound is arithmetic; measuring would
   * mean a layout pass per shelf per render, to learn the width of eleven characters.
   * @param {string|null} label @returns {number}
   */
  function plaqueWidth(label) {
    return label === null ? 0 : label.length * 7.6 + 18;
  }

  /**
   * The room's inner width. `--measure` caps it, the Obsidian sidebar takes from it, a phone
   * has neither, and a vertical scrollbar appears the moment the library is long enough to
   * need one -- so it is MEASURED, and measured off the one element whose width is the answer
   * by definition: a `.vs-track` is `width: 100%` of the row it fills.
   *
   * `roomWidth` is that measurement, taken by `settleRoom()` once the library is in the
   * document. Before there is anything to measure the container is asked instead and the
   * constant is the last resort; either way the next frame corrects it.
   * @returns {number}
   */
  function room() {
    if (roomWidth > 80) return roomWidth;
    var box = $("shelves");
    var w = box ? box.clientWidth : 0;
    return w > 80 ? w : 900;
  }

  /**
   * ONE CORRECTION, NOT A LOOP. The first render of a fresh view packs against a guess -- the
   * container before its scrollbar exists, or nothing at all -- and a guess that is too
   * generous puts the end of a row past the right edge, where it is clipped and simply gone.
   * So: measure a real row, and if the truth differs from what was packed, pack again. The
   * second measurement always agrees with the second packing, and a render that can schedule
   * another render is a render that can spin.
   * @returns {boolean} whether the library has to be drawn again
   */
  function settleRoom() {
    var track = $("shelves").querySelector(".vs-track");
    if (!track) return false;
    var w = track.clientWidth;
    if (w <= 80 || w === roomWidth) return false;
    roomWidth = w;
    return true;
  }

  /**
   * design/0014 -- THE ROOM IS THE WINDOW, until `--measure` catches it. Below the measure a
   * shelf is as wide as what it is in -- a narrowed window, an Obsidian pane with the sidebar
   * out, a split -- and the rows repack to suit; at the measure it stops growing and centres.
   * None of that happens on its own, because the packing is done once per render: a window
   * dragged narrower would keep the row it was packed for and let the end of it run off the
   * side. So a resize re-measures and redraws.
   *
   * COALESCED TO A FRAME. A drag fires resize continuously, and repacking a 10k library 60
   * times a second is 60 renders nobody sees. `requestAnimationFrame` collapses a burst into
   * the one render that matters, and the width is checked before drawing so a resize that
   * did not change the room -- a taller window, a hidden sidebar -- costs nothing at all.
   */
  function watchRoom() {
    var pending = 0;
    var seen = 0;
    function measure() {
      pending = 0;
      var track = $("shelves").querySelector(".vs-track");
      var w = track ? track.clientWidth : 0;
      if (w <= 80 || w === seen) return;
      seen = w;
      roomWidth = w;
      renderLibrary();
    }
    on(WIN, "resize", function () {
      if (pending) return;
      pending = WIN.requestAnimationFrame(measure);
    });
    onDestroy.push(function () { if (pending) WIN.cancelAnimationFrame(pending); });
  }

  /**
   * design/0003 -- the plaque sits in the SAME row as the books it names, so the two cannot
   * drift apart. A shelf with no plaques renders one anonymous group, which keeps the DOM
   * shape identical in both cases.
   *
   * design/0014 -- one call is ONE SHELF ROW. A run that spans two rows gets a plaque on each
   * of them, naming the same year twice, because each plate says what is on the board it is
   * screwed to.
   */
  /** @param {Book[]} books @param {Shelf} shelf @returns {HTMLElement} */
  function renderTrack(books, shelf) {
    var track = el("div", "vs-track");
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
      var g = el("div", "vs-group");
      var row = el("div", "vs-books");
      group.books.forEach(function (book) { row.appendChild(renderSpine(book, shelf)); });
      g.appendChild(row);
      if (group.plaque !== null) g.appendChild(el("div", "vs-plaque", group.plaque));
      track.appendChild(g);
    });
    return track;
  }

  /** @param {Book} book @param {Shelf} shelf @returns {HTMLElement} */
  function renderSpine(book, shelf) {
    var b = el("button", "vs-spine");
    b.type = "button";
    b.setAttribute("data-book", book.id);
    if (!book.notes.length) b.setAttribute("data-empty", "1");
    b.style.setProperty("--spine-w", thicknessOf(book.notes.length) + "px");

    /* design/0005 -- fixed palette slots follow addresses; encyclopedia volumes match. */
    var colorSlot = 0;
    if (settings.varyBookColors && shelf.classifier !== "initial") {
      var hash = 2166136261;
      for (var i = 0; i < book.id.length; i++) {
        hash = Math.imul(hash ^ book.id.charCodeAt(i), 16777619) >>> 0;
      }
      colorSlot = hash % SLOTS.length;
    }
    b.style.setProperty("--spine-tint", SLOTS[colorSlot]);
    b.appendChild(el("span", "vs-title", book.label));
    b.appendChild(el("span", "vs-n", String(book.notes.length)));

    /* design/0008 -- the three things that make a shelf look used rather than printed. */
    var opens = settings.wear[book.id] || 0;
    var level = core.wearLevel(opens);
    if (level) b.setAttribute("data-wear", String(level));
    var ribbons = ribbonsIn(book);
    if (ribbons) {
      var r = el("span", "vs-ribbon");
      if (ribbons > 1) r.setAttribute("data-many", "1");
      b.appendChild(r);
    }
    b.setAttribute("data-match", book.matches > 0 ? "1" : "0");

    var peek = book.label + " -- " + book.notes.length +
      (book.notes.length === 1 ? " note" : " notes");
    if (ribbons) peek += " \u00b7 " + ribbons + (ribbons === 1 ? " ribbon" : " ribbons");
    if (opens) peek += " \u00b7 opened " + opens + (opens === 1 ? " time" : " times");
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

  /**
   * design/0011 -- scaled against the whole LIBRARY, not against the shelf, so a book that is
   * thick on the Months shelf is the same thickness in the Encyclopedia. A shelf whose books
   * are all small therefore looks like a shelf of small books, which is true.
   * @param {number} n @returns {number}
   */
  function thicknessOf(n) {
    if (thickest <= 1) return SPINE_MIN;
    var t = Math.log(1 + n) / Math.log(1 + thickest);
    return Math.round(SPINE_MIN + (SPINE_MAX - SPINE_MIN) * t);
  }

  /** @param {Book} book @returns {number} */
  function ribbonsIn(book) {
    var n = 0;
    settings.reading.forEach(function (mark) {
      if (book.notes.some(function (note) { return note.id === mark.noteId; })) n++;
    });
    return n;
  }

  /* ---- the shelf parts as you type ---------------------------------------
   * design/0008 -- nothing is rebuilt and nothing is removed. Every spine already knows how
   * many of its notes answer the query; this walks them and says so, so the books move where
   * they stand instead of the room being replaced under you.
   */
  function applyQuery() {
    var totals = core.markMatches(views, query);
    var live = query.trim().length > 0;
    if (live) root.setAttribute("data-query", "1");
    else root.removeAttribute("data-query");

    var spines = root.querySelectorAll("#" + ID + "shelves .vs-spine");
    for (var i = 0; i < spines.length; i++) {
      var id = spines[i].getAttribute("data-book");
      var book = id ? bookIndex[id] : null;
      spines[i].setAttribute("data-match", book && book.matches > 0 ? "1" : "0");
    }

    $("hits").textContent = live
      ? totals.notes + (totals.notes === 1 ? " note" : " notes") + " in " +
        totals.books + (totals.books === 1 ? " book" : " books")
      : "";
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
    /* design/0008 -- the book is handled now, and the shelf will show it. */
    settings.wear[book.id] = (settings.wear[book.id] || 0) + 1;
    persist();
    markWear(book.id);
    $("reader").hidden = false;
    renderReader();
    node("reader").focus();
  }

  /** @param {string} bookId */
  function markWear(bookId) {
    var level = core.wearLevel(settings.wear[bookId] || 0);
    var spines = root.querySelectorAll('#' + ID + 'shelves [data-book="' + cssEscape(bookId) + '"]');
    for (var i = 0; i < spines.length; i++) {
      if (level) spines[i].setAttribute("data-wear", String(level));
      else spines[i].removeAttribute("data-wear");
    }
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
    renderMarks();
    renderTabs();
    renderNote();
  }

  /**
   * design/0008 -- THE RIBBONS THIS BOOK HOLDS, hanging over the top of the spread and named.
   *
   * A ribbon used to be visible only from outside: a strip of colour on a spine, and a shelf
   * of marked books at the head of the library. Once a book was open the marks it held were
   * gone -- which is backwards, because a ribbon is a thing you put in a book precisely so you
   * can get back to that page while you are reading it.
   *
   * THREE, AT MOST. Every note in a book can be marked, and a row of forty tabs is a
   * different feature -- a table of contents, which is already on the left-hand page. Three is
   * what a real book holds without falling open at the wrong place, and the count says how
   * many more there are.
   * @returns {void}
   */
  function renderMarks() {
    var box = $("marks");
    clear(box);
    var here = reader.book.notes
      .map(function (note, i) { return { note: note, at: i }; })
      .filter(function (row) { return isBookmarked(row.note.id); });

    /* THE SPACE IS ALWAYS THERE. Hiding the row when a book holds no ribbons moved the whole
     * spread up and down as you marked and unmarked, which is a page that jumps under your
     * hands. The row keeps its height empty, and the stub at the end of it is the edge of a
     * ribbon waiting to be pushed in. */
    box.hidden = false;

    /* THREE AT MOST, AND ALWAYS THE ONE YOU ARE ON. A ribbon is taken out by clicking it, so
     * the ribbon in the current page has to be reachable -- otherwise the fourth ribbon in a
     * book could be left but never removed. If it is not in the first three it takes the last
     * of their places; the count of the rest is unchanged. */
    var shown = here.slice(0, MARKS_SHOWN);
    var onPage = here.filter(function (row) { return row.at === reader.index; })[0];
    if (onPage && shown.indexOf(onPage) < 0) shown[shown.length - 1] = onPage;

    shown.forEach(function (row) {
      var b = /** @type {HTMLButtonElement} */ (el("button", "vs-mark"));
      b.type = "button";
      b.appendChild(el("span", "vs-markribbon"));
      b.appendChild(el("span", "vs-markname", row.note.title));
      /* THE RIBBON IN THE PAGE YOU ARE ON IS THE ONE YOU TAKE OUT. Clicking a ribbon goes to
       * its page; clicking the one you are already on would be a no-op, so it does the only
       * other thing a ribbon can do. Adding is the stub's job and removing is this one's:
       * one control never has to mean both. */
      var mine = row.at === reader.index;
      b.title = mine ? "Take this ribbon out" : "Go to " + row.note.title;
      if (mine) b.setAttribute("aria-current", "true");
      on(b, "click", function () { if (mine) toggleBookmark(); else goTo(row.at); });
      box.appendChild(b);
    });
    if (here.length > MARKS_SHOWN) {
      box.appendChild(el("span", "vs-markmore",
        "+" + (here.length - MARKS_SHOWN) + " more"));
    }

    /* The stub: a ribbon's edge, showing above the page you are on. Pushing it in leaves a
     * ribbon there; pulling it out takes it away again, which is the same button `Ribbon` in
     * the bar is, one hand's width closer to the page. */
    var note = reader.book.notes[reader.index];
    if (!note) return;
    /* NOTHING TO ADD WHEN IT IS ALREADY THERE. The stub used to toggle, so the same small
     * shape meant "leave one" and "take that one out" depending on a state you could not see
     * -- and taking one out is what its own ribbon is for, one hand's width away. */
    if (isBookmarked(note.id)) return;
    var stub = /** @type {HTMLButtonElement} */ (el("button", "vs-markstub"));
    stub.type = "button";
    stub.appendChild(el("span", "vs-markplus", "+"));
    stub.appendChild(el("span", "vs-markname", "Ribbon"));
    stub.title = "Leave a ribbon in this page";
    stub.setAttribute("aria-label", stub.title);
    on(stub, "click", toggleBookmark);
    box.appendChild(stub);
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
      b.appendChild(el("span", "vs-t", note.title));
      /* design/0012 -- a leader exists because there is something at the end of it. A row with
       * no date to lead to just stops, the way a printed index does. */
      if (note.date && note.title.indexOf(note.date) !== 0) {
        b.appendChild(el("span", "vs-leader"));
        b.appendChild(el("span", "vs-when", note.date));
      }
      on(b, "click", function () { goTo(i); });
      li.appendChild(b);
      box.appendChild(li);
    });
    if (!box.firstChild) {
      var empty = el("li");
      empty.appendChild(el("span", "vs-hint", needle ? "Nothing in this book matches." : "This book is empty."));
      box.appendChild(empty);
    }
  }

  /**
   * The index tabs are the book's own shape: months for a year, days for a month or a week,
   * letters for a volume of the Encyclopedia, and the span it covers for a person's or a
   * tag's book. A vault with thousands of entries gets ranges rather than thousands of tabs --
   * a tab you cannot hit is decoration.
   *
   * design/0015 -- A TAB IS A POSITION IN THE CONTENTS, so the tabs have to be cut the same
   * way the contents are ordered. The M volume of an Encyclopedia is in alphabetical order and
   * gets letters; a person's book is in date order and gets dates. Cutting letters over a
   * date-ordered list is what produced tabs that jumped backwards.
   */
  /** @param {Book} book @returns {{ label: string, at: number }[]} */
  function indexSections(book) {
    var shelf = shelfById(book.shelfId);
    var kind = shelf ? shelf.classifier : "initial";
    /** @type {{ label: string, at: number }[]} */
    var out = [];
    if (kind === "initial") {
      out = letterTabs(book.notes);
    } else if (kind === "year") {
      out = cutBy(book.notes, function (n) { return n.date ? n.date.slice(0, 7) : ""; },
                  function (key) { return core.monthLabel(key).slice(0, 3); });
    } else if (kind === "month" || kind === "week") {
      out = cutBy(book.notes, function (n) { return n.date || ""; },
                  function (key) { return key.slice(8); });
    } else {
      out = spanTabs(book.notes);
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

  /**
   * One tab per distinct key, at the first note that carries it. A note with no key -- an
   * undated one in a date-cut book -- is skipped rather than given a tab of its own.
   * @param {ShelfNote[]} notes
   * @param {function(ShelfNote): string} keyOf
   * @param {function(string): string} labelOf
   * @returns {{ label: string, at: number }[]}
   */
  function cutBy(notes, keyOf, labelOf) {
    /** @type {{ label: string, at: number }[]} */
    var out = [];
    /** @type {Record<string, boolean>} */
    var seen = {};
    notes.forEach(function (n, i) {
      var key = keyOf(n);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({ label: labelOf(key), at: i });
    });
    return out;
  }

  /**
   * design/0015 -- AS DEEP AS THE BOOK NEEDS. Every note in the Encyclopedia's M volume starts
   * with M, so one letter is one tab and one tab is no index at all. So it cuts on two letters
   * -- Ma, Mc, Mi -- and on three where two is still not enough, which is what the spine
   * labels of a real multi-volume encyclopedia do for exactly this reason.
   *
   * It stops as soon as the tabs are worth having, because deeper is not better: Mar, Mat, Mea
   * over a book of forty is a wall of tabs that says less than Ma, Me, Mi.
   * @param {ShelfNote[]} notes @returns {{ label: string, at: number }[]}
   */
  function letterTabs(notes) {
    /** @type {{ label: string, at: number }[]} */
    var out = [];
    for (var depth = 1; depth <= 3; depth++) {
      out = cutBy(notes, function (n) { return titlePrefix(n.title, depth); },
                  function (key) { return key; });
      if (out.length >= 4 || out.length >= notes.length) return out;
    }
    return out;
  }

  /**
   * The first letter as the classifier sees it -- punctuation stripped, digits collapsed to
   * `0-9` -- and then, at greater depths, more of THE FIRST WORD.
   *
   * The first word, not the first characters: "A note on ferries" cut at three characters is
   * `A n`, a tab with a space in it that claims to be a range and is not. Its first word is
   * `A`, so its tab is `A`, and it files next to `A dozen` and before `Aft`. That is how a
   * volume spine is lettered.
   * @param {string} title @param {number} depth @returns {string}
   */
  function titlePrefix(title, depth) {
    var head = core.firstLetter(title);
    if (depth <= 1 || head === "#") return head;
    var word = /^[\p{L}\p{N}]+/u.exec(title.replace(/^[^\p{L}\p{N}]+/u, ""));
    if (!word) return head;
    /* THE 0-9 VOLUME IS INDEXED BY YEAR. It is one book of 351 notes in a vault of daily
     * notes, and "0-9" is the only tab a letter cut can give it. What a title beginning
     * `2023-02-16` is actually filed under is 2023. */
    if (head === "0-9") return /^\d{4}/.test(word[0]) ? word[0].slice(0, 4) : head;
    return head + word[0].slice(1, depth).toLowerCase();
  }

  /**
   * A book that is in date order but is not a date book -- a person, a tag, a folder, a
   * property value. It is indexed by the biggest unit that gives it more than one tab: years
   * for a decade of meetings, months for a busy year, days for a fortnight.
   * @param {ShelfNote[]} notes @returns {{ label: string, at: number }[]}
   */
  function spanTabs(notes) {
    var byYear = cutBy(notes, function (n) { return n.date ? n.date.slice(0, 4) : ""; },
                       function (key) { return key; });
    if (byYear.length > 1) return byYear;
    var byMonth = cutBy(notes, function (n) { return n.date ? n.date.slice(0, 7) : ""; },
                        function (key) { return core.monthLabel(key).slice(0, 3); });
    if (byMonth.length > 1) return byMonth;
    return cutBy(notes, function (n) { return n.date || ""; },
                 function (key) { return key.slice(8); });
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
      box.appendChild(el("p", "vs-hint", "This book has no notes under the current filters."));
      clear($("alsoin"));
      $("notemeta").textContent = "";
      return;
    }
    reader.noteId = note.id;
    field("prevnote").disabled = reader.index <= 0;
    field("nextnote").disabled = reader.index >= reader.book.notes.length - 1;

    renderMeta(note);
    /* design/0010 -- A PER-RENDER HOST, and it is what makes the async renderer safe without
     * a sequence number: renderNote() clears `box` first, which DETACHES the previous host, so
     * a slow render that resolves after the reader has moved on writes into an element that is
     * no longer in the document. Nothing to cancel and nothing to compare. */
    var host = el("div");
    box.appendChild(host);
    if (opts.renderNote) {
      attempt(function () { void opts.renderNote(host, note); });
    } else {
      renderMarkdownInto(host, note);
    }
    if (opts.onOpenNote) {
      var open = /** @type {HTMLButtonElement} */ (el("button", "vs-editin", "Edit in Obsidian"));
      open.type = "button";
      var openNote = opts.onOpenNote;
      on(open, "click", function () { openNote(note.path); });
      box.appendChild(open);
    }

    var also = $("alsoin");
    clear(also);
    var others = core.alsoShelvedIn(note.id, views, reader.book.id);
    if (!others.length) return;
    also.appendChild(el("span", "vs-lbl", "Also shelved in"));
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
  /** @param {ShelfNote} note */
  function renderMeta(note) {
    var box = $("notemeta");
    clear(box);
    box.appendChild(el("strong", "", note.title));
    /** @type {string[]} */
    var meta = [];
    if (note.date && note.title.indexOf(note.date) !== 0) meta.push(note.date);
    if (note.folder) meta.push(note.folder);
    if (note.people.length) meta.push(note.people.join(", "));
    if (note.tags.length) meta.push(note.tags.map(function (t) { return "#" + t; }).join(" "));
    if (meta.length) box.appendChild(el("span", "", "  " + meta.join(" \u00b7 ")));
  }

  /** @param {HTMLElement} box @param {ShelfNote} note */
  function renderMarkdownInto(box, note) {
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
    if (!box.firstChild) {
      box.appendChild(el("p", "vs-hint",
        "No text for this note here -- open it in Obsidian to read it."));
    }
  }

  /** @param {number} index */
  function goTo(index) {
    if (!reader) return;
    reader.index = Math.max(0, Math.min(index, reader.book.notes.length - 1));
    /* THE CONTENTS MARK `reader.noteId`, AND `renderNote` IS WHERE IT WAS SET -- which runs
     * after them. So the first click drew the index against the note you had just left and
     * the second one caught up, which is why it took two clicks to highlight one row. */
    var going = reader.book.notes[reader.index];
    if (going) reader.noteId = going.id;
    renderContents();
    /* THE ROW IS ABOUT THE PAGE YOU ARE ON, so moving to another page redraws it. Without
     * this the stub kept whatever state the previous page put it in: turn to a page that
     * already holds a ribbon and it still offered to leave one, and the ribbon you were on
     * stayed marked as the current one. Six controls call this -- the contents, the tabs, the
     * ribbons themselves, Previous, Next and the arrow keys -- and every one of them showed
     * it. */
    renderMarks();
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

  /* design/0008 -- THE ROW IS THE CONTROL. There used to be a `Ribbon` button in the reader's
   * bar as well, which meant the same act had two places and neither said which ribbon it was
   * about: the row over the book shows every ribbon in it, the stub leaves one in the page you
   * are on, and its own ribbon takes it out again.
   * @returns {void} */
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
    renderMarks();   // the row over the spread is this book's ribbons, so it changes here too
    renderLibrary();
    applyQuery();
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
    /* github#0 -- THE ORDER IS TWO WORDS THAT DEPEND ON THE CLASSIFIER. Under the labels
     * "Alphabetical" and "Newest first" a Years shelf offered no way to read as oldest-first,
     * because the option that does it was named after the other kind of shelf. The two values
     * have always been ascending and descending; only the words were wrong. */
    var dated = d.classifier === "year" || d.classifier === "month" || d.classifier === "week";
    var order = /** @type {HTMLSelectElement} */ ($("bdirection"));
    order.options[0].textContent = dated ? "Oldest first" : "A to Z";
    order.options[1].textContent = dated ? "Newest first" : "Z to A";
    order.value = d.direction;
    /* design/0015 -- a date shelf takes its direction from the top bar, so the control here
     * would be a second answer to a question already answered. */
    order.disabled = dated;
    order.title = dated ? "Date shelves follow the reading order in the top bar." : "";
    field("bplaques").checked = !!d.plaques;
    field("bplaques").disabled = !PLAQUABLE[d.classifier];
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
    d.plaques = !!PLAQUABLE[d.classifier] && field("bplaques").checked;
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
    var view = core.buildShelf(draft, core.applyFilters(notes, filters), settings.noteOrder);
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

  /* github#0 -- MANAGE IS WHERE PEOPLE LOOK FOR "ADD ONE". The sheet listed every shelf and
   * offered no way to make another, so the only two doors to the builder were a card at the
   * end of the library and a row menu that appears on hover. */
  function newShelfFromManage() {
    $("manage").hidden = true;
    openBuilder(null);
  }

  function renderManage() {
    field("mvarycolors").checked = settings.varyBookColors;
    var box = $("managelist");
    clear(box);
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    ordered.forEach(function (shelf, i) {
      var row = el("div", "vs-managerow");
      row.appendChild(el("span", "vs-name", shelf.name));
      row.appendChild(el("span", "vs-meta", shelf.classifier + (shelf.hidden ? " \u00b7 hidden" : "")));

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
    if (filters.folders.length) parts.push(filters.folders.length + " folder" +
      (filters.folders.length === 1 ? "" : "s"));
    if (filters.from || filters.to) parts.push((filters.from || "\u2026") + " to " + (filters.to || "\u2026"));
    var bar = $("activefilters");
    bar.hidden = !parts.length;
    $("filtertext").textContent = parts.length
      ? "Narrowed to " + parts.join(", ") + " \u2014 " +
        core.applyFilters(notes, filters).length + " of " + notes.length + " notes"
      : "";
  }

  function clearFilters() {
    filters = { folders: [], from: null, to: null };
    query = "";
    field("q").value = "";
    refresh();
  }

  /* ================================================================= refresh == */

  /* design/0016 -- the LOOK is one attribute, and the twelve slots resolve differently under
   * it, so a look that has just changed has to re-read them before anything is dyed. */
  /**
   * design/0015 -- WHICH END OF A BOOK YOU OPEN, in the top bar rather than in a settings
   * sheet, because it is a reading preference and you change it while reading. Oldest first
   * is the default: a notebook that opens on its last page reads as if it were written
   * backwards, which is what a feed does and a book does not.
   *
   * It says what it IS, not what pressing it would do -- a button labelled "Newest first"
   * that gives you oldest-first is a coin toss every time.
   */
  function paintOrder() {
    var newest = settings.noteOrder === "newest";
    var b = node("order");
    b.textContent = newest ? "Newest first" : "Oldest first";
    b.setAttribute("aria-pressed", newest ? "true" : "false");
    b.title = newest
      ? "Books open on their most recent note. Click for oldest first."
      : "Books open on their earliest note, the way a notebook is written. " +
        "Click for newest first.";
  }

  /**
   * design/0016 -- THE LOOK IS PICKED WHERE IT IS SEEN. It was a toggle in the plugin's
   * settings tab and a button bolted to the standalone's chrome -- two controls, in two
   * places, neither of them the room being repainted. One selector in the top bar serves both
   * hosts, and its options come from `core.LOOKS`, so a fourth look is one list entry and one
   * stylesheet.
   */
  function fillLooks() {
    var select = field("look");
    clear(select);
    core.LOOKS.forEach(function (look) {
      var o = DOC.createElement("option");
      o.value = look.value;
      o.textContent = look.name;
      select.appendChild(o);
    });
    select.value = core.isLook(settings.look) ? settings.look : "";
  }

  function toggleOrder() {
    settings.noteOrder = settings.noteOrder === "newest" ? "oldest" : "newest";
    persist();
    paintOrder();
    /* A book's notes are sorted where it is built, so this is a rebuild and not a repaint --
     * and the reading place re-resolves through it the way it does after any rebuild. */
    refresh();
  }

  function applyLook() {
    var want = core.isLook(settings.look) ? settings.look : "";
    if (root.getAttribute("data-look") === want) return;
    root.setAttribute("data-look", want);
    readTheme();
  }

  function refresh() {
    applyLook();
    rebuild();
    renderRail();
    renderLibrary();
    renderActiveFilters();
    applyQuery();
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

  watchRoom();
  paintOrder();
  on($("order"), "click", toggleOrder);
  fillLooks();
  on($("look"), "change", function () {
    settings.look = /** @type {import("./core/index").Look} */ (field("look").value);
    persist();
    /* design/0016 -- REFRESH, NOT applyLook. A spine's dye is an inline `--spine-tint` written
     * when it was drawn, so swapping the stylesheet under it leaves every book wearing the
     * previous look's colour until something else happens to rebuild. `refresh()` calls
     * `applyLook()` first, so the attribute is still set before the slots are re-read. */
    refresh();
  });

  on($("q"), "input", function () {
    query = field("q").value;
    applyQuery();
  });
  on($("clearfilters"), "click", clearFilters);
  on($("newshelf"), "click", function () { openBuilder(null); });
  on($("newshelf2"), "click", function () { openBuilder(null); });
  on($("manageopen"), "click", openManage);
  on($("mvarycolors"), "change", function () {
    settings.varyBookColors = field("mvarycolors").checked;
    persist();
    refresh();
  });
  on($("mnew"), "click", newShelfFromManage);
  on($("mclose"), "click", function () { $("manage").hidden = true; node("library").focus(); });
  on($("mrestore"), "click", function () {
    settings.shelves.forEach(function (s) { s.hidden = false; });
    persist();
    renderManage();
    refresh();
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

  readTheme();
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
    /** @param {string} theme */
    setTheme: function (theme) {
      root.setAttribute("data-theme", theme === "light" ? "light" : "dark");
      readTheme();
      refresh();
    },
    readTheme: function () { readTheme(); refresh(); },
    /** @param {string} q */
    setQuery: function (q) {
      query = q;
      field("q").value = q;
      applyQuery();
    },
    /** The twelve slots as the cascade currently resolves them. design/0005. */
    slots: function () { return SLOTS.slice(); },
    /** design/0008 -- what the room currently looks like it has been used for. */
    magic: function () {
      var worn = {};
      var withRibbon = 0, ghosts = 0, forward = 0;
      views.forEach(function (v) {
        v.books.forEach(function (b) {
          var lv = core.wearLevel(settings.wear[b.id] || 0);
          if (lv) worn[b.id] = lv;
          if (ribbonsIn(b)) withRibbon++;
        });
      });
      var spines = root.querySelectorAll("#" + ID + "shelves .vs-spine");
      for (var i = 0; i < spines.length; i++) {
        if (spines[i].getAttribute("data-match") === "1") forward++; else ghosts++;
      }
      return {
        query: query,
        parting: root.getAttribute("data-query") === "1",
        worn: Object.keys(worn).length,
        wornSpines: root.querySelectorAll("#" + ID + "shelves .vs-spine[data-wear]").length,
        ribbons: withRibbon,
        ribbonSpines: root.querySelectorAll("#" + ID + "shelves .vs-spine .vs-ribbon").length,
        forward: forward,
        ghosts: ghosts
      };
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
        spines: root.querySelectorAll("#" + ID + "shelves .vs-spine").length,
        plaques: root.querySelectorAll("#" + ID + "shelves .vs-plaque").length,
        jump: root.querySelectorAll("#" + ID + "jump .vs-jump").length,
        newshelf: root.querySelectorAll("#" + ID + "library .vs-newshelf").length,
        readingShelf: root.querySelectorAll('#' + ID + 'shelves [data-shelf="-reading"]').length
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
        readTheme();
      }
      refresh();
    },
    /** @param {unknown} next */
    setSettings: function (next) {
      settings = core.migrate(next);
      refresh();
    },
    /** The host says the theme changed; re-read the twelve slots and repaint. */
    readTheme: function () { readTheme(); refresh(); },
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
