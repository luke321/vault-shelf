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
  /** What the resize watcher saw, for the harness to read back. */
  var roomLog = { resizes: 0, measured: 0, last: 0 };

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
  /**
   * github#4 -- THE LOOK'S OWN twelve and ribbon, as hex, read with the person's choice lifted
   * off. Manage compares a slot against these to say whether it has been changed, and a
   * per-slot reset writes one of them back.
   * @type {{ slots: string[], ribbon: string }}
   */
  var OWN = { slots: [], ribbon: "" };

  function readTheme() {
    SLOT_KEYS.forEach(function (k) { root.style.removeProperty(k); });
    root.style.removeProperty("--ribbon");
    var bare = WIN.getComputedStyle(root);
    OWN.slots = SLOT_KEYS.map(function (k) {
      return toHex((bare.getPropertyValue(k) || "").trim() || "#6f6e67");
    });
    OWN.ribbon = toHex((bare.getPropertyValue("--ribbon") || "").trim() || "#6f6e67");

    /* design/0005 -- A PERSON'S PALETTE OVER THE LOOK'S. Twelve chosen colours are written
     * inline on the root so the cascade below resolves to them in every look; none chosen
     * means the inline values are cleared and the look's own come through. The ribbon the
     * same way. Inline, because the looks set these on the same element and a person's
     * choice has to beat all three without knowing which is on. */
    var chosen = settings.palette.length === 12;
    SLOT_KEYS.forEach(function (k, i) {
      if (chosen) root.style.setProperty(k, settings.palette[i]);
      else root.style.removeProperty(k);
    });
    if (settings.ribbon) root.style.setProperty("--ribbon", settings.ribbon);
    else root.style.removeProperty("--ribbon");

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
        line.appendChild(renderSpine(book, shelf || { name: "Reading" }, false));
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
      rail.appendChild(renderTrack(row, view.shelf, true));
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
    var w = shelfWidth();
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
    var w = shelfWidth();
    if (w <= 80 || w === roomWidth) return false;
    roomWidth = w;
    return true;
  }

  /**
   * THE CONTAINER, NOT THE FIRST ROW. A row inside a shelf that `content-visibility` has
   * skipped measures 0 wide, and the first row is skipped whenever the top of the library is
   * off screen -- so a resize measured through it saw nothing and repacked nothing. The
   * container is never skipped, it lives inside the scroller so its width already excludes
   * the scrollbar, and a row is 100% of it by construction.
   * @returns {number}
   */
  function shelfWidth() {
    var box = node("shelves");
    var cs = WIN.getComputedStyle(box);
    return box.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  }

  /**
   * design/0014 -- THE ROOM IS THE WINDOW, until `--measure` catches it. Below the measure a
   * shelf is as wide as what it is in -- a narrowed window, an Obsidian pane with the sidebar
   * out, a split -- and the rows repack to suit; at the measure it stops growing and centres.
   * None of that happens on its own, because the packing is done once per render: a window
   * dragged narrower would keep the row it was packed for and let the end of it run off the
   * side. So a resize re-measures and redraws.
   *
   * COALESCED. A drag fires resize continuously, and repacking a 10k library 60 times a
   * second is 60 renders nobody sees; a short timer collapses a burst into the one render
   * that matters, and the width is checked before drawing so a resize that did not change
   * the room -- a taller window, a hidden sidebar -- costs nothing at all.
   */
  function watchRoom() {
    var pending = 0;
    var seen = 0;
    function measure() {
      pending = 0;
      var w = shelfWidth();
      roomLog.measured++;
      roomLog.last = w;
      if (w <= 80 || w === seen) return;
      seen = w;
      roomWidth = w;
      renderLibrary();
    }
    /* A TIMER, NOT AN ANIMATION FRAME. This coalesced through requestAnimationFrame first,
     * and the harness caught it: the resize handler ran, the frame callback never did -- the
     * watcher had "seen 2 resizes, measured 0 times" -- because a window Chrome is not
     * painting gets no frames, and `pending` then stayed set for good. A repack is a
     * correctness step, and a timer fires whether or not the window is being drawn. */
    on(WIN, "resize", function () {
      roomLog.resizes++;
      if (pending) return;
      pending = WIN.setTimeout(measure, 60);
    });
    onDestroy.push(function () { if (pending) WIN.clearTimeout(pending); });
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
  /**
   * design/0018 -- A RUN IS WHAT IS ADJACENT, not what shares a label. The groups were
   * collected into a map keyed by the plaque, so two books with the same year anywhere in the
   * row were drawn side by side under one plate -- which was invisible while every shelf was
   * sorted by key, because same-plaque books were always neighbours, and which would silently
   * re-order a shelf arranged by hand. `rowsOf` has always packed on adjacency; this now
   * agrees with it, and the cost is that a decade a person has split shows two plates.
   */
  /** @param {Book[]} books @param {Shelf} shelf @param {boolean} hand @returns {HTMLElement} */
  function renderTrack(books, shelf, hand) {
    var track = el("div", "vs-track");
    /** @type {{ plaque: string|null, books: Book[] }[]} */
    var groups = [];
    books.forEach(function (book) {
      var last = groups.length ? groups[groups.length - 1] : null;
      if (!last || last.plaque !== book.plaque) {
        last = { plaque: book.plaque, books: [] };
        groups.push(last);
      }
      last.books.push(book);
    });

    groups.forEach(function (group) {
      var g = el("div", "vs-group");
      var row = el("div", "vs-books");
      group.books.forEach(function (book) { row.appendChild(renderSpine(book, shelf, hand)); });
      g.appendChild(row);
      if (group.plaque !== null) g.appendChild(el("div", "vs-plaque", group.plaque));
      track.appendChild(g);
    });
    return track;
  }

  /** @param {Book} book @param {Shelf} shelf @param {boolean} hand @returns {HTMLElement} */
  function renderSpine(book, shelf, hand) {
    var b = el("button", "vs-spine");
    b.type = "button";
    b.setAttribute("data-book", book.id);
    if (!book.notes.length) b.setAttribute("data-empty", "1");
    b.style.setProperty("--spine-w", thicknessOf(book.notes.length) + "px");

    b.style.setProperty("--spine-tint", dyeOf(book, shelf));
    b.appendChild(el("span", "vs-title", book.label));
    b.appendChild(el("span", "vs-n", String(book.notes.length)));

    /* design/0008 -- the three things that make a shelf look used rather than printed. */
    var opens = settings.wear[book.id] || 0;
    var level = core.wearLevel(opens);
    if (level) b.setAttribute("data-wear", String(level));
    /* AS MANY RIBBONS AS IT HOLDS, up to three, side by side out of the bottom of the spine --
     * a book with three ribbons in it looks like a book with three ribbons in it, not like
     * one with a wider ribbon. Beyond three the count is on the hover peek. */
    var ribbons = ribbonsIn(book);
    for (var ri = 0; ri < Math.min(ribbons, 3); ri++) {
      var r = el("span", "vs-ribbon");
      r.setAttribute("data-i", String(ri));
      r.setAttribute("data-of", String(Math.min(ribbons, 3)));
      b.appendChild(r);
    }
    /* design/0005 -- right-click a spine to dye it by hand. */
    on(b, "contextmenu", function (e) {
      var me = /** @type {MouseEvent} */ (e);
      me.preventDefault();
      openDye(book, me.clientX, me.clientY);
    });
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
    /* design/0005 -- ONE PEEK, OURS. A `title` is the browser's tooltip and an `aria-label`
     * is, inside Obsidian, the app's -- so a hovered spine grew two overlays, both too small
     * to read a long tag name in. The spine has its own text for a name, so neither attribute
     * is needed; the peek is an element of the page, sized to be read. */
    b.setAttribute("data-peek", peek);
    b.setAttribute("data-shelfname", shelf.name);
    on(b, "mouseenter", function () { showPeek(b); });
    on(b, "focus", function () { showPeek(b); });
    on(b, "mouseleave", hidePeek);
    on(b, "blur", hidePeek);
    /* A one-letter label reads better upright than turned on its side: A, K, 0-9, Ü. */
    if (book.label.length <= 3) b.setAttribute("data-upright", "1");

    on(b, "click", function () { openBook(book, null); });
    if (hand && shelf.direction === "manual") handleOf(b, book, shelf);
    return b;
  }

  /* ---- a shelf arranged by hand ---------------------------------------------
   * design/0018 -- native HTML5 drag and drop, which is what a browser already has: no
   * library, no pointer bookkeeping, and a drag that starts on a spine is a drag the operating
   * system draws for you. What is added here is the one thing it does not do -- say where the
   * book would land -- and a keyboard path that does the same move without a pointer.
   */

  /** @type {{ shelfId: string, key: string }|null} */
  var dragging = null;
  /** @type {HTMLElement|null} */
  var dropMark = null;

  /** @param {HTMLElement} b @param {Book} book @param {Shelf} shelf */
  function handleOf(b, book, shelf) {
    b.draggable = true;
    b.setAttribute("data-hand", "1");
    b.setAttribute("data-peek", b.getAttribute("data-peek") +
      "\n\nDrag to move it along the shelf; Alt+Left and Alt+Right do the " +
      "same from the keyboard.");
    on(b, "dragstart", function (e) {
      var de = /** @type {DragEvent} */ (e);
      dragging = { shelfId: shelf.id, key: book.key };
      if (de.dataTransfer) {
        de.dataTransfer.effectAllowed = "move";
        /* The payload is the address, not the label: the same thing a drop between two hosts
         * would have to mean (decisions/0002). Nothing reads it back -- `dragging` does that,
         * because `getData` is deliberately unreadable during a dragover. */
        de.dataTransfer.setData("text/plain", book.id);
      }
      b.setAttribute("data-dragging", "1");
    });
    on(b, "dragend", function () {
      dragging = null;
      clearDrop();
      b.removeAttribute("data-dragging");
    });
    on(b, "dragover", function (e) {
      if (!dragging || dragging.shelfId !== shelf.id || dragging.key === book.key) return;
      var de = /** @type {DragEvent} */ (e);
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = "move";
      markDrop(b, sideOf(b, de.clientX));
    });
    on(b, "dragleave", function () { if (dropMark === b) clearDrop(); });
    on(b, "drop", function (e) {
      var de = /** @type {DragEvent} */ (e);
      de.preventDefault();
      if (!dragging || dragging.shelfId !== shelf.id) return;
      var moved = dragging.key;
      var side = sideOf(b, de.clientX);
      dragging = null;
      clearDrop();
      if (moved === book.key) return;
      arrangeBook(shelf, moved, neighbour(shelf, book.key, side, moved),
                  core.bookId(shelf.id, moved));
    });
  }

  /** @param {HTMLElement} b @param {number} x @returns {"before"|"after"} */
  function sideOf(b, x) {
    var box = b.getBoundingClientRect();
    return x >= box.left + box.width / 2 ? "after" : "before";
  }

  /** @param {HTMLElement} b @param {"before"|"after"} side */
  function markDrop(b, side) {
    if (dropMark === b && b.getAttribute("data-drop") === side) return;
    clearDrop();
    dropMark = b;
    b.setAttribute("data-drop", side);
    var bar = el("span", "vs-drop");
    bar.setAttribute("data-side", side);
    b.appendChild(bar);
  }

  function clearDrop() {
    if (dropMark) {
      dropMark.removeAttribute("data-drop");
      var bar = dropMark.querySelector(".vs-drop");
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }
    dropMark = null;
  }

  /**
   * Which book the moved one has to come BEFORE, read off the shelf as it is currently drawn
   * and with the moved book taken out of it first -- otherwise "after my right-hand neighbour"
   * names the book being carried and lands it at the end of the shelf.
   * @param {Shelf} shelf @param {string} targetKey @param {"before"|"after"} side
   * @param {string} movedKey @returns {string|null}
   */
  function neighbour(shelf, targetKey, side, movedKey) {
    var view = views.filter(function (v) { return v.shelf.id === shelf.id; })[0];
    if (!view) return null;
    var keys = view.books.map(function (bk) { return bk.key; })
      .filter(function (k) { return k !== movedKey; });
    var i = keys.indexOf(targetKey);
    if (i < 0) return null;
    if (side === "before") return targetKey;
    return i + 1 < keys.length ? keys[i + 1] : null;
  }

  /**
   * design/0018 -- THE SEQUENCE IS SAVED AGAINST THE WHOLE VAULT, not against what a filter is
   * currently showing: the shelf is rebuilt here from the unfiltered notes, so a key a filter
   * has hidden keeps its place and a key the vault no longer has is dropped -- on save, which
   * is the only moment either question has an answer nobody has to guess.
   * @param {Shelf} shelf @param {string} key @param {string|null} before @param {string} [refocus]
   */
  function arrangeBook(shelf, key, before, refocus) {
    var live = core.buildShelf(shelf, notes, settings.noteOrder).books
      .map(function (bk) { return bk.key; });
    shelf.order = core.moveBefore(live, key, before);
    persist();
    refresh();
    if (!refocus) return;
    var again = /** @type {HTMLElement|null} */ (root.querySelector(
      "#" + ID + 'shelves .vs-spine[data-book="' + cssEscape(refocus) + '"]'));
    if (again) again.focus();
  }

  /**
   * The accessibility path, and the one a check can drive: one place left or right, off the
   * shelf as it is drawn, which is the same move a drop makes.
   * @param {HTMLElement} spine @param {number} delta @returns {boolean}
   */
  function nudge(spine, delta) {
    var book = bookIndex[spine.getAttribute("data-book") || ""];
    if (!book) return false;
    var shelf = shelfById(book.shelfId);
    if (!shelf || shelf.direction !== "manual") return false;
    var view = views.filter(function (v) { return v.shelf.id === shelf.id; })[0];
    if (!view) return false;
    var i = -1;
    view.books.forEach(function (bk, k) { if (bk.key === book.key) i = k; });
    var target = view.books[i + delta];
    if (i < 0 || !target) return false;
    arrangeBook(shelf, book.key, neighbour(shelf, target.key, delta > 0 ? "after" : "before",
                                           book.key), book.id);
    return true;
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

  /**
   * design/0005 -- WHICH OF THE TWELVE A BOOK WEARS, in order of who said so:
   *
   *   1. the person, by right-clicking the spine (`bookColors`, keyed by address);
   *   2. the shelf, if it varies its books -- a slot hashed from the address, so it stays put
   *      as notes arrive and a shelf of people reads as people rather than as folders;
   *   3. the note's dominant source folder, which is what a dye MEANS by default: a book from
   *      the meetings folder and a book from the journal are different colours because they
   *      are different kinds of book.
   *
   * The leather rework had made every book slot 0 unless a shelf varied, which is why a whole
   * library came out one colour; that was a regression of design/0005 and this is its repair.
   * @param {Book} book @param {Shelf} shelf @returns {string}
   */
  function dyeOf(book, shelf) {
    var given = settings.bookColors[book.id];
    if (typeof given === "number" && SLOTS[given]) return SLOTS[given];
    if (shelf.varyColors) return SLOTS[hashSlot(book.id)];
    if (book.bands.length && book.bands[0].slot) return String(book.bands[0].slot);
    return SLOTS[0];
  }

  /* ---- the peek ----------------------------------------------------------------
   * design/0005 -- what a spine says when you hover it: its label, in full and readable
   * however long, and the numbers a spine is too narrow to carry in words. One element,
   * moved to whichever spine is under the pointer, above the shelf so it never covers the
   * book it describes.
   */
  /** @param {HTMLElement} spine */
  function showPeek(spine) {
    var card = node("peek");
    clear(card);
    var text = spine.getAttribute("data-peek") || "";
    var lines = text.split("\n");
    var head = lines[0].split(" -- ");
    card.appendChild(el("div", "vs-peekname", head[0]));
    if (head[1]) card.appendChild(el("div", "vs-peekmeta", head[1]));
    var rest = lines.slice(1).filter(function (l) { return l.trim(); });
    if (rest.length) {
      var list = el("div", "vs-peeknotes");
      rest.forEach(function (l) { list.appendChild(el("div", "", l)); });
      card.appendChild(list);
    }
    card.hidden = false;
    var host = root.getBoundingClientRect();
    var box = spine.getBoundingClientRect();
    var w = card.offsetWidth, h = card.offsetHeight;
    var left = box.left - host.left + box.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, host.width - w - 8));
    var top = box.top - host.top - h - 10;
    if (top < 8) top = box.bottom - host.top + 10;
    card.style.left = left + "px";
    card.style.top = top + "px";
    spine.setAttribute("aria-describedby", "vs-peek");
  }

  function hidePeek() {
    node("peek").hidden = true;
  }

  /** FNV-1a over the address, folded into a slot. @param {string} id @returns {number} */
  function hashSlot(id) {
    var hash = 2166136261;
    for (var i = 0; i < id.length; i++) {
      hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
    }
    return hash % SLOTS.length;
  }

  /* ---- the dye menu ---------------------------------------------------------
   * design/0005 -- twelve swatches and "Automatic", where the right-click landed. A colour
   * given here is a colour kept: it is keyed by the book's address, so it survives a rebuild
   * the way a reading place does.
   */
  /** @type {Book|null} */
  var dyeing = null;

  /** @param {Book} book @param {number} x @param {number} y */
  function openDye(book, x, y) {
    dyeing = book;
    var menu = node("dye");
    clear(menu);
    var given = settings.bookColors[book.id];
    menu.appendChild(el("div", "vs-dyename", book.label));
    var row = el("div", "vs-swatches");
    SLOTS.forEach(function (colour, i) {
      var sw = /** @type {HTMLButtonElement} */ (el("button", "vs-swatch"));
      sw.type = "button";
      sw.style.setProperty("--swatch", colour);
      sw.title = "Colour " + (i + 1);
      sw.setAttribute("aria-label", sw.title);
      if (given === i) sw.setAttribute("aria-pressed", "true");
      on(sw, "click", function () { setBookColor(book, i); });
      row.appendChild(sw);
    });
    menu.appendChild(row);
    var auto = /** @type {HTMLButtonElement} */ (el("button", "vs-dyeauto", "Automatic"));
    auto.type = "button";
    if (given === undefined) auto.setAttribute("aria-pressed", "true");
    on(auto, "click", function () { setBookColor(book, null); });
    menu.appendChild(auto);

    menu.hidden = false;
    /* Placed where the pointer is, and pulled back inside the room if that would hang it off
     * the edge. Measured after it is shown, because a hidden menu has no size. */
    var host = root.getBoundingClientRect();
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.min(x - host.left, host.width - w - 8);
    var top = Math.min(y - host.top, host.height - h - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";
    var first = menu.querySelector("button");
    if (first instanceof HTMLElement) first.focus();
  }

  function closeDye() {
    dyeing = null;
    $("dye").hidden = true;
  }

  /** @param {Book} book @param {number|null} slot */
  function setBookColor(book, slot) {
    if (slot === null) delete settings.bookColors[book.id];
    else settings.bookColors[book.id] = slot;
    persist();
    closeDye();
    renderLibrary();
    applyQuery();
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
    } else {
      /* design/0015 -- ONE INDEX FOR EVERY DATE-ORDERED BOOK, however it was classified. A
       * year book, a month book and a tag book used to be cut three different ways -- months,
       * then days, then whichever single unit happened to split the book -- so the same kind
       * of tab read "Jul" in one book, "07" in another and "2024" in a third. The layered cut
       * reads the book instead of the shelf. */
      return dateTabs(book.notes);
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
   * design/0015 -- THE LAYERED DATE INDEX. Years, then the months inside a year, then the days
   * inside a month -- each layer only where it separates something:
   *
   *   - a layer with ONE group is not drawn: a book that is all 2026 does not need a 2026 tab
   *     to tell you so, and a book that is all July needs no July;
   *   - a group of THREE notes or fewer is not cut further: three notes on following days are
   *     three rows on the left, not an index;
   *   - the whole thing is capped at about thirty tabs, dropping days first and then months,
   *     because a tab you cannot hit is decoration.
   *
   * The result is the same shape for a year book, a tag book and a person's book, which is
   * what an index is for: you learn to read it once.
   * @param {ShelfNote[]} notes @returns {{ label: string, at: number, level?: number }[]}
   */
  function dateTabs(notes) {
    /** @type {{ label: string, at: number, level?: number }[]} */
    var out = [];
    var years = runsOf(notes, function (n) { return n.date ? n.date.slice(0, 4) : ""; });
    var showYears = years.length > 1;
    years.forEach(function (y) {
      if (showYears) out.push({ label: y.key, at: y.at, level: 0 });
      if (y.size <= 3) return;
      var months = runsOf(y.notes, function (n) { return n.date ? n.date.slice(0, 7) : ""; });
      var showMonths = months.length > 1;
      months.forEach(function (m) {
        if (showMonths) {
          out.push({ label: core.monthLabel(m.key).slice(0, 3), at: y.at + m.at,
                     level: showYears ? 1 : 0 });
        }
        if (m.size <= 3) return;
        var days = runsOf(m.notes, function (n) { return n.date || ""; });
        if (days.length <= 1) return;
        days.forEach(function (d) {
          out.push({ label: d.key.slice(8), at: y.at + m.at + d.at,
                     level: (showYears ? 1 : 0) + (showMonths ? 1 : 0) });
        });
      });
    });
    var deepest = out.reduce(function (max, t) { return Math.max(max, t.level || 0); }, 0);
    while (out.length > 30 && deepest > 0) {
      var drop = deepest;
      out = out.filter(function (t) { return (t.level || 0) < drop; });
      deepest--;
    }
    return out;
  }

  /**
   * Consecutive runs of notes sharing a key, in the order they stand; a note with no key
   * (undated) belongs to no run and is skipped.
   * @param {ShelfNote[]} notes @param {function(ShelfNote): string} keyOf
   * @returns {{ key: string, at: number, size: number, notes: ShelfNote[] }[]}
   */
  function runsOf(notes, keyOf) {
    /** @type {{ key: string, at: number, size: number, notes: ShelfNote[] }[]} */
    var runs = [];
    notes.forEach(function (n, i) {
      var key = keyOf(n);
      if (!key) return;
      var last = runs[runs.length - 1];
      if (last && last.key === key) { last.size++; last.notes.push(n); return; }
      runs.push({ key: key, at: i, size: 1, notes: [n] });
    });
    /* `at` inside a run's own notes has to be relative to that run, which is what the
     * nested cuts add up from. The notes array is a copy, so its indices start at zero. */
    return runs;
  }

  function renderTabs() {
    var box = $("tabs");
    clear(box);
    indexSections(reader.book).forEach(function (section) {
      var b = el("button", "", section.label);
      b.type = "button";
      b.setAttribute("data-level", String(section.level || 0));
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

  /**
   * A line of the fallback renderer's text with its `[[wikilinks]]` made into links the
   * library can follow (design/0004). Inside Obsidian the app's renderer does this; here it
   * is the one thing a standalone page needed to make a note more than a dead end.
   * @param {string} tag @param {string} text @returns {HTMLElement}
   */
  function linked(tag, text) {
    var out = el(tag);
    var re = /\[\[([^\]|#^]+)(?:[#^][^\]|]*)?(?:\|([^\]]*))?\]\]/g;
    var at = 0;
    var m = re.exec(text);
    while (m !== null) {
      if (m.index > at) out.appendChild(DOC.createTextNode(text.slice(at, m.index)));
      var target = noteByLink(m[1]);
      var label = (m[2] || m[1]).trim();
      if (target) {
        var a = el("a", "vs-link", label);
        a.setAttribute("href", "#");
        a.setAttribute("data-note", target.id);
        out.appendChild(a);
      } else {
        out.appendChild(el("span", "vs-deadlink", label));
      }
      at = m.index + m[0].length;
      m = re.exec(text);
    }
    if (at < text.length) out.appendChild(DOC.createTextNode(text.slice(at)));
    return out;
  }

  /** @param {HTMLElement} box @param {ShelfNote} note */
  function renderMarkdownInto(box, note) {
    var lines = String(note.body || note.excerpt || "").split("\n");
    /** @type {HTMLElement|null} */
    var list = null;
    /** @type {HTMLTableElement|null} */
    var table = null;
    lines.forEach(function (raw) {
      var line = raw.replace(/\s+$/, "");
      /* A pipe table, which the standalone's small renderer did not know at all: a run of
       * `| a | b |` lines is a table, its second line -- `|---|---|` -- is the ruling under the
       * head and is not a row. Inside Obsidian the app's renderer does this; here it is the
       * one block the fallback had no idea of, and a vault of tables read as pipe soup. */
      var cells = /^\s*\|(.*)\|\s*$/.exec(line);
      if (cells) {
        var parts = cells[1].split("|").map(function (c) { return c.trim(); });
        if (parts.every(function (c) { return /^:?-{2,}:?$/.test(c); })) return;
        if (!table) {
          table = /** @type {HTMLTableElement} */ (DOC.createElement("table"));
          box.appendChild(table);
          var tr0 = DOC.createElement("tr");
          parts.forEach(function (c) { tr0.appendChild(el("th", "", c)); });
          table.appendChild(tr0);
          return;
        }
        var tr = DOC.createElement("tr");
        parts.forEach(function (c) { tr.appendChild(el("td", "", c)); });
        table.appendChild(tr);
        return;
      }
      table = null;
      var head = /^(#{1,3})\s+(.*)$/.exec(line);
      var item = /^\s*[-*]\s+(.*)$/.exec(line);
      var quote = /^>\s?(.*)$/.exec(line);
      if (!item && list) list = null;
      if (head) { box.appendChild(linked("h" + (head[1].length + 1), head[2])); return; }
      if (item) {
        var into = list;
        if (!into) { into = el("ul"); box.appendChild(into); list = into; }
        into.appendChild(linked("li", item[1]));
        return;
      }
      if (quote) { box.appendChild(linked("blockquote", quote[1])); return; }
      if (line.trim()) box.appendChild(linked("p", line));
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

  /**
   * design/0004 -- A LINK IN A BOOK STAYS IN THE LIBRARY. Following `[[a note]]` from the
   * reading spread goes to that note in this library rather than to Obsidian's own editor:
   * in THIS book if the book holds it, else in another book on THIS shelf, else in a book on
   * the nearest shelf -- nearest by position, since the shelves a person keeps side by side
   * are the ones they think of together. Only a note the library does not hold at all is left
   * to the host, and the plugin falls through to Obsidian for exactly that case.
   * @param {string} noteId @returns {"book"|"shelf"|"near"|null}
   */
  function openNote(noteId) {
    if (!reader) return null;
    var here = reader.book;
    for (var i = 0; i < here.notes.length; i++) {
      if (here.notes[i].id === noteId) { goTo(i); return "book"; }
    }
    /** @type {{ book: Book, distance: number }|null} */
    var best = null;
    var from = shelfById(here.shelfId);
    var fromAt = from ? from.position : 0;
    views.forEach(function (v) {
      if (v.shelf.hidden) return;
      v.books.forEach(function (b) {
        if (!b.notes.some(function (n) { return n.id === noteId; })) return;
        var distance = v.shelf.id === here.shelfId ? -1 : Math.abs(v.shelf.position - fromAt);
        if (!best || distance < best.distance) best = { book: b, distance: distance };
      });
    });
    if (!best) return null;
    openBook(best.book, noteId);
    return best.distance < 0 ? "shelf" : "near";
  }

  /**
   * The note a wikilink names, if this library holds it. Obsidian resolves a link by the
   * shortest unique path; here the exporter has already given every note a vault-relative id,
   * so a target is matched on its full path, then on its title -- which is what a link that
   * is only a title means when the title is unique.
   * @param {string} target @returns {ShelfNote|null}
   */
  function noteByLink(target) {
    var want = target.replace(/\.md$/i, "").trim().toLowerCase();
    if (!want) return null;
    var byPath = null, byTitle = null;
    notes.forEach(function (n) {
      var id = n.id.replace(/\.md$/i, "").toLowerCase();
      if (id === want) byPath = n;
      else if (!byTitle && n.title.toLowerCase() === want) byTitle = n;
    });
    return byPath || byTitle;
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
    order.options[0].textContent = dated ? "Reading order (top bar)" : "A to Z";
    order.options[1].textContent = dated ? "Newest first" : "Z to A";
    /* design/0015 -- a date shelf takes its direction from the top bar, so the second automatic
     * answer here is not a second answer, it is the same one written twice. It is taken off the
     * list rather than greyed, because the control itself is no longer disabled: design/0018
     * puts a third option under it that every classifier can be given. */
    order.options[1].hidden = dated;
    order.value = d.direction === "manual" ? "manual"
                : dated && d.direction === "chronological" ? "alphabetical" : d.direction;
    order.title = d.direction === "manual"
      ? "The books stay where you put them. Drag a spine along the shelf, or Alt+Left and " +
        "Alt+Right from the keyboard."
      : dated ? "Date shelves follow the reading order in the top bar." : "";
    field("bplaques").checked = !!d.plaques;
    field("bplaques").disabled = !PLAQUABLE[d.classifier];
    field("bsubtags").checked = d.includeSubtags !== false;
    field("bvary").checked = !!d.varyColors;
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
    var picked = field("bdirection").value;
    d.direction = picked === "manual" ? "manual"
                : picked === "chronological" ? "chronological" : "alphabetical";
    d.plaques = !!PLAQUABLE[d.classifier] && field("bplaques").checked;
    d.includeSubtags = field("bsubtags").checked;
    d.varyColors = field("bvary").checked;
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
    box.appendChild(renderTrack(view.books.slice(0, 60), draft, false));
  }

  function saveBuilder() {
    readBuilderFields();
    var draft = builder.draft;
    seedOrder(draft, builder.editing ? shelfById(builder.editing) : null);
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

  /**
   * design/0018 -- SWITCHING TO "ARRANGED BY HAND" MOVES NOTHING. The sequence is written out
   * the moment the shelf becomes manual, from the order it was standing in a second earlier, so
   * the books do not shuffle on the way in and the reading order in the top bar cannot reach
   * them afterwards. Built over the unfiltered notes, for the same reason `arrangeBook` is.
   * A shelf switched back to A-to-Z keeps its list, because switching back again should return
   * the arrangement rather than lose it -- hiding never deletes, and neither does this.
   * @param {Shelf} draft @param {Shelf|null} previous
   */
  function seedOrder(draft, previous) {
    if (draft.direction !== "manual") return;
    if (draft.order && draft.order.length) return;
    var was = core.clone(draft);
    was.direction = previous && previous.direction !== "manual"
      ? previous.direction : "alphabetical";
    draft.order = core.buildShelf(was, notes, settings.noteOrder).books
      .map(function (bk) { return bk.key; });
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
    renderPalette();
    var box = $("managelist");
    clear(box);
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    ordered.forEach(function (shelf, i) {
      var row = el("div", "vs-managerow");
      row.appendChild(el("span", "vs-name", shelf.name));
      row.appendChild(el("span", "vs-meta", shelf.classifier));

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

      /* github#4 -- SHOWN IS A FACT, NOT AN ACTION. A button that said "Hide" on one row and
       * "Show" on the next read differently depending on the state it was in; a switch reads
       * the same way whichever way it is set, like Vary colours beside it. Hiding still never
       * deletes, and "Show every shelf" is still at the foot of the sheet. */
      var shown = el("label", "vs-toggle");
      shown.setAttribute("data-fact", "shown");
      var vis = /** @type {HTMLInputElement} */ (DOC.createElement("input"));
      vis.type = "checkbox";
      vis.setAttribute("role", "switch");
      vis.checked = !shelf.hidden;
      vis.setAttribute("aria-label", shelf.name + " shown");
      shown.title = "Off takes this shelf out of the library. Hiding never deletes: the shelf " +
                    "keeps its definition and its books.";
      shown.appendChild(vis);
      shown.appendChild(el("span", "vs-knob"));
      shown.appendChild(el("span", "vs-togglename", "Shown"));
      on(vis, "change", function () {
        shelf.hidden = !vis.checked;
        persist();
        renderManage();
        refresh();
      });

      var edit = el("button", "", "Edit");
      edit.type = "button";
      on(edit, "click", function () { $("manage").hidden = true; openBuilder(shelf); });

      /* design/0005 -- per shelf, and it says what it IS. */
      /* design/0005 -- A TOGGLE, because it is a state and not an action: a button that
       * reads "Vary colours" says what pressing it does, and a switch says what is so. */
      var vary = el("label", "vs-toggle");
      vary.setAttribute("data-fact", "vary");
      var sw = /** @type {HTMLInputElement} */ (DOC.createElement("input"));
      sw.type = "checkbox";
      sw.setAttribute("role", "switch");
      sw.checked = !!shelf.varyColors;
      sw.setAttribute("aria-label", "Vary colours on " + shelf.name);
      vary.title = "Each book on this shelf in a colour of its own, rather than its folder's";
      vary.appendChild(sw);
      vary.appendChild(el("span", "vs-knob"));
      vary.appendChild(el("span", "vs-togglename", "Vary colours"));
      on(sw, "change", function () {
        shelf.varyColors = sw.checked;
        persist();
        refresh();
      });

      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(shown);
      row.appendChild(vary);
      row.appendChild(edit);
      box.appendChild(row);
    });
  }

  /**
   * design/0005 -- THE TWELVE, EDITABLE. Twelve slots showing what the cascade currently
   * resolves -- the look's own until a person changes one, at which point all twelve become
   * theirs, because a palette with one chosen colour and eleven that change with the look is
   * not a palette anybody chose. github#4 -- drawn as painted, numbered swatches rather than
   * bare colour inputs, each marked when it is no longer the look's own, with the ribbon
   * beside them and one reset for the lot.
   */
  function renderPalette() {
    var box = $("mpalette");
    clear(box);
    var chosen = settings.palette.length === 12;
    SLOTS.forEach(function (colour, i) {
      var changed = chosen && toHex(colour) !== OWN.slots[i];
      box.appendChild(slotControl(colour, "Colour " + (i + 1), i + 1, changed,
        function (hex) { pickSlot(i, hex); },
        function () { resetSlot(i); }));
    });
    var ribbonBox = $("mribbon");
    clear(ribbonBox);
    var ribbon = settings.ribbon || OWN.ribbon;
    ribbonBox.appendChild(slotControl(ribbon, "Ribbon", "", !!settings.ribbon,
      function (hex) { setRibbon(hex); },
      function () { setRibbon(""); }));
    /* Disabled when there is nothing to put back, so the button says whether anything here
     * is the person's. */
    /** @type {HTMLButtonElement} */ (node("mpalettereset")).disabled = !chosen && !settings.ribbon;
  }

  /**
   * github#4 -- ONE PAINTED SLOT: a swatch that shows its colour and its number, the native
   * picker behind it, and -- only when the slot is no longer the look's own -- the mark that
   * puts it back. The mark is the reset, because "this one is changed" and "undo this one"
   * are the same fact about the same slot, and a corner badge is found by looking where a
   * right-click has to be known about.
   * @param {string} colour @param {string} name @param {string|number} tag
   * @param {boolean} changed
   * @param {(hex: string) => void} pick @param {() => void} reset
   * @returns {HTMLElement}
   */
  function slotControl(colour, name, tag, changed, pick, reset) {
    var slot = el("span", "vs-slot");
    var hex = toHex(colour);
    var sw = /** @type {HTMLButtonElement} */ (el("button", "vs-swatch"));
    sw.type = "button";
    sw.style.setProperty("--swatch", colour);
    sw.style.setProperty("--swatch-ink", inkOn(hex));
    sw.title = name + " " + hex + (changed ? ", changed from the look's own" : "");
    sw.setAttribute("aria-label", sw.title);
    if (changed) sw.setAttribute("data-changed", "1");
    if (tag !== "") sw.appendChild(el("span", "vs-n", tag));
    var input = /** @type {HTMLInputElement} */ (DOC.createElement("input"));
    input.type = "color";
    input.value = hex;
    input.tabIndex = -1;
    input.setAttribute("aria-label", "Pick " + name);
    on(sw, "click", function () { input.click(); });
    on(input, "change", function () { pick(input.value.toLowerCase()); });
    slot.appendChild(sw);
    slot.appendChild(input);
    if (changed) {
      var x = /** @type {HTMLButtonElement} */ (el("button", "vs-slotreset", "\u00d7"));
      x.type = "button";
      x.title = "Back to the look's own";
      x.setAttribute("aria-label", "Reset " + name + " to the look's own");
      on(x, "click", reset);
      slot.appendChild(x);
    }
    return slot;
  }

  /**
   * The ink a slot's number is written in: dark on a light dye, light on a dark one, by
   * relative luminance of the hex.
   * @param {string} hex @returns {string}
   */
  function inkOn(hex) {
    /** @param {string} c */
    var lin = function (c) {
      var v = parseInt(c, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    var l = 0.2126 * lin(hex.slice(1, 3)) + 0.7152 * lin(hex.slice(3, 5)) + 0.0722 * lin(hex.slice(5, 7));
    return l > 0.4 ? "#1a1a1a" : "#ffffff";
  }

  /** @param {number} i @param {string} hex */
  function pickSlot(i, hex) {
    var next = settings.palette.length === 12 ? settings.palette.slice() : OWN.slots.slice();
    next[i] = hex;
    setPalette(next);
  }

  /** github#4 -- one slot back to the look's own; the other eleven stay the person's. */
  /** @param {number} i */
  function resetSlot(i) {
    if (settings.palette.length !== 12) return;
    var next = settings.palette.slice();
    next[i] = OWN.slots[i];
    setPalette(next);
  }

  /**
   * Twelve that are all the look's own are not a palette anybody chose, so they are saved as
   * none: the file says "the look's own" and follows the look, rather than pinning one look's
   * colours under every other.
   * @param {string[]} next
   */
  function setPalette(next) {
    var own = next.every(function (hex, i) { return hex === OWN.slots[i]; });
    settings.palette = own ? [] : next;
    persist();
    readTheme();
    refresh();
    renderPalette();
  }

  /** @param {string} hex -- empty for the look's own */
  function setRibbon(hex) {
    settings.ribbon = hex === OWN.ribbon ? "" : hex;
    persist();
    readTheme();
    refresh();
    renderPalette();
  }

  /**
   * A colour input takes only #rrggbb, and the cascade hands back whatever the stylesheet
   * wrote -- `rgb(…)`, `color(srgb …)`, a hex with alpha. Resolved through the document
   * rather than parsed by hand.
   * @param {string} colour @returns {string}
   */
  function toHex(colour) {
    if (/^#[0-9a-f]{6}$/i.test(colour)) return colour.toLowerCase();
    var probe = DOC.createElement("span");
    probe.style.color = colour;
    root.appendChild(probe);
    var rgb = WIN.getComputedStyle(probe).color;
    root.removeChild(probe);
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
    if (!m) return "#6f6e67";
    var hex = function (n) { return ("0" + Number(n).toString(16)).slice(-2); };
    return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
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
    core.offeredLooks().forEach(function (look) {
      var o = DOC.createElement("option");
      o.value = look.value;
      o.textContent = look.name;
      select.appendChild(o);
    });
    select.value = core.isOffered(settings.look) ? settings.look : "";
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
    /* isLook, not isOffered: a shelved look can still be painted through the debug handle so
     * the suite keeps measuring it (design/0017); a person only ever reaches an offered one. */
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
  /* github#4 -- palette and ribbon together; a slot's own mark puts one slot back. */
  on($("mpalettereset"), "click", function () {
    settings.palette = [];
    settings.ribbon = "";
    persist();
    readTheme();
    refresh();
    renderPalette();
  });
  /* The dye menu closes the way a menu does: a click anywhere else, or Escape. */
  on(DOC, "mousedown", function (e) {
    if (dyeing && e.target instanceof Node && !$("dye").contains(e.target)) closeDye();
  });
  on(DOC, "keydown", function (e) {
    if (dyeing && /** @type {KeyboardEvent} */ (e).key === "Escape") closeDye();
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
   "bplaques", "bsubtags", "bvary"].forEach(function (id) {
    on($(id), "change", function () { readBuilderFields(); previewBuilder(); });
    on($(id), "input", function () { readBuilderFields(); previewBuilder(); });
  });

  on($("back"), "click", closeReader);
  on($("prevcollection"), "click", previousCollection);
  /* design/0004 -- CLICKING OFF THE BOOK PUTS IT DOWN. The dark around the spread is the
   * desk; a click on it, and not on the book, the ribbons or the bar, goes back to the
   * shelves. Both ends of the click have to be off the book, or dragging a text selection out
   * past the cover would close it on release. */
  var pressedOffBook = false;
  var offBook = function (target) {
    if (!(target instanceof Element)) return false;
    return !target.closest(".vs-spread, #vs-marks, .vs-readerbar, #vs-dye");
  };
  on($("reader"), "mousedown", function (e) { pressedOffBook = offBook(e.target); });
  on($("reader"), "click", function (e) {
    if (reader && pressedOffBook && offBook(e.target)) closeReader();
    pressedOffBook = false;
  });

  on($("note"), "click", function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    var a = t.closest("a.vs-link");
    if (!(a instanceof HTMLElement)) return;
    e.preventDefault();
    openNote(a.getAttribute("data-note") || "");
  });

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
    /* design/0018 -- the same move as a drop, without a pointer. It is read off the FOCUSED
     * spine, so it can only ever move the book the person is standing on, and it is tried
     * before the reader's own Alt+Left because a spine cannot be focused while a book is open. */
    if (!reader && e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      var at = e.target instanceof Element
        ? /** @type {HTMLElement|null} */ (e.target.closest(".vs-spine[data-hand]")) : null;
      if (at && nudge(at, e.key === "ArrowRight" ? 1 : -1)) { e.preventDefault(); return; }
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
    /** design/0004 -- where a link went: "book", "shelf", "near" or null. */
    openNote: openNote,
    /**
     * design/0017 -- paint any look core knows, offered or shelved, without saving it. The
     * selector is the person's path and only lists offered looks; this is the suite's, so a
     * shelved stylesheet keeps being measured. @param {string} value
     */
    setLook: function (value) {
      if (!core.isLook(value)) return false;
      settings.look = value;
      refresh();
      return true;
    },
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
    /** design/0014 -- the room as packed, and what the resize watcher has seen. */
    room: function () { return { width: roomWidth, resizes: roomLog.resizes, measured: roomLog.measured, last: roomLog.last }; },
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
    /**
     * design/0018 -- one shelf's books in the order they are standing in, as keys. The
     * addresses are in `addresses()`; this is the other half of the same question, and the
     * only thing a manual shelf is allowed to change.
     * @param {string} shelfId
     */
    sequence: function (shelfId) {
      var view = views.filter(function (v) { return v.shelf.id === shelfId; })[0];
      return view ? view.books.map(function (b) { return b.key; }) : [];
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
    /**
     * design/0004 -- the host's renderer emits links it cannot follow itself; it hands the
     * target here first, and only when the library does not hold that note does it fall
     * through to opening it in the host.
     * @param {string} noteId @returns {boolean}
     */
    openNote: function (noteId) { return openNote(noteId) !== null; },
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
