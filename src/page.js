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
  /** @type {{ book: Book, index: number, noteId: string|null, within: string, opener: HTMLElement|null, revealed?: string|null, tabs?: Section[]|null }|null} */
  var reader = null;
  /** @type {{ bookId: string, noteId: string|null }[]} */
  var history = [];
  /** @type {{ editing: string|null, draft: Shelf, at: "top"|"end" }|null} */
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
   * github#4 -- THE LOOK'S OWN twelve, as hex, read with the person's choice lifted off, and
   * the twelve ribbons that fall out of them. Manage compares a slot against these to say
   * whether it has been changed, and a per-slot reset writes one of them back.
   * @type {{ slots: string[], ribbons: string[] }}
   */
  var OWN = { slots: [], ribbons: [] };

  function readTheme() {
    SLOT_KEYS.forEach(function (k) { root.style.removeProperty(k); });
    root.style.removeProperty("--ribbon");
    var bare = WIN.getComputedStyle(root);
    OWN.slots = SLOT_KEYS.map(function (k) {
      return toHex((bare.getPropertyValue(k) || "").trim() || "#6f6e67");
    });
    OWN.ribbons = OWN.slots.map(threadOf);

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
    bookIndex = {};
    thickest = 1;
    /* design/0019 -- built as a library rather than shelf by shelf, so a pick shelf at
     * position 0 is resolved against the shelves that come after it. */
    views = core.buildLibrary(settings.shelves, visible, settings.noteOrder);
    views.forEach(function (view) {
      view.books.forEach(function (book) {
        book.bands.forEach(function (band) { band.slot = slotOf[band.folder] || "#6f6e67"; });
        bookIndex[book.id] = book;
        if (book.notes.length > thickest) thickest = book.notes.length;
      });
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
      var book = core.resolveReading(mark.noteId, mark.bookId, views, settings.noteOrder);
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
    uprightFit = {};
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
      /* github#0 -- AN EMPTY ROOM HAS TWO CAUSES NOW, and they need different words: every
       * shelf hidden is recoverable in one click, and every shelf deleted is not. Telling a
       * person nothing was deleted when they have just deleted everything is the worst kind
       * of wrong. */
      var none = settings.shelves.length === 0;
      card.appendChild(el("p", "", none
        ? "There are no shelves. The six the library opens with can be built again, or make " +
          "your own."
        : "Every shelf is hidden. Nothing was deleted -- Manage brings them back."));
      var restore = el("button", "vs-primary", none ? "Build the default shelves" : "Show every shelf");
      restore.type = "button";
      on(restore, "click", function () {
        if (none) settings.shelves = core.defaultShelves();
        else settings.shelves.forEach(function (s) { s.hidden = false; });
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
    /* design/0020 -- the keyboard's way to make a book. */
    if (view.shelf.direction === "manual") {
      var make = el("button", "", "New book");
      make.type = "button";
      on(make, "click", function () { openMadeBook(view.shelf, null, null); });
      menu.appendChild(make);
    }
    head.appendChild(menu);
    wrap.appendChild(head);

    /* design/0020 -- a hand-arranged shelf ends in a plus. */
    var makes = view.shelf.direction === "manual";
    var rail = el("div", "vs-shelfrail");
    var rows = rowsOf(view.books, makes ? SPINE_MIN + SPINE_GAP : 0);
    rows.forEach(function (row, i) {
      var last = i === rows.length - 1;
      rail.appendChild(renderTrack(row, view.shelf, true, makes && last ? plusOf(view.shelf) : null));
    });
    if (isPick(view.shelf)) landingOf(rail, view);
    if (makes) offersBook(rail, view);
    wrap.appendChild(rail);
    return wrap;
  }

  /** design/0020 -- the plus: a spine's height, quiet until hovered.
   * @param {Shelf} shelf @returns {HTMLElement} */
  function plusOf(shelf) {
    var plus = /** @type {HTMLButtonElement} */ (el("button", "vs-plusbook", "+"));
    plus.type = "button";
    plus.setAttribute("aria-label", "New book on " + shelf.name);
    plus.setAttribute("data-peek", "Make a book here: a name, and what it holds.");
    on(plus, "click", function () { openMadeBook(shelf, null, null); });
    on(plus, "mouseenter", function () { showPeek(plus); });
    on(plus, "mouseleave", hidePeek);
    return plus;
  }

  /**
   * design/0019 -- THE WHOLE RAIL TAKES A DROP, not only the spines on it: an empty shelf has
   * no spine to aim at, and a drop past the last book means "at the end". A spine that is
   * under the pointer answers first and this stays out of its way. The empty shelf says what
   * it is for, in words, in the row where the books will stand -- a blank board reads as a
   * broken shelf, and a hidden one as no shelf at all.
   * @param {HTMLElement} rail @param {ShelfView} view
   */
  function landingOf(rail, view) {
    rail.setAttribute("data-pick", "1");
    if (!view.books.length && rail.firstChild) {
      rail.firstChild.appendChild(el("div", "vs-dropzone",
        "Drag a book here, or right-click to make one"));
    }
    /** @param {Event} e @returns {boolean} */
    var overSpine = function (e) {
      return e.target instanceof Element &&
             !!(e.target.closest(".vs-spine") || e.target.closest(".vs-floorgrip"));
    };
    /* design/0020 -- another pick shelf's rail does not take a made book. */
    var refused = function () { return !dragging || core.isMadeKey(dragging.key); };
    on(rail, "dragover", function (e) {
      var de = /** @type {DragEvent} */ (e);
      /* A rail with books on it is the row's business (`takesBooks`); this is the empty one. */
      if (refused() || overSpine(de) || rail.querySelector(".vs-spine")) return;
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = "move";
      markLanding(rail);
      var carried = carriedSpine();
      if (carried) carried.removeAttribute("data-leaving");
    });
    on(rail, "dragleave", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (!(de.relatedTarget instanceof Node) || !rail.contains(de.relatedTarget)) clearDrop();
    });
    on(rail, "drop", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (refused() || overSpine(de) || rail.querySelector(".vs-spine")) return;
      de.preventDefault();
      var sourceId = carriedInto(view.shelf);
      dragging = null;
      clearDrop();
      arrangeBook(view.shelf, sourceId, null, core.bookId(view.shelf.id, sourceId));
    });
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
  function rowsOf(books, tail) {
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
    /* design/0020 -- the plus at the end needs its own room, or its own row. */
    if (tail && row.length && used + tail > avail) { rows.push(row); row = []; }
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
      /* github#32 -- the rail packs against the spread's HEIGHT, so a window that changed
       * shape re-fits the index even when the room it left is the same width. */
      if (reader) { reader.tabs = null; renderTabs(); }
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
  function renderTrack(books, shelf, hand, tail) {
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
      if (group.plaque !== null) {
        /* github#6, design/0019 */
        var plate = el("button", "vs-plaque", group.plaque);
        plate.type = "button";
        var first = group.books[0];
        on(plate, "click", function () { openPlaque(shelf, first); });
        g.appendChild(plate);
      }
      track.appendChild(g);
    });
    /* github#0 -- THE BOARD IS THE HANDLE. The floor is painted as a background on the track
     * (design/0014) and every look paints its own, so the thing you grab is a strip laid over
     * it rather than a floor rebuilt as an element -- that way one grip serves three looks and
     * none of their stylesheets has to know. `hand` is false in the builder's preview, which
     * is not a shelf anybody can rearrange. */
    if (tail) track.appendChild(tail);
    if (hand) track.appendChild(gripOf(shelf));
    if (hand && (shelf.direction === "manual" || isPick(shelf))) takesBooks(track, shelf);
    return track;
  }

  /* github#6, design/0019 */
  /** @param {Shelf} shelf @param {Book} under */
  function openPlaque(shelf, under) {
    var view = viewById(shelf.id);
    if (!view) return;
    var run = core.runsOf(view.books).filter(function (r) {
      return r.books.some(function (b) { return b.id === under.id; });
    })[0];
    if (!run) return;
    var book = core.plaqueBook(view, run.books, settings.noteOrder);
    if (book) openBook(book, null);
  }

  /** @param {string} shelfId @returns {import("./core/index").ShelfView|null} */
  function viewById(shelfId) {
    for (var i = 0; i < views.length; i++) if (views[i].shelf.id === shelfId) return views[i];
    return null;
  }

  /** @type {Record<string, boolean>} */
  var uprightFit = {};

  /* github#12, design/0002 -- three characters stand upright only when they fit the spine. */
  /** @param {string} cover @param {number} width @returns {boolean} */
  function fitsUpright(cover, width) {
    var key = cover + "|" + width;
    if (key in uprightFit) return uprightFit[key];
    var probe = el("div", "vs-probe");
    var spine = el("button", "vs-spine");
    spine.setAttribute("data-upright", "1");
    spine.style.setProperty("--spine-w", width + "px");
    var title = el("span", "vs-title", cover);
    spine.appendChild(title);
    probe.appendChild(spine);
    root.appendChild(probe);
    var fits = title.scrollWidth <= title.clientWidth;
    root.removeChild(probe);
    uprightFit[key] = fits;
    return fits;
  }

  /**
   * github#0 -- THE ROW DECIDES, NOT THE BOOK UNDER THE POINTER. Each spine used to answer
   * `dragover` for itself, which is where the flake was: the gap a mark opens is the target's
   * own margin, so the moment it opened the pointer was in the gap rather than on the book,
   * the spine stopped hearing the drag, the mark cleared, the gap shut, and the pointer was
   * back on the book. Twice a second. The row hears the whole drag instead and works out the
   * place from geometry, so opening a gap cannot take the target away from the pointer.
   * @param {HTMLElement} track @param {Shelf} shelf
   */
  function takesBooks(track, shelf) {
    /** @returns {boolean} */
    var takes = function () {
      if (!dragging) return false;
      if (dragging.shelfId === shelf.id) return true;
      /* design/0020 -- a made book is its own shelf's; no other shelf takes it. */
      return isPick(shelf) && !onShelf(shelf, dragging.id) && !core.isMadeKey(dragging.key);
    };
    on(track, "dragover", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (!takes() || (e.target instanceof Element && e.target.closest(".vs-floorgrip"))) return;
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = "move";
      var place = placeIn(track, de.clientX);
      if (place.spine) markDrop(place.spine, place.side);
      var carried = carriedSpine();
      if (carried) carried.removeAttribute("data-leaving");
    });
    on(track, "dragleave", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (!(de.relatedTarget instanceof Node) || !track.contains(de.relatedTarget)) clearDrop();
    });
    on(track, "drop", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (!takes()) return;
      de.preventDefault();
      var place = placeIn(track, de.clientX);
      var moved = carriedInto(shelf);
      dragging = null;
      clearDrop();
      if (!moved) return;
      var before = place.spine
        ? (place.side === "before" ? keyOfSpine(place.spine) : afterKey(shelf, place.spine, moved))
        : null;
      if (before === moved) return;
      arrangeBook(shelf, moved, before, core.bookId(shelf.id, moved));
    });
  }

  /**
   * Which gap in this row the pointer is in: the first book whose middle the pointer has not
   * passed, or the last book's right-hand side. The book being carried is not a candidate --
   * it is the one being taken out of the row.
   * @param {HTMLElement} track @param {number} x
   * @returns {{ spine: HTMLElement|null, side: "before"|"after" }}
   */
  function placeIn(track, x) {
    /** @type {HTMLElement[]} */
    var spines = [];
    var all = track.querySelectorAll(".vs-spine");
    for (var k = 0; k < all.length; k++) {
      var sp = /** @type {HTMLElement} */ (all[k]);
      if (sp.getAttribute("data-dragging") !== "1") spines.push(sp);
    }
    if (!spines.length) return { spine: null, side: "before" };
    for (var i = 0; i < spines.length; i++) {
      var box = spines[i].getBoundingClientRect();
      if (x < box.left + box.width / 2) return { spine: spines[i], side: "before" };
    }
    return { spine: spines[spines.length - 1], side: "after" };
  }

  /** @param {HTMLElement} spine @returns {string} */
  function keyOfSpine(spine) {
    var book = bookIndex[spine.getAttribute("data-book") || ""];
    return book ? book.key : "";
  }

  /** The key after this spine, off the shelf as drawn, with the carried book taken out. */
  /** @param {Shelf} shelf @param {HTMLElement} spine @param {string} movedKey @returns {string|null} */
  function afterKey(shelf, spine, movedKey) {
    return neighbour(shelf, keyOfSpine(spine), "after", movedKey);
  }

  /** @param {Shelf} shelf @param {string} sourceId @returns {boolean} */
  function onShelf(shelf, sourceId) {
    return (shelf.picks || []).indexOf(sourceId) >= 0;
  }

  /* ---- a shelf carried by its floor ------------------------------------------
   * github#0 -- "make the shelf floor draggable to re arrange shelves". Manage has had arrows
   * for this all along; what it did not have is the thing a person reaches for, which is the
   * shelf itself. The books on a shelf are dragged by their spines and the shelf is dragged by
   * its board, so the two gestures cannot be confused: a spine is a book, a board is a shelf.
   */

  /** @type {{ id: string }|null} */
  var shelfDrag = null;
  /** @type {HTMLElement|null} */
  var shelfMark = null;

  /** github#0 -- the space a carried shelf is making for itself. @type {HTMLElement|null} */
  var shelfGhost = null;

  /**
   * github#0 -- "let me drag the whole shelf with preview and make space for it while
   * dragging". A 3px bar in a tall room says nothing about where a shelf of eleven rows is
   * going to sit. The shelf is lifted out of the room instead, and a box of its own height --
   * named, and outlined -- is put in wherever it would land. The room really does make space:
   * everything below the ghost is pushed down by the height of the thing being carried.
   * @param {Shelf} shelf @param {HTMLElement} section
   */
  function liftShelf(shelf, section) {
    /* github#0 -- ONCE ONLY. Two things ask for the lift -- the tick after dragstart, and the
     * first dragover if that tick has not landed yet -- and a second ghost would be left in the
     * room when the first is forgotten. */
    if (shelfGhost) return;
    var box = section.getBoundingClientRect();
    var ghost = el("div", "vs-shelfghost");
    ghost.style.height = Math.round(box.height) + "px";
    var view = views.filter(function (v) { return v.shelf.id === shelf.id; })[0];
    ghost.appendChild(el("span", "vs-ghostname", shelf.name));
    if (view) {
      ghost.appendChild(el("span", "vs-ghostmeta",
        view.books.length + (view.books.length === 1 ? " book" : " books")));
    }
    section.parentNode.insertBefore(ghost, section);
    section.setAttribute("data-carrying", "1");
    shelfGhost = ghost;
  }

  function dropShelfGhost() {
    if (shelfGhost && shelfGhost.parentNode) shelfGhost.parentNode.removeChild(shelfGhost);
    shelfGhost = null;
    var carried = $("shelves").querySelector("[data-carrying]");
    if (carried) carried.removeAttribute("data-carrying");
  }

  /** @param {Shelf} shelf @returns {HTMLElement} */
  function gripOf(shelf) {
    var grip = el("div", "vs-floorgrip");
    grip.draggable = true;
    grip.setAttribute("data-grip", shelf.id);
    grip.title = "Drag the shelf by its floor to move it. Manage has arrows for the same move.";
    on(grip, "dragstart", function (e) {
      var de = /** @type {DragEvent} */ (e);
      shelfDrag = { id: shelf.id };
      if (de.dataTransfer) {
        de.dataTransfer.effectAllowed = "move";
        de.dataTransfer.setData("text/plain", shelf.id);
      }
      var section = sectionOf(shelf.id);
      /* github#0 -- HIDING THE SOURCE IN THE SAME TICK CANCELS THE DRAG. Chrome takes the drag
       * image from the element and then keeps watching it; taking it out of the layout inside
       * the dragstart handler ends the gesture before it has begun, which is how shelf dragging
       * stopped working at all while every check still passed -- a synthetic DragEvent has no
       * such lifecycle to lose. The lift happens on the next tick, once the drag is real. */
      if (section) WIN.setTimeout(function () { if (shelfDrag) liftShelf(shelf, section); }, 0);
    });
    on(grip, "dragend", function () {
      shelfDrag = null;
      clearShelfMark();
      dropShelfGhost();
    });
    return grip;
  }

  /** @param {string} id @returns {HTMLElement|null} */
  function sectionOf(id) {
    return /** @type {HTMLElement|null} */ (
      $("shelves").querySelector('[data-shelf="' + cssEscape(id) + '"]'));
  }

  /** @param {HTMLElement} section @param {"before"|"after"} side */
  function markShelf(section, side) {
    if (shelfMark === section && section.getAttribute("data-shelfdrop") === side) return;
    clearShelfMark();
    shelfMark = section;
    section.setAttribute("data-shelfdrop", side);
  }

  function clearShelfMark() {
    if (shelfMark) shelfMark.removeAttribute("data-shelfdrop");
    shelfMark = null;
  }

  /**
   * github#0 -- the shelf the pointer is over, and which half of it, so a drop means "above
   * this one" or "below it" rather than an index into a list that is being rearranged.
   * @param {DragEvent} e @returns {{ section: HTMLElement, id: string, side: "before"|"after" }|null}
   */
  function shelfUnder(e) {
    if (!shelfDrag) return null;
    /* github#0 -- GEOMETRY, NOT WHATEVER IS UNDER THE POINTER, and for the same reason the row
     * hears a book drag (design/0018): the ghost this gesture inserts takes the pointer off the
     * shelf it was over, `closest("[data-shelf]")` then finds nothing, the dragover stops being
     * accepted -- and a dragover nobody accepts means NO DROP AT ALL. The shelf order is read
     * off the page instead: the first shelf whose middle the pointer has not passed. */
    var sections = $("shelves").querySelectorAll("[data-shelf]");
    /** @type {HTMLElement|null} */
    var last = null;
    for (var i = 0; i < sections.length; i++) {
      var sec = /** @type {HTMLElement} */ (sections[i]);
      var id = sec.getAttribute("data-shelf") || "";
      if (!id || id === "-reading") continue;
      last = sec;
      var box = sec.getBoundingClientRect();
      if (e.clientY < box.top + box.height / 2) {
        return { section: sec, id: id, side: /** @type {"before"} */ ("before") };
      }
    }
    if (!last) return null;
    return { section: last, id: last.getAttribute("data-shelf") || "",
             side: /** @type {"after"} */ ("after") };
  }

  /**
   * github#0 -- the move, as "before which shelf", for the same reason a book's is
   * (design/0018): it survives a list that is not in the order the settings file holds.
   * @param {string} id @param {string} beforeId @param {"before"|"after"} side
   */
  function moveShelf(id, beforeId, side) {
    var ordered = settings.shelves.slice().sort(function (a, b) { return a.position - b.position; });
    var moved = ordered.filter(function (s_) { return s_.id === id; })[0];
    if (!moved) return;
    var rest = ordered.filter(function (s_) { return s_.id !== id; });
    var at = -1;
    rest.forEach(function (s_, k) { if (s_.id === beforeId) at = k; });
    if (at < 0) return;
    rest.splice(side === "after" ? at + 1 : at, 0, moved);
    rest.forEach(function (s_, k) { s_.position = k; });
    persist();
    refresh();
  }

  /** github#0 -- the library takes the drop, so a shelf can be dropped anywhere on another one. */
  /** @param {HTMLElement} box */
  function shelfDropZone(box) {
    on(box, "dragover", function (e) {
      var de = /** @type {DragEvent} */ (e);
      var over = shelfUnder(de);
      if (!over) return;
      /* belt and braces: if the lift has not landed yet, do it now rather than miss the move */
      if (!shelfGhost && shelfDrag) {
        var mine = shelfById(shelfDrag.id);
        var sec = sectionOf(shelfDrag.id);
        if (mine && sec) liftShelf(mine, sec);
      }
      if (!shelfGhost) return;
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = "move";
      /* The ghost IS the indicator: it moves to where the shelf would land and the room shifts
       * around it, so there is nothing to read off a hairline. */
      var at = over.side === "after" ? over.section.nextSibling : over.section;
      if (at !== shelfGhost) box.insertBefore(shelfGhost, at);
      markShelf(over.section, over.side);
    });
    on(box, "drop", function (e) {
      var de = /** @type {DragEvent} */ (e);
      if (!shelfDrag || !shelfGhost) return;
      de.preventDefault();
      var id = shelfDrag.id;
      /* Where the space was made is where it goes: the section after the ghost, or the end. */
      var next = shelfGhost.nextElementSibling;
      while (next && !next.getAttribute("data-shelf")) next = next.nextElementSibling;
      var before = next ? next.getAttribute("data-shelf") : "";
      var sections = box.querySelectorAll("[data-shelf]");
      var last = sections.length ? sections[sections.length - 1].getAttribute("data-shelf") : "";
      shelfDrag = null;
      clearShelfMark();
      dropShelfGhost();
      if (before && before !== id) moveShelf(id, before, "before");
      else if (!before && last && last !== id) moveShelf(id, last, "after");
    });
  }

  /** @param {Book} book @param {Shelf} shelf @param {boolean} hand @returns {HTMLElement} */
  function renderSpine(book, shelf, hand) {
    var b = el("button", "vs-spine");
    b.type = "button";
    b.setAttribute("data-book", book.id);
    if (!book.notes.length) b.setAttribute("data-empty", "1");
    b.style.setProperty("--spine-w", thicknessOf(book.notes.length) + "px");

    var dye = dyeOf(book, shelf);
    b.style.setProperty("--spine-tint", dye);
    /* design/0008 -- the ribbon is the book's, not the library's: it is set here from the dye
     * this spine is wearing, so a green book and a red one hang different threads. */
    b.style.setProperty("--ribbon", ribbonFor(dye));
    b.style.setProperty("--ribbon-ink", inkOn(toHex(ribbonFor(dye))));
    /* github#12 */
    b.appendChild(el("span", "vs-title", book.cover));
    b.appendChild(el("span", "vs-n", String(book.notes.length)));

    /* design/0019 -- A FAVOURITE IS ITS SOURCE BOOK: same wear, same ribbons, same colour, and
     * a click opens the source, so a reading place is one thing. Only the address is its own. */
    var source = sourceOf(book);
    if (source !== book) b.setAttribute("data-source", source.id);

    /* design/0008 -- the three things that make a shelf look used rather than printed. */
    var opens = settings.wear[source.id] || 0;
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
    if (book.cover.length <= 3 && fitsUpright(book.cover, thicknessOf(book.notes.length))) {
      b.setAttribute("data-upright", "1");
    }

    on(b, "click", function () { openBook(source, null); });
    if (hand) {
      liftable(b, book, shelf);
      if (shelf.direction === "manual") handleOf(b, book, shelf);
    }
    return b;
  }

  /* ---- a shelf arranged by hand ---------------------------------------------
   * design/0018 -- native HTML5 drag and drop, which is what a browser already has: no
   * library, no pointer bookkeeping, and a drag that starts on a spine is a drag the operating
   * system draws for you. What is added here is the one thing it does not do -- say where the
   * book would land -- and a keyboard path that does the same move without a pointer.
   */

  /** @type {{ shelfId: string, key: string, id: string, width: number }|null} */
  var dragging = null;
  /** @type {HTMLElement|null} */
  var dropMark = null;
  /** design/0019 -- the empty rail a drop is being offered to, if any. @type {HTMLElement|null} */
  var dropRail = null;

  /**
   * design/0019 -- EVERY SPINE ON EVERY SHELF CAN BE PICKED UP, because every one of them can
   * be dropped on Favourites. Whether it can be put down again on its own shelf is the manual
   * shelf's question and stays in `handleOf`.
   * @param {HTMLElement} b @param {Book} book @param {Shelf} shelf
   */
  function liftable(b, book, shelf) {
    b.draggable = true;
    var onto = pickShelves();
    if (onto.length && !isPick(shelf)) {
      b.setAttribute("data-peek", b.getAttribute("data-peek") + "\n\nDrag it onto " +
        (onto.length === 1 ? onto[0].name : onto.length + " shelves take it") + ".");
    }
    if (core.isMadeKey(book.key)) {
      b.setAttribute("data-peek", b.getAttribute("data-peek") +
        "\n\nMade here. Right-click to edit; drag it off the shelf to delete.");
    } else if (isPick(shelf)) {
      b.setAttribute("data-peek", b.getAttribute("data-peek") +
        "\n\nDrag it off the shelf to take it off " + shelf.name + ".");
    }
    on(b, "dragstart", function (e) {
      var de = /** @type {DragEvent} */ (e);
      dragging = { shelfId: shelf.id, key: book.key, id: book.id,
                   width: Math.round(b.getBoundingClientRect().width) };
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
      b.removeAttribute("data-leaving");
    });
  }

  /**
   * design/0019 -- DRAGGING A FAVOURITE OFF THE SHELF TAKES IT OFF, which is the gesture a
   * person tries first and the one the menu was standing in for. "Off" is a DROP anywhere in
   * the library that is not the pick shelf's own section -- onto another shelf, onto the floor
   * between them -- and it is a real drop rather than `dragend`, so that ESCAPE AND A DROP
   * OUTSIDE THE WINDOW BOTH CANCEL: both end a drag without a drop, and a cancelled drag must
   * put the book back rather than throw it away. The books' own shelves refuse the drop
   * (`takes` in handleOf), so nothing lands anywhere; only the pick shelf loses it.
   * @param {DragEvent} e @returns {Shelf|null}
   */
  function leaving(e) {
    if (!dragging) return null;
    var shelf = shelfById(dragging.shelfId);
    /* design/0020 -- a made book leaves any shelf the way a favourite does. */
    if (!shelf || (!isPick(shelf) && !core.isMadeKey(dragging.key))) return null;
    if (!(e.target instanceof Element)) return shelf;
    var own = '[data-shelf="' + cssEscape(shelf.id) + '"]';
    if (e.target.closest(own)) return null;
    /* design/0020 -- over another pick shelf, a made book is not on its way off. */
    if (core.isMadeKey(dragging.key) && e.target.closest(".vs-shelfrail[data-pick]")) return null;
    return shelf;
  }

  /** The spine being carried, so it can say it is on its way off. @returns {HTMLElement|null} */
  function carriedSpine() {
    return dragging
      ? /** @type {HTMLElement|null} */ (root.querySelector("#" + ID + "shelves .vs-spine[data-dragging]"))
      : null;
  }

  /**
   * design/0019 -- WHAT A DROP ONTO A PICK SHELF CARRIES: the source address. A spine lifted
   * off any other shelf carries its own address; one lifted off the pick shelf itself carries
   * its key, which IS the source address, so a move and an add are the same write.
   * @param {Shelf} shelf @returns {string}
   */
  function carriedInto(shelf) {
    if (!dragging) return "";
    return dragging.shelfId === shelf.id ? dragging.key : dragging.id;
  }

  /** @param {HTMLElement} b @param {Book} book @param {Shelf} shelf */
  function handleOf(b, book, shelf) {
    b.setAttribute("data-hand", "1");
    b.setAttribute("data-peek", b.getAttribute("data-peek") +
      "\n\nDrag to move it along the shelf; Alt+Left and Alt+Right do the " +
      "same from the keyboard.");
  }

  /** @param {HTMLElement} b @param {"before"|"after"} side */
  function markDrop(b, side) {
    if (dropMark === b && b.getAttribute("data-drop") === side) return;
    clearDrop();
    dropMark = b;
    /* github#0 -- THE GAP IS THE SHAPE OF WHAT IS COMING. A fixed 18px said "something lands
     * here"; the book's own width says WHICH something, and a thick book makes a thick hole. */
    if (dragging) b.style.setProperty("--drop-w", dragging.width + "px");
    b.setAttribute("data-drop", side);
    var bar = el("span", "vs-drop");
    bar.setAttribute("data-side", side);
    b.appendChild(bar);
  }

  function clearDrop() {
    if (dropMark) {
      dropMark.removeAttribute("data-drop");
      dropMark.style.removeProperty("--drop-w");
      var bar = dropMark.querySelector(".vs-drop");
      if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    }
    dropMark = null;
    if (dropRail) dropRail.removeAttribute("data-drop");
    dropRail = null;
  }

  /** design/0019 -- the library outside the pick shelf is where a favourite is dropped to take
   * it off; it says so on the spine being carried rather than on the room. @param {HTMLElement} box */
  function takeOffZone(box) {
    on(box, "dragover", function (e) {
      var de = /** @type {DragEvent} */ (e);
      var shelf = leaving(de);
      var spine = carriedSpine();
      if (!shelf) {
        /* design/0020 -- not leaving while over a rail that refuses it. */
        if (spine && dragging && core.isMadeKey(dragging.key)) spine.removeAttribute("data-leaving");
        return;
      }
      de.preventDefault();
      if (de.dataTransfer) de.dataTransfer.dropEffect = "move";
      clearDrop();
      if (spine) spine.setAttribute("data-leaving", "1");
    });
    on(box, "drop", function (e) {
      var de = /** @type {DragEvent} */ (e);
      var shelf = leaving(de);
      if (!shelf) return;
      de.preventDefault();
      var key = dragging ? dragging.key : "";
      dragging = null;
      clearDrop();
      if (key) takeOff(shelf, key);
    });
  }

  /** design/0019 -- an empty rail has no gap to draw a bar in, so the whole landing lights. @param {HTMLElement} rail */
  function markLanding(rail) {
    if (dropRail === rail) return;
    clearDrop();
    dropRail = rail;
    rail.setAttribute("data-drop", "1");
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
    if (isPick(shelf)) {
      /* design/0019 -- the same argument, one list along: the picks are saved against what
       * the UNFILTERED library resolves, so a dead pick goes here and nowhere else. */
      shelf.picks = core.pickBefore(shelf.picks, liveFor(shelf), key, before);
    } else {
      var live = core.buildShelf(shelf, notes, settings.noteOrder).books
        .map(function (bk) { return bk.key; });
      shelf.order = core.moveBefore(live, key, before);
    }
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

  /* ---- favourites --------------------------------------------------------------
   * design/0019 -- a pick shelf is a shelf of references: its books are other shelves' books,
   * resolved on every build, and the only thing it owns is which and in what order.
   */

  /** @param {Shelf} shelf @returns {boolean} */
  function isPick(shelf) { return shelf.classifier === "pick"; }

  /**
   * design/0019 -- EVERY pick shelf, in the order the library shows them. There can be any
   * number of them: a reading list, a shortlist for one project, and Favourites, each holding
   * its own references to the same books. What a spine offers, and what a drop means, is per
   * shelf; nothing here is about "the" favourites shelf any more.
   * @returns {Shelf[]}
   */
  function pickShelves() {
    return settings.shelves.slice()
      .sort(function (a, b) { return a.position - b.position; })
      .filter(function (s) { return isPick(s) && !s.hidden; });
  }

  /** The book a favourite stands for; any other book is its own source. @param {Book} book @returns {Book} */
  function sourceOf(book) {
    var shelf = shelfById(book.shelfId);
    if (!shelf || !isPick(shelf) || core.isMadeKey(book.key)) return book;
    return bookIndex[book.key] || book;
  }

  /** Every address the UNFILTERED library resolves: what a save of the picks is made against. @returns {Set<string>} */
  function liveSources() {
    return core.pickable(core.buildLibrary(settings.shelves, notes, settings.noteOrder));
  }

  /** design/0020 -- the live set plus the shelf's made keys.
   * @param {Shelf} shelf @returns {Set<string>} */
  function liveFor(shelf) {
    return core.liveOn(shelf, liveSources());
  }

  /** @param {Shelf} shelf @param {string} sourceId */
  function takeOff(shelf, sourceId) {
    /* design/0020 -- off is delete for a made book. */
    if (core.isMadeKey(sourceId)) { deleteMadeBook(shelf, sourceId); return; }
    shelf.picks = core.unpick(shelf.picks, liveFor(shelf), sourceId);
    persist();
    refresh();
  }

  /* ---- a book made on the shelf -------------------------------------------------
   * design/0020 -- a saved query on the shelf, in the one picks list.
   */

  /** @type {{ shelf: Shelf, key: string|null, before: string|null, draft: import("./core/index").MadeBook }|null} */
  var making = null;
  /** @type {Shelf|null} */
  var railing = null;

  /**
   * design/0020 -- a right-click on empty rail space, placed by placeIn.
   * @param {HTMLElement} rail @param {ShelfView} view
   */
  function offersBook(rail, view) {
    on(rail, "contextmenu", function (e) {
      var me = /** @type {MouseEvent} */ (e);
      if (!(me.target instanceof Element)) return;
      if (me.target.closest(".vs-spine") || me.target.closest(".vs-floorgrip")) return;
      me.preventDefault();
      var track = me.target.closest(".vs-track");
      /** @type {string|null} */
      var before = null;
      if (track instanceof HTMLElement) {
        var place = placeIn(track, me.clientX);
        if (place.spine) {
          before = place.side === "before" ? keyOfSpine(place.spine)
                 : neighbour(view.shelf, keyOfSpine(place.spine), "after", "");
        }
      }
      openRailMenu(view.shelf, before, me.clientX, me.clientY);
    });
  }

  /** @param {Shelf} shelf @param {string|null} before @param {number} x @param {number} y */
  function openRailMenu(shelf, before, x, y) {
    closeDye();
    railing = shelf;
    var menu = node("railmenu");
    clear(menu);
    menu.appendChild(el("div", "vs-dyename", shelf.name));
    var line = /** @type {HTMLButtonElement} */ (el("button", "vs-railline", "New book here…"));
    line.type = "button";
    on(line, "click", function () { closeRailMenu(); openMadeBook(shelf, null, before); });
    menu.appendChild(line);
    placeMenu(menu, x, y);
    line.focus();
  }

  function closeRailMenu() {
    railing = null;
    $("railmenu").hidden = true;
  }

  /**
   * design/0020 -- the sheet; editing keeps the key, so the address.
   * @param {Shelf} shelf @param {string|null} key @param {string|null} before
   */
  function openMadeBook(shelf, key, before) {
    var def = key && shelf.made && shelf.made[key] ? shelf.made[key] : null;
    making = { shelf: shelf, key: def ? key : null, before: before, named: !!def,
               draft: def ? core.clone(def) : { name: "", source: { kind: "folder" } } };
    $("mbtitle").textContent = def ? "Edit book" : "New book on " + shelf.name;
    $("mbsave").textContent = def ? "Save changes" : "Make the book";
    node("mbdelete").hidden = !def;
    writeMadeFields();
    /* design/0020 -- a fresh draft takes the list's first value. */
    readMadeFields();
    $("madebook").hidden = false;
    node("mbname").focus();
    previewMadeBook();
  }

  function closeMadeBook() {
    making = null;
    $("madebook").hidden = true;
    node("library").focus();
  }

  function writeMadeFields() {
    if (!making) return;
    var d = making.draft;
    field("mbname").value = d.name;
    field("mbsource").value = d.source.kind;
    $("mbsourceval").hidden = d.source.kind === "all";
    fillValuesInto(field("mbsourceval"), d.source.kind, d.source.value || "");
  }

  function readMadeFields() {
    if (!making) return;
    var d = making.draft;
    var typed = field("mbname").value.trim();
    /* design/0020 -- the name is suggested until a person types one. */
    if (typed && typed !== nameFor(d.source)) making.named = true;
    var kind = /** @type {import("./core/index").SourceKind} */ (field("mbsource").value);
    if (kind !== d.source.kind) {
      d.source = { kind: kind };
      fillValuesInto(field("mbsourceval"), kind, "");
    }
    if (kind !== "all") d.source.value = field("mbsourceval").value;
    $("mbsourceval").hidden = kind === "all";
    d.name = making.named ? typed : nameFor(d.source);
    if (!making.named && field("mbname").value !== d.name) field("mbname").value = d.name;
  }

  /** design/0020 -- the name when nobody has said: leaf, tag, person.
   * @param {import("./core/index").Source} source @returns {string} */
  function nameFor(source) {
    if (source.kind === "all") return "Everything";
    var value = source.value || "";
    if (!value) return "";
    return core.labelFor(value, source.kind);
  }

  /** design/0020 -- the real count, over the shelf's own notes. */
  function previewMadeBook() {
    if (!making) return;
    var d = making.draft;
    var n = core.applyFilters(notes, filters).filter(function (note) {
      return core.matchesSource(note, d.source, true);
    }).length;
    $("mbcount").textContent = n + (n === 1 ? " note" : " notes") +
      (d.source.kind === "all" ? ", the whole vault" : d.source.value ? "" : " -- choose one");
  }

  function saveMadeBook() {
    if (!making) return;
    readMadeFields();
    var shelf = making.shelf, key = making.key, before = making.before;
    var def = making.draft;
    if (!def.name) def.name = nameFor(def.source) || "Untitled book";
    if (def.source.kind !== "all" && !def.source.value) { node("mbsourceval").focus(); return; }
    closeMadeBook();
    var made = writeMadeBook(shelf, key, def, before);
    var spine = /** @type {HTMLElement|null} */ (root.querySelector(
      "#" + ID + 'shelves .vs-spine[data-book="' + cssEscape(core.bookId(shelf.id, made)) + '"]'));
    if (spine) spine.focus();
  }

  /**
   * design/0020 -- the one write, for the sheet and the harness.
   * @param {Shelf} shelf @param {string|null} key @param {import("./core/index").MadeBook} def
   * @param {string|null} before @returns {string} the key
   */
  function writeMadeBook(shelf, key, def, before) {
    if (!shelf.made) shelf.made = {};
    var made = key || core.madeKey(def.name, Object.keys(shelf.made));
    shelf.made[made] = def;
    /* design/0020 -- the pick list, or the hand-arranged order, takes the key. */
    if (!key && isPick(shelf)) {
      shelf.picks = core.pickBefore(shelf.picks, liveFor(shelf), made, before);
    } else if (!key && shelf.direction === "manual") {
      var live = core.buildShelf(shelf, notes, settings.noteOrder).books
        .map(function (bk) { return bk.key; });
      shelf.order = core.moveBefore(live, made, before);
    }
    persist();
    refresh();
    return made;
  }

  /**
   * design/0020 -- delete asks nothing; wear and colour go with it.
   * @param {Shelf} shelf @param {string} key
   */
  function deleteMadeBook(shelf, key) {
    if (shelf.made) delete shelf.made[key];
    if (shelf.made && !Object.keys(shelf.made).length) delete shelf.made;
    if (isPick(shelf)) shelf.picks = core.unpick(shelf.picks, liveFor(shelf), key);
    else if (shelf.order) shelf.order = shelf.order.filter(function (k) { return k !== key; });
    var id = core.bookId(shelf.id, key);
    delete settings.wear[id];
    delete settings.bookColors[id];
    persist();
    refresh();
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
    /* design/0019 -- a favourite wears its source's colour, hand-given or varied, so the same
     * book is the same colour on both shelves. */
    var source = sourceOf(book);
    var home = source === book ? shelf : shelfById(source.shelfId) || shelf;
    var given = settings.bookColors[source.id];
    if (typeof given === "number" && SLOTS[given]) return SLOTS[given];
    if (shelf.varyColors || home.varyColors) return SLOTS[hashSlot(source.id)];
    /* github#21, design/0005 -- a date shelf dyes by period. */
    var period = core.dyePeriod(home, source.key);
    if (period !== null) return SLOTS[period % SLOTS.length];
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

  /**
   * design/0008 -- THE RIBBON A DYE WEARS. The person's, if they chose one for this slot;
   * otherwise the dye's complement, computed here rather than stored, so it follows the look
   * and the host theme the way the twelve themselves do.
   * @param {string} dye @returns {string}
   */
  function ribbonFor(dye) {
    var i = SLOTS.indexOf(dye);
    if (i >= 0 && settings.ribbons[i]) return settings.ribbons[i];
    return i >= 0 && OWN.ribbons[i] ? OWN.ribbons[i] : threadOf(dye);
  }

  /**
   * github#0 -- THE SILK IS THE SAME COLOUR AS THE BOARD, DEEPER. The first rule here was the
   * dye's complement -- the opposite hue -- and it was wrong for what this is: an opposite hue
   * is what you reach for when two colours have to compete for attention, and a ribbon is not
   * competing with the book it is sewn into. A binder does not put green silk in an oxblood
   * book. The thread is the binding's own colour, richer and further along in lightness, so it
   * reads as part of the same object rather than as a flag stuck in it.
   *
   * The hue is therefore KEPT. What still has to happen is the separation: two colours at the
   * same lightness are one shape, so the saturation comes up and the lightness moves away from
   * the board's -- lighter on a dark dye, darker on a light one, within bounds where a thread
   * still reads against the room as well as against the board.
   * @param {string} colour @returns {string}
   */
  function threadOf(colour) {
    var hex = toHex(colour);
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2;
    var d = max - min;
    var sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    /* A grey has no hue to deepen, so its ribbon is the one warm thread a binder would use on
     * a plain cloth board rather than a fourth shade of the same grey. */
    if (sat < 0.08) { h = 0.02; sat = 0.62; }
    else sat = Math.min(0.82, Math.max(0.5, sat * 1.25));
    /* WHICHEVER WAY HAS MORE ROOM, and the bounds are where a thread still reads against a
     * room as well as against the board it hangs off: cyber's ground is near-black and
     * modern's is near-white, so a ribbon may go neither very dark nor very pale. Simply
     * subtracting from a MID-lightness dye lands inside the clamp and returns a thread the
     * same weight as its board -- measured at 8 of 12 separated before this, 12 after. */
    var up = Math.min(0.78, l + 0.3), down = Math.max(0.32, l - 0.3);
    l = up - l >= l - down ? up : down;
    return hslHex(h, sat, l);
  }

  /** @param {number} h @param {number} s @param {number} l @returns {string} */
  function hslHex(h, s, l) {
    var c = (1 - Math.abs(2 * l - 1)) * s;
    var x = c * (1 - Math.abs(((h * 6) % 2) - 1));
    var m = l - c / 2;
    var k = Math.floor(h * 6) % 6;
    var rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
    var two = function (/** @type {number} */ v) {
      return ("0" + Math.round((v + m) * 255).toString(16)).slice(-2);
    };
    return "#" + two(rgb[0]) + two(rgb[1]) + two(rgb[2]);
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
    /* design/0019 -- a colour given to a favourite is given to the book it stands for. */
    var source = sourceOf(book);
    var given = settings.bookColors[source.id];
    menu.appendChild(el("div", "vs-dyename", book.label));
    var row = el("div", "vs-swatches");
    SLOTS.forEach(function (colour, i) {
      var sw = /** @type {HTMLButtonElement} */ (el("button", "vs-swatch"));
      sw.type = "button";
      sw.style.setProperty("--swatch", colour);
      sw.title = "Colour " + (i + 1);
      sw.setAttribute("aria-label", sw.title);
      if (given === i) sw.setAttribute("aria-pressed", "true");
      on(sw, "click", function () { setBookColor(source, i); });
      row.appendChild(sw);
    });
    menu.appendChild(row);
    var auto = /** @type {HTMLButtonElement} */ (el("button", "vs-dyeauto", "Automatic"));
    auto.type = "button";
    if (given === undefined) auto.setAttribute("aria-pressed", "true");
    on(auto, "click", function () { setBookColor(source, null); });
    menu.appendChild(auto);

    /* design/0019 -- THE SAME MENU, ONE LINE PER PICK SHELF. On a favourite the line takes the
     * book off the shelf it is standing on; on any other spine there is a line for each shelf
     * that would take it, named, because with several of them "Add to Favourites" would be a
     * guess about which one. This is also the path that needs no pointer. */
    var home = shelfById(book.shelfId);
    if (home && core.isMadeKey(book.key)) {
      /* design/0020 -- edit and delete; no take-off on a made book. */
      var editBtn = /** @type {HTMLButtonElement} */ (el("button", "vs-dyepick", "Edit book…"));
      editBtn.type = "button";
      on(editBtn, "click", function () { closeDye(); openMadeBook(home, book.key, null); });
      menu.appendChild(editBtn);
      var delBtn = /** @type {HTMLButtonElement} */ (el("button", "vs-dyepick", "Delete book"));
      delBtn.type = "button";
      on(delBtn, "click", function () { closeDye(); takeOff(home, book.key); });
      menu.appendChild(delBtn);
    } else if (home && isPick(home)) {
      var offBtn = /** @type {HTMLButtonElement} */ (el("button", "vs-dyepick",
        "Take off " + home.name));
      offBtn.type = "button";
      on(offBtn, "click", function () { closeDye(); takeOff(home, book.key); });
      menu.appendChild(offBtn);
    } else if (home) {
      pickShelves().forEach(function (target) {
        var already = (target.picks || []).indexOf(book.id) >= 0;
        var addBtn = /** @type {HTMLButtonElement} */ (el("button", "vs-dyepick",
          (already ? "Take off " : "Add to ") + target.name));
        addBtn.type = "button";
        on(addBtn, "click", function () {
          closeDye();
          if (already) takeOff(target, book.id);
          else arrangeBook(target, book.id, null);
        });
        menu.appendChild(addBtn);
      });
    }

    placeMenu(menu, x, y);
    var first = menu.querySelector("button");
    if (first instanceof HTMLElement) first.focus();
  }

  /**
   * Placed where the pointer is, and pulled back inside the room if that would hang it off
   * the edge. Measured after it is shown, because a hidden menu has no size.
   * @param {HTMLElement} menu @param {number} x @param {number} y
   */
  function placeMenu(menu, x, y) {
    menu.hidden = false;
    var host = root.getBoundingClientRect();
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.min(x - host.left, host.width - w - 8);
    var top = Math.min(y - host.top, host.height - h - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";
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
    var needle = query.trim().toLowerCase();
    for (var i = 0; i < spines.length; i++) {
      var id = spines[i].getAttribute("data-book");
      var book = id ? bookIndex[id] : null;
      /* github#6 */
      if (!book && id) {
        book = findBook(id);
        if (book) {
          book.matches = needle
            ? book.notes.filter(function (n) { return core.matchesQuery(n, needle); }).length : 0;
        }
      }
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
    var spines = root.querySelectorAll('#' + ID + 'shelves [data-book="' + cssEscape(bookId) + '"], ' +
                                       '#' + ID + 'shelves [data-source="' + cssEscape(bookId) + '"]');
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
      (book.holds ? " across " + book.holds + (book.holds === 1 ? " book" : " books") : "") +
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
    var box = node("marks");
    clear(box);
    /* Every ribbon in this row is in the same book, so they are all the same thread -- the
     * one the closed spine hangs, which is how you recognise the book you just opened. */
    var shelf = shelfById(reader.book.shelfId);
    var dye = shelf ? dyeOf(reader.book, shelf) : SLOTS[0];
    box.style.setProperty("--ribbon", ribbonFor(dye));
    box.style.setProperty("--ribbon-ink", inkOn(toHex(ribbonFor(dye))));
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
    revealCurrent(box);
  }

  /* github#11, design/0015 */
  /** @param {HTMLElement} box */
  function revealCurrent(box) {
    if (!reader || reader.revealed === reader.noteId) return;
    var row = /** @type {HTMLElement|null} */ (box.querySelector('button[aria-current="true"]'));
    var page = /** @type {HTMLElement|null} */ (box.closest(".vs-page"));
    if (!row || !page || !page.clientHeight) return;
    var pageBox = page.getBoundingClientRect();
    var rowBox = row.getBoundingClientRect();
    var top = rowBox.top - pageBox.top + page.scrollTop;
    var bottom = top + rowBox.height;
    var margin = Math.round(rowBox.height);
    var target = page.scrollTop;
    if (top < page.scrollTop + margin) target = top - margin;
    else if (bottom > page.scrollTop + page.clientHeight - margin) target = bottom - page.clientHeight + margin;
    target = Math.max(0, Math.min(target, page.scrollHeight - page.clientHeight));
    reader.revealed = reader.noteId;
    if (Math.abs(target - page.scrollTop) < 1) return;
    if (reduceMotion || !page.scrollTo) page.scrollTop = target;
    else page.scrollTo({ top: target, behavior: "smooth" });
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
  /**
   * A place in the contents, and how deep the cut that names it is.
   * @typedef {{ label: string, at: number, level?: number, head?: boolean }} Section
   */
  /** @param {Book} book @returns {Section[]} */
  function indexSections(book) {
    var shelf = shelfById(book.shelfId);
    var kind = shelf ? shelf.classifier : "initial";
    /** @type {Section[]} */
    var out = [];
    if (kind === "initial") {
      /* github#35 -- A BOOK WHOSE ROWS READ AS DATES, not "the 0-9 volume". Every book on
       * every other shelf is already cut by date, so in practice the volume is the only new
       * wearer of this -- but the rule is about the rows, which is what a tab is a position
       * in, and it holds for any alphabetical book whose titles are ISO dates. */
      var dated = book.notes.filter(function (n) { return titleDate(n.title); }).length;
      if (dated >= 4 && dated * 2 >= book.notes.length) return volumeTabs(book.notes);
      out = letterTabs(book.notes);
    } else {
      /* design/0015 -- ONE INDEX FOR EVERY DATE-ORDERED BOOK, however it was classified. A
       * year book, a month book and a tag book used to be cut three different ways -- months,
       * then days, then whichever single unit happened to split the book -- so the same kind
       * of tab read "Jul" in one book, "07" in another and "2024" in a third. The layered cut
       * reads the book instead of the shelf. */
      return dateTabs(book.notes, function (n) { return n.date || ""; });
    }
    /* github#32 -- A CEILING, NOT THE CAP A PERSON FEELS. This used to collapse anything over
     * 26 into twelve ranges, which is the whole index the rail could hold while it was one
     * column. The rail is three banks now and what fits is measured (`fitTabs`); this only
     * keeps the first draw bounded, since a deep letter cut can run to hundreds. */
    return out.length > RAW_TABS ? rangesOf(out, RAW_TABS) : out;
  }

  /**
   * design/0015 -- A TAB YOU CANNOT HIT IS DECORATION. `n` tabs over the same list, each
   * naming the span it opens -- `Ub-Ug` -- and each still standing at a real position in the
   * contents, which is the only thing a tab has to be.
   * @param {Section[]} sections @param {number} n @returns {Section[]}
   */
  function rangesOf(sections, n) {
    /** @type {Section[]} */
    var out = [];
    var per = Math.ceil(sections.length / n);
    /* A RANGE OF RANGES IS STILL ONE RANGE. Gathering twice used to read `Jan-Feb-Mar-Jul`,
     * which is four labels stapled together rather than the span it opens; the ends of the
     * ends are the ends. */
    /** @param {Section} t @returns {string} */
    var from = function (t) { return t.label.split("\u2013")[0]; };
    /** @param {Section} t @returns {string} */
    var to = function (t) { var p = t.label.split("\u2013"); return p[p.length - 1]; };
    for (var i = 0; i < sections.length; i += per) {
      var last = sections[Math.min(i + per, sections.length) - 1];
      var label = from(sections[i]);
      if (to(last) !== label) label += "\u2013" + to(last);
      out.push({ label: label, at: sections[i].at });
    }
    return out;
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
    /** @type {Section[]} */
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
    var word = /^[\p{L}\p{N}]+/u.exec(title.replace(/^[^\p{L}\p{N}]+/u, ""));
    /* github#35 -- A NUMERIC VOLUME IS CUT BY ITS NUMBERS. Every title in the 0-9 volume
     * begins with a digit, so `0-9` is the only letter tab a letter cut can give it and a
     * deeper one reads `0-90`. It used to take the first four digits as a YEAR, which filed
     * `1000 Small Decisions` under the year 1000 and gave a volume of dates steps of hundreds
     * of notes; what separates these titles is the number they start with, which is also the
     * order they stand in. A volume that really is dated is cut by `volumeTabs` instead. */
    if (head === "0-9" && word) return word[0].slice(0, depth);
    if (depth <= 1 || head === "#" || !word) return head;
    return head + word[0].slice(1, depth).toLowerCase();
  }

  /**
   * github#35 -- THE DATE A TITLE CARRIES, and only a real one. `2024-03-17 standup` is filed
   * under that day; `1000 Small Decisions` and `3D printing notes` carry no date at all, and
   * the four leading digits that made the first of them the year 1000 were this index's own
   * invention. A hyphen is required, and the month and day have to exist.
   * @param {string} title @returns {string}
   */
  function titleDate(title) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?![\d-])/.exec(title.replace(/^[^\p{L}\p{N}]+/u, ""));
    if (!m) return "";
    var month = Number(m[2]);
    if (month < 1 || month > 12) return "";
    if (m[3] !== undefined && (Number(m[3]) < 1 || Number(m[3]) > 31)) return "";
    return m[0];
  }

  /**
   * github#35 -- A VOLUME OF DATES, cut the way every other date-ordered book is: the layered
   * cut over the date each TITLE carries, because the volume stands in title order and a tab
   * has to be a position in the rows as they stand (`decisions/0003` is the disagreement, and
   * this is the side of it the reader is on).
   *
   * THE ROWS THAT ARE NOT DATES KEEP A TAB OF THEIR OWN. `1000 Small Decisions` sorts before
   * the dates and `3D printing notes` after them, so they are two groups rather than one; a
   * run of four or more gets one tab at its place in the contents, labelled the way the letter
   * cut would label it. Nothing a person can see on the left is unreachable from the right.
   * @param {ShelfNote[]} notes @returns {Section[]}
   */
  function volumeTabs(notes) {
    var out = dateTabs(notes, function (n) { return titleDate(n.title); });
    var run = 0;
    notes.forEach(function (n, i) {
      if (titleDate(n.title)) { run = 0; return; }
      run++;
      if (run !== PLAIN_RUN) return;
      var at = i - run + 1;
      out.push({ label: titlePrefix(notes[at].title, 1), at: at, level: 0 });
    });
    return out.sort(function (a, b) { return a.at - b.at; });
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
   * @param {ShelfNote[]} notes
   * @param {function(ShelfNote): string} dateOf github#35 -- the note's, or its title's
   * @returns {Section[]}
   */
  function dateTabs(notes, dateOf) {
    /** @type {Section[]} */
    var out = [];
    var years = runsOf(notes, function (n) { return dateOf(n).slice(0, 4); });
    var showYears = years.length > 1;
    years.forEach(function (y) {
      if (showYears) out.push({ label: y.key, at: y.at, level: 0 });
      if (y.size <= 3) return;
      var months = runsOf(y.notes, function (n) { return dateOf(n).slice(0, 7); });
      var showMonths = months.length > 1;
      var drawn = showYears || showMonths;
      months.forEach(function (m) {
        if (showMonths) {
          out.push({ label: core.monthLabel(m.key).slice(0, 3), at: y.at + m.at,
                     level: showYears ? 1 : 0 });
        }
        if (m.size <= 3) return;
        /* github#35 -- a `2024-03` title names a month and has no day in it to cut on. */
        var days = runsOf(m.notes, function (n) {
          var d = dateOf(n);
          return d.length >= 10 ? d : "";
        });
        if (days.length <= 1) return;
        /* github#32 -- A CUT MUST GATHER, or be the only cut there is. One note per day is the
         * ordinary shape of a vault, so cutting a dense month into days puts a tab beside
         * every row and says nothing the contents did not already say -- and with three banks
         * to fill, it filled them. A day layer is drawn where its days hold two rows each on
         * average, or where nothing coarser was drawn at all, which is how a month book keeps
         * the only index it can have. */
        if (drawn && days.length * 2 > m.size) return;
        days.forEach(function (d) {
          out.push({ label: d.key.slice(8), at: y.at + m.at + d.at,
                     level: (showYears ? 1 : 0) + (showMonths ? 1 : 0) });
        });
      });
    });
    var deepest = out.reduce(function (max, t) { return Math.max(max, t.level || 0); }, 0);
    while (out.length > RAW_TABS * 2 && deepest > 0) {
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

  /**
   * github#32 -- HOW FAR THE INDEX MAY GROW. The rail stands over the right-hand page, so
   * every bank is paid for out of the prose column. TWO: three banks of small plates stop
   * reading as an edge of the book and start reading as a heap beside it, which is what the
   * first cut of this did. A fifth of the spread caps it whatever the labels say.
   */
  var BANKS = 2;
  var RAIL_SHARE = 5;

  /**
   * github#32 -- the ceiling on the first draw, before geometry has had a look. Comfortably
   * over what three banks hold, so it is the rail that decides and not this number.
   */
  var RAW_TABS = 90;

  /**
   * github#35 -- how many rows in a row have to carry no date before the index says so. Below
   * this they are the handful of strays any volume has; at it they are a block of the book.
   */
  var PLAIN_RUN = 4;

  function renderTabs() {
    var rail = $("tabs");
    if (!reader.tabs) {
      /* `fitTabs` leaves what it settled on drawn, so there is nothing to draw again here. */
      var fitted = fitTabs(rail, indexSections(reader.book));
      /* A rail that is not laid out -- the reader still hidden -- measures one bank whatever
       * is in it, so that answer is drawn and not kept, and the next draw tries again. */
      if (rail.clientHeight >= 40) reader.tabs = fitted;
      return;
    }
    drawTabs(reader.tabs);
  }

  /**
   * github#32 -- MEASURED, NOT CALCULATED. How many tabs a bank holds is a tab's height and
   * its border against the spread's, in whichever look and at whatever font the host has --
   * five numbers this file does not own. So the index is drawn at full depth, the banks are
   * counted, and while there are too many it is rebuilt one step shallower and drawn again.
   * A handful of passes, once per book and once per resize, never per page turn.
   * @param {HTMLElement} rail
   * @param {{ label: string, at: number, level?: number }[]} sections
   * @returns {{ label: string, at: number, level?: number }[]}
   */
  function fitTabs(rail, sections) {
    var spread = rail.closest(".vs-spread");
    rail.style.removeProperty("--vs-railcap");
    drawTabs(sections);
    /* Under the measure the rail is a wrapping ROW under the pages (page.css), where a bank
     * is not a thing and the room is the whole width; there is nothing to fit. */
    if (!(spread instanceof HTMLElement) ||
        WIN.getComputedStyle(rail).flexDirection !== "column") return sections;
    var shown = sections;
    for (var pass = 0; pass < 8; pass++) {
      shown = evenBanks(rail, sections);
      if (rail.clientHeight < 40 || fits(rail, spread)) break;
      var next = shallower(sections);
      if (!next) break;
      sections = next;
      rail.style.removeProperty("--vs-railcap");
      drawTabs(sections);
    }
    sections = shown;
    /* github#32 -- what the banks cost the prose, written where the padding can read it. A
     * rail with no width has not been laid out, and writing 0 here would put the tabs over
     * the text; the page.css default stands until it has. */
    if (rail.offsetWidth > 0) spread.style.setProperty("--vs-railw", rail.offsetWidth + "px");
    return sections;
  }

  /**
   * @param {HTMLElement} rail @param {HTMLElement} spread @returns {boolean}
   */
  function fits(rail, spread) {
    return banksOf(rail) <= BANKS && rail.offsetWidth * RAIL_SHARE <= spread.clientWidth;
  }

  /**
   * One bank per distinct fore-edge. The RIGHT edge, not `offsetLeft`: a deeper level steps in
   * from the left by design, so its left edge says which layer it is and nothing about which
   * bank it landed in.
   * @param {HTMLElement} rail @returns {number}
   */
  function banksOf(rail) {
    /** @type {Record<number, boolean>} */
    var edges = {};
    var kids = rail.children;
    for (var i = 0; i < kids.length; i++) {
      var kid = /** @type {HTMLElement} */ (kids[i]);
      edges[Math.round(kid.offsetLeft + kid.offsetWidth)] = true;
    }
    return Object.keys(edges).length;
  }

  /**
   * github#32 -- TWO BANKS ARE ONE OBJECT OR THEY ARE A HEAP, and the first cut of this was a
   * heap: flex fills one bank to the brim and dribbles the rest into a stub beside it, so the
   * rail had two ragged columns of different heights, and the second one opened halfway
   * through a year with nothing to say which year.
   *
   * So the room is capped at the taller half rather than at everything it could hold -- the
   * banks come out the same height -- and a bank that opens inside a run repeats the run's
   * label at its head, which is `design/0003`'s plaque law: a plate names every row its books
   * stand on. The repeat is a tab and opens the same place as the original, so it is not a new
   * kind of thing, and `data-head` only makes it quieter.
   * @param {HTMLElement} rail @param {Section[]} sections @returns {Section[]}
   */
  function evenBanks(rail, sections) {
    rail.style.removeProperty("--vs-railcap");
    drawTabs(sections);
    var banks = banksOf(rail);
    if (banks < 2 || sections.length < 4) return sections;
    var pitch = pitchOf(rail);
    if (!pitch) return sections;
    /* The glass tab stands at the head of the strip and takes a row of the first bank. A head
     * takes a row of its own, so the split has to be solved WITH the heads in it: widen by a
     * row and re-place them, until everything is inside the banks allowed. */
    var rows = Math.ceil((sections.length + 1) / banks);
    var out = withHeads(sections, rows);
    while (out.length + 1 > rows * banks && rows < sections.length + 2) {
      rows++;
      out = withHeads(sections, rows);
    }
    rail.style.setProperty("--vs-railcap", (rows * pitch + 2) + "px");
    drawTabs(out);
    return out;
  }

  /**
   * The list again, with a run's label repeated at the head of any bank that opens inside it.
   * The bank a cut lands in is the slot it stands in, which is why this counts rather than
   * measures: a head takes a slot of its own, so placing one moves everything after it.
   * @param {Section[]} sections @param {number} rows @returns {Section[]}
   */
  function withHeads(sections, rows) {
    /** @type {Section[]} */
    var out = [];
    /* the glass tab holds the first slot of the first bank */
    var slot = 1;
    sections.forEach(function (section, i) {
      if (slot % rows === 0) {
        var head = runHead(sections, i);
        if (head) { out.push(head); slot++; }
      }
      out.push(section);
      slot++;
    });
    return out;
  }

  /**
   * The unit the cut at `at` stands under, as a tab of its own -- null when it stands under
   * nothing, which is when it is a top-level cut and names itself.
   * @param {Section[]} sections @param {number} at @returns {Section|null}
   */
  function runHead(sections, at) {
    var mine = sections[at];
    if (!mine || !mine.level) return null;
    for (var i = at - 1; i >= 0; i--) {
      if ((sections[i].level || 0) < mine.level) {
        return { label: sections[i].label, at: sections[i].at,
                 level: sections[i].level || 0, head: true };
      }
    }
    return null;
  }

  /**
   * One cut's height plus what the stack collapses between them, read off two neighbours in
   * the same bank rather than added up from the stylesheet.
   * @param {HTMLElement} rail @returns {number}
   */
  function pitchOf(rail) {
    var kids = rail.children;
    for (var i = 2; i < kids.length; i++) {
      var a = /** @type {HTMLElement} */ (kids[i - 1]);
      var b = /** @type {HTMLElement} */ (kids[i]);
      if (b.offsetLeft === a.offsetLeft && b.offsetTop > a.offsetTop) {
        return b.offsetTop - a.offsetTop;
      }
    }
    return 0;
  }

  /**
   * github#32 -- ONE STEP SHALLOWER. The deepest layer of the date cut goes first, the way the
   * count cap has always dropped days before months; with no layers left the list collapses
   * into ranges, halving each time. Null when there is nothing left to give up.
   * @param {{ label: string, at: number, level?: number }[]} sections
   * @returns {{ label: string, at: number, level?: number }[]|null}
   */
  function shallower(sections) {
    var deepest = sections.reduce(function (max, t) { return Math.max(max, t.level || 0); }, 0);
    if (deepest > 0) {
      return thinned(sections, deepest) ||
             sections.filter(function (t) { return (t.level || 0) < deepest; });
    }
    if (sections.length >= 8) return rangesOf(sections, Math.ceil(sections.length / 2));
    return null;
  }

  /**
   * github#32, github#35 -- HALVE THE DEEPEST LAYER BEFORE THROWING IT AWAY. A book of several
   * thousand notes over fifteen years carries a month tab for every one of a hundred and
   * thirty months, which no rail holds -- and dropping the layer outright leaves the years
   * alone, which is the step of hundreds of notes github#35 is about. Each run of deepest tabs
   * standing under one parent is gathered into half as many, naming the span it opens the way
   * an over-long letter list already does: `Jan-Apr`. Null once every run is a single tab and
   * there is nothing left to gather, which is when the layer really has to go.
   * @param {Section[]} sections @param {number} level @returns {Section[]|null}
   */
  function thinned(sections, level) {
    /** @type {Section[]} */
    var out = [];
    /** @type {Section[]} */
    var run = [];
    var gathered = false;
    var flush = function () {
      if (run.length > 1) {
        gathered = true;
        rangesOf(run, Math.ceil(run.length / 2)).forEach(function (t) {
          out.push({ label: t.label, at: t.at, level: level });
        });
      } else if (run.length) {
        out.push(run[0]);
      }
      run = [];
    };
    sections.forEach(function (t) {
      if ((t.level || 0) === level) { run.push(t); return; }
      flush();
      out.push(t);
    });
    flush();
    return gathered ? out : null;
  }

  /** @param {{ label: string, at: number, level?: number }[]} sections */
  function drawTabs(sections) {
    var box = $("tabs");
    clear(box);
    /* github#0 -- THE FIRST TAB IS THE ONE THAT FINDS. The index down the right edge jumps to a
     * place in the book; the box that searches inside the book is at the top of the left page,
     * which is where a person is not looking when they are reading the right one. A tab in the
     * same strip, with a glass on it, takes them there: it scrolls the contents page up to the
     * box and puts the cursor in it, so "search this book" is one press from wherever you are
     * rather than a scroll and a click. It is an index entry for the act of looking, so it
     * stands at the head of the index. */
    var find = el("button", "vs-findtab", "\u2315");
    find.type = "button";
    find.setAttribute("data-level", "0");
    find.title = "Search inside this book";
    find.setAttribute("aria-label", "Search inside this book");
    on(find, "click", findInBook);
    box.appendChild(find);
    /* github#32 -- THE THUMB IS IN ONE CUT. Every tab at or before the page carried
     * `aria-current`, so a book read to its end lit the whole rail and said nothing about
     * where you were; the open cut is the last one the page has reached. */
    var openAt = -1;
    sections.forEach(function (section, i) {
      if (section.at <= reader.index && !section.head) openAt = i;
    });
    sections.forEach(function (section, i) {
      var b = el("button", "", section.label);
      b.type = "button";
      b.setAttribute("data-level", String(section.level || 0));
      if (section.head) b.setAttribute("data-head", "1");
      if (i === openAt) b.setAttribute("aria-current", "true");
      on(b, "click", function () { goTo(section.at); });
      box.appendChild(b);
    });
  }

  /**
   * github#0 -- scroll the left page to the top, where the find box is, and leave the cursor in
   * it. `scrollIntoView` on the box itself would work on the page that holds it; the page is
   * what scrolls, so it is the page that is told, and then the box is focused. A selection of
   * whatever is already typed, so a second press replaces the query rather than appending to it.
   */
  function findInBook() {
    var page = root.querySelector("#" + ID + "reader .vs-page.vs-left");
    if (page instanceof HTMLElement) page.scrollTop = 0;
    var box = field("within");
    box.focus();
    box.select();
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
        /* design/0020 -- a reference is skipped; a made book is a place. */
        if (core.isReference(v.shelf, b)) return;
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
    var book = findBook(last.bookId, last.noteId);
    if (!book) return;
    reader = { book: book, index: 0, noteId: last.noteId, within: "", opener: reader ? reader.opener : null };
    if (last.noteId) {
      for (var i = 0; i < book.notes.length; i++) if (book.notes[i].id === last.noteId) reader.index = i;
    }
    renderReader();
  }

  /** @param {string} id @param {string|null} [noteId] @returns {Book|null} */
  function findBook(id, noteId) {
    for (var i = 0; i < views.length; i++) {
      for (var k = 0; k < views[i].books.length; k++) {
        if (views[i].books[k].id === id) return views[i].books[k];
      }
    }
    /* github#6 */
    var plaque = core.plaqueOfId(id);
    var view = plaque ? viewById(plaque.shelfId) : null;
    return view ? core.plaqueBookFor(view, plaque.plaque, noteId || null, settings.noteOrder) : null;
  }

  /* ================================================================= builder ==
   * design/0002 -- two questions, and the preview answers them with the real numbers before
   * anything is saved. A builder that previews a guess is worse than one that previews
   * nothing, so this runs the same core.buildShelf the library runs.
   */
  /** @param {Shelf|null} existing */
  /**
   * github#0 -- THE NEW SHELF LANDS WHERE THE BUTTON IS. There is a "+ New shelf" at each end
   * of the library (design/0009), and both of them used to append: pressing the one at the top
   * of the room sent the shelf to the bottom, past everything. `at` is which end asked.
   * @param {Shelf|null} existing @param {"top"|"end"} [at]
   */
  function openBuilder(existing, at) {
    builder = existing
      ? { editing: existing.id, draft: core.clone(existing), at: "end" }
      : { editing: null, at: at === "top" ? "top" : "end", draft: {
          id: "", name: "New shelf", source: { kind: "all" }, classifier: "initial",
          direction: "alphabetical", hidden: false, position: settings.shelves.length,
          plaques: false, includeSubtags: true
        } };

    $("buildertitle").textContent = existing ? "Edit shelf" : "New shelf";
    $("bsave").textContent = existing ? "Save changes" : "Save shelf";
    /* github#0 -- "we can't remove shelfs when editing a shelf". The sheet you are already in
     * is where a person looks for it; Manage keeps its own, and both ask twice. */
    var bin = /** @type {HTMLButtonElement} */ (node("bdelete"));
    bin.hidden = !existing;
    bin.textContent = "Delete shelf";
    bin.removeAttribute("data-armed");
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
    /* design/0019 -- A PICK SHELF HAS NO PREDICATE AND NO RULE, so the first question and the
     * order come off the form -- but "what makes a book" STAYS, because it is the control that
     * made the shelf a pick shelf and the only way back out of it. The recipes go too: every
     * one of them answers the question this shelf does not ask. */
    var pick = isPick(d);
    /** @type {(HTMLElement|null)[]} */
    var ruled = [field("bsource").closest("fieldset"), order.closest("label"),
                 $("recipes").closest(".vs-field")];
    ruled.forEach(function (part) { if (part) part.hidden = pick; });
    field("bplaques").disabled = pick || !PLAQUABLE[d.classifier];
    field("bsubtags").disabled = pick || (d.classifier !== "tag" && d.source.kind !== "tag");
    $("pickhint").hidden = !pick;
  }

  function readBuilderFields() {
    var d = builder.draft;
    d.name = field("bname").value.trim() || "Untitled shelf";
    /* design/0019 -- the classifier is always read, so "Books you drag onto it" can be chosen
     * and can be left again; everything a pick shelf does not have is skipped instead. */
    d.classifier = /** @type {import("./core/index").ClassifierKind} */ (field("bclassifier").value);
    if (isPick(d)) {
      d.direction = "manual";
      if (!Array.isArray(d.picks)) d.picks = [];
      delete d.order;
    } else {
      d.source = { kind: /** @type {import("./core/index").SourceKind} */ (field("bsource").value) };
      if (d.source.kind !== "all") {
        fillSourceValues();
        d.source.value = field("bsourceval").value;
      }
      if (d.classifier === "property") {
        fillProperties();
        d.property = field("bproperty").value;
      }
      var picked = field("bdirection").value;
      d.direction = picked === "manual" ? "manual"
                  : picked === "chronological" ? "chronological" : "alphabetical";
      delete d.picks;
    }
    d.plaques = !isPick(d) && !!PLAQUABLE[d.classifier] && field("bplaques").checked;
    d.includeSubtags = field("bsubtags").checked;
    d.varyColors = field("bvary").checked;
    writeBuilderFields();
  }

  function fillSourceValues() {
    var chosen = builder && builder.draft.source ? builder.draft.source.value : "";
    fillValuesInto(field("bsourceval"), field("bsource").value, chosen || "");
  }

  /**
   * design/0002, design/0020 -- the value list both sheets fill.
   * @param {HTMLInputElement} select @param {string} kind @param {string} chosen
   */
  function fillValuesInto(select, kind, chosen) {
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
    var view = core.buildShelf(draft, core.applyFilters(notes, filters), settings.noteOrder, views);
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
      settings.shelves.push(draft);
      /* The position is what the library sorts on, so "at the top" is written as position 0
       * and everything else moves down one -- the shift migrate makes for Favourites. */
      var ordered = settings.shelves.slice()
        .sort(function (a, b) { return a.position - b.position; })
        .filter(function (s_) { return s_ !== draft; });
      var placed = builder.at === "top" ? [draft].concat(ordered) : ordered.concat([draft]);
      placed.forEach(function (s_, k) { s_.position = k; });
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
    if (draft.direction !== "manual" || isPick(draft)) return;
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

  /** github#0 -- which row's Delete is asking, if any. @type {string|null} */
  var armed = null;

  /**
   * github#0 -- A DELETED SHELF IS GONE, and what went with it goes too: the wear and the
   * hand-given colours keyed by its addresses, which can never be reached again, and the
   * favourites pointing at its books, which is the same rule design/0019 already has -- a dead
   * pick is dropped on save, and this is a save. A reading place is NOT deleted: it names a
   * note, and `core.resolveReading` finds that note another home (decisions/0002).
   * @param {string} id
   */
  function deleteShelf(id) {
    var at = -1;
    settings.shelves.forEach(function (s_, k) { if (s_.id === id) at = k; });
    if (at < 0) return;
    settings.shelves.splice(at, 1);
    settings.shelves.slice().sort(function (a, b) { return a.position - b.position; })
      .forEach(function (s_, k) { s_.position = k; });
    var dead = id + "/";
    Object.keys(settings.wear).forEach(function (key) {
      if (key.indexOf(dead) === 0) delete settings.wear[key];
    });
    Object.keys(settings.bookColors).forEach(function (key) {
      if (key.indexOf(dead) === 0) delete settings.bookColors[key];
    });
    var live = liveSources();
    settings.shelves.forEach(function (s_) {
      if (isPick(s_)) s_.picks = core.unpick(s_.picks, core.liveOn(s_, live), "");
    });
    persist();
    renderManage();
    refresh();
  }

  function renderManage() {
    renderColours();
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

      /* github#0 -- DELETING IS THE ONE THING HIDING IS NOT, so it asks. The button arms
       * itself on the first press and does the deed on the second; a second press anywhere
       * else disarms it. No confirm() dialog: inside Obsidian that is the app's modal, not
       * ours, and a dialog in a plugin's sheet reads as a bug. */
      var del = el("button", "vs-delete", "Delete");
      del.type = "button";
      del.setAttribute("aria-label", "Delete " + shelf.name);
      del.title = "Delete this shelf. Hiding keeps it; this does not.";
      on(del, "click", function () {
        if (armed !== shelf.id) {
          armed = shelf.id;
          renderManage();
          return;
        }
        armed = null;
        deleteShelf(shelf.id);
      });
      if (armed === shelf.id) {
        del.textContent = "Really delete?";
        del.setAttribute("data-armed", "1");
      }

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

      /* github#21 -- on a date shelf, what a dye follows: folder, year or decade. */
      /** @type {HTMLSelectElement|null} */
      var by = null;
      if (core.datedClassifier(shelf.classifier)) {
        by = /** @type {HTMLSelectElement} */ (DOC.createElement("select"));
        by.className = "vs-colourby";
        by.setAttribute("aria-label", "Colour " + shelf.name + " by");
        by.title = "What a book's colour follows on this shelf";
        [["folder", "Colour by folder"], ["year", "Colour by year"], ["decade", "Colour by decade"]]
          .forEach(function (o) {
            var opt = DOC.createElement("option");
            opt.value = o[0];
            opt.textContent = o[1];
            by.appendChild(opt);
          });
        by.value = core.colorRule(shelf);
        on(by, "change", function () {
          shelf.colorBy = /** @type {import("./core/index").ColorRule} */ (by.value);
          persist();
          refresh();
        });
      }

      row.appendChild(up);
      row.appendChild(down);
      row.appendChild(shown);
      row.appendChild(vary);
      if (by) row.appendChild(by);
      row.appendChild(edit);
      row.appendChild(del);
      box.appendChild(row);
    });
  }

  /**
   * design/0005 -- THE TWELVE, EDITABLE, EACH WITH THE RIBBON IT HANGS. A dye and its ribbon
   * are one decision, so they are one row: twelve rows, the dye on the left and the thread
   * that has to be visible against it on the right. Both show what the cascade currently
   * resolves -- the look's own dye, and that dye's complement -- until a person changes one,
   * and each is marked and reset on its own.
   *
   * github#4 -- the twelve used to be a wrapped strip of bare colour inputs with one ribbon
   * for the whole library underneath, which is the one arrangement that cannot say which
   * ribbon goes with which book.
   */
  function renderColours() {
    var box = $("mpalette");
    clear(box);
    var chosen = settings.palette.length === 12;
    /* FOUR COLUMNS OF THREE, not one of twelve: twelve rows is a sheet you scroll to reach
     * the buttons on. Four tables rather than one with four column-groups, because a grid
     * can only make as many columns as it has children -- two tables could only ever stand
     * two abreast however wide the sheet got. They fall back to two columns and then one as
     * the sheet narrows. */
    [[0, 3], [3, 6], [6, 9], [9, 12]].forEach(function (range) {
      /* NO COLUMN HEADINGS. Four of them across a sheet is "BOOK RIBBON" written four times
       * over twelve swatches that already say which is which -- and a heading is TEXT, so
       * the column was as wide as the face rendered it and the table came out 109.9px under
       * leather against 107.3 in the others, which is the one thing a look may not do. The
       * hint above the block names the two columns once. */
      var table = el("table", "vs-dyerows");
      var body = DOC.createElement("tbody");
      for (var i = range[0]; i < range[1]; i++) {
        body.appendChild(colourRow(i, chosen));
      }
      table.appendChild(body);
      box.appendChild(table);
    });
    /* Disabled when there is nothing to put back, so the button says whether anything here
     * is the person's. */
    /** @type {HTMLButtonElement} */ (node("mpalettereset")).disabled = !chosen && !anyRibbon();
  }

  /** @param {number} i @param {boolean} chosen @returns {HTMLElement} */
  function colourRow(i, chosen) {
    var row = DOC.createElement("tr");
    var n = DOC.createElement("th");
    n.scope = "row";
    n.textContent = String(i + 1);
    row.appendChild(n);

    var dye = DOC.createElement("td");
    dye.appendChild(slotControl(SLOTS[i], "Colour " + (i + 1), "",
      chosen && toHex(SLOTS[i]) !== OWN.slots[i],
      function (hex) { pickSlot(i, hex); },
      function () { resetSlot(i); }));
    row.appendChild(dye);

    var ribbon = DOC.createElement("td");
    var thread = slotControl(ribbonFor(SLOTS[i]), "Ribbon on colour " + (i + 1), "",
      !!settings.ribbons[i],
      function (hex) { setRibbon(i, hex); },
      function () { setRibbon(i, ""); });
    var face = thread.querySelector(".vs-swatch");
    if (face) face.classList.add("vs-ribbonswatch");
    ribbon.appendChild(thread);
    row.appendChild(ribbon);
    return row;
  }

  /** @returns {boolean} */
  function anyRibbon() {
    return settings.ribbons.some(function (r) { return !!r; });
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
    /* github#0 -- THE TWELVE FIRST, THE WHOLE SPECTRUM SECOND. A slot's swatch used to open the
     * operating system's colour picker, which offers sixteen million colours and none of the
     * twelve this library is actually painted in -- so putting slot 7's dye on a ribbon meant
     * reading a hex out of one control and typing it into another. The twelve are the answer
     * nearly every time; "Custom" is still there for the other times. */
    on(sw, "click", function () {
      openSwatchPick(sw, hex, name, function (chosenHex) { pick(chosenHex); },
                     function () { input.click(); }, changed ? reset : null);
    });
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

  /* ---- the twelve, offered ------------------------------------------------------
   * github#0 -- one popover, wherever a colour is chosen in the Manage sheet.
   */

  /** @type {boolean} */
  var picking = false;

  /**
   * @param {HTMLElement} anchor @param {string} current @param {string} name
   * @param {(hex: string) => void} pick @param {() => void} custom @param {(() => void)|null} reset
   */
  function openSwatchPick(anchor, current, name, pick, custom, reset) {
    var menu = node("swatchpick");
    clear(menu);
    picking = true;
    menu.appendChild(el("div", "vs-dyename", name));
    var row = el("div", "vs-swatches");
    SLOTS.forEach(function (colour, i) {
      var one = /** @type {HTMLButtonElement} */ (el("button", "vs-swatch"));
      one.type = "button";
      one.style.setProperty("--swatch", colour);
      one.title = "Colour " + (i + 1) + " " + toHex(colour);
      one.setAttribute("aria-label", one.title);
      if (toHex(colour) === current) one.setAttribute("aria-pressed", "true");
      on(one, "click", function () { closeSwatchPick(); pick(toHex(colour)); });
      row.appendChild(one);
    });
    menu.appendChild(row);
    var other = /** @type {HTMLButtonElement} */ (el("button", "vs-dyeauto", "Custom\u2026"));
    other.type = "button";
    on(other, "click", function () { closeSwatchPick(); custom(); });
    menu.appendChild(other);
    if (reset) {
      var back = /** @type {HTMLButtonElement} */ (el("button", "vs-dyeauto", "Back to the look's own"));
      back.type = "button";
      on(back, "click", function () { closeSwatchPick(); reset(); });
      menu.appendChild(back);
    }
    menu.hidden = false;
    var host = root.getBoundingClientRect();
    var at = anchor.getBoundingClientRect();
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.min(at.left - host.left, host.width - w - 8);
    var top = Math.min(at.bottom - host.top + 6, host.height - h - 8);
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";
    var first = menu.querySelector("button");
    if (first instanceof HTMLElement) first.focus();
  }

  function closeSwatchPick() {
    picking = false;
    $("swatchpick").hidden = true;
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
    renderColours();
  }

  /**
   * One slot's ribbon. Empty, or the complement it already was, is stored as empty -- so a
   * ribbon that was never really chosen keeps following its dye through a look switch.
   * @param {number} i @param {string} hex
   */
  function setRibbon(i, hex) {
    settings.ribbons[i] = hex && hex !== OWN.ribbons[i] ? hex : "";
    persist();
    refresh();
    renderColours();
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
      var again = findBook(reader.book.id, reader.noteId);
      if (again) {
        reader.book = again;
        /* github#32 -- a rebuilt book has its own rows, so the index fitted to the old one is
         * not an index of this one; the next draw measures it again. */
        reader.tabs = null;
        /* github#5 -- THE PLACE IS A NOTE, NOT A ROW NUMBER. */
        var at = -1;
        if (reader.noteId) {
          for (var ri = 0; ri < again.notes.length; ri++) {
            if (again.notes[ri].id === reader.noteId) { at = ri; break; }
          }
        }
        reader.index = at >= 0 ? at : Math.min(reader.index, Math.max(0, again.notes.length - 1));
        if (at < 0 && again.notes.length) reader.noteId = again.notes[reader.index].id;
        renderReader();
      } else {
        closeReader();
      }
    }
  }

  /* ============================================================ the wiring == */

  watchRoom();
  takeOffZone($("shelves"));
  shelfDropZone($("shelves"));
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
  on($("newshelf"), "click", function () { openBuilder(null, "top"); });
  on($("newshelf2"), "click", function () { openBuilder(null, "end"); });
  on($("manageopen"), "click", openManage);
  /* github#4 -- palette and ribbon together; a slot's own mark puts one slot back. */
  on($("mpalettereset"), "click", function () {
    settings.palette = [];
    settings.ribbons = settings.ribbons.map(function () { return ""; });
    persist();
    readTheme();
    refresh();
    renderColours();
  });
  /* The dye menu closes the way a menu does: a click anywhere else, or Escape. */
  on(DOC, "mousedown", function (e) {
    if (dyeing && e.target instanceof Node && !$("dye").contains(e.target)) closeDye();
    if (railing && e.target instanceof Node && !$("railmenu").contains(e.target)) closeRailMenu();
    if (picking && e.target instanceof Node && !$("swatchpick").contains(e.target)) closeSwatchPick();
  });
  on(DOC, "keydown", function (e) {
    if (dyeing && /** @type {KeyboardEvent} */ (e).key === "Escape") closeDye();
    if (railing && /** @type {KeyboardEvent} */ (e).key === "Escape") closeRailMenu();
    if (picking && /** @type {KeyboardEvent} */ (e).key === "Escape") closeSwatchPick();
  });
  /* design/0020 -- the made-book sheet's controls. */
  on($("mbsave"), "click", saveMadeBook);
  on($("mbcancel"), "click", closeMadeBook);
  on($("mbdelete"), "click", function () {
    if (!making || !making.key) return;
    var shelf = making.shelf, key = making.key;
    closeMadeBook();
    deleteMadeBook(shelf, key);
  });
  ["mbname", "mbsource", "mbsourceval"].forEach(function (id) {
    on($(id), "change", function () { readMadeFields(); previewMadeBook(); });
    on($(id), "input", function () { readMadeFields(); previewMadeBook(); });
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
  on($("bdelete"), "click", function () {
    if (!builder || !builder.editing) return;
    var bin = /** @type {HTMLButtonElement} */ (node("bdelete"));
    if (bin.getAttribute("data-armed") !== "1") {
      bin.setAttribute("data-armed", "1");
      bin.textContent = "Really delete?";
      return;
    }
    var id = builder.editing;
    closeBuilder();
    deleteShelf(id);
  });
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
      if (!$("madebook").hidden) { closeMadeBook(); return; }
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
    /* github#0 -- the same act from the keyboard, on the key every reader uses for it. */
    var ke = /** @type {KeyboardEvent} */ (e);
    if ((ke.ctrlKey || ke.metaKey) && String(ke.key).toLowerCase() === "f") {
      findInBook();
      ke.preventDefault();
      return;
    }
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
    /**
     * design/0019 -- a drop onto a pick shelf and a take-off, without a pointer: the same two
     * writes the rail, the spines and the menu make. `onto` names which pick shelf; without it
     * the first one, which is what a library with one of them means.
     * @param {string} sourceId @param {string|null} [before] @param {string} [onto]
     */
    pick: function (sourceId, before, onto) {
      var shelf = onto ? shelfById(onto) : pickShelves()[0];
      if (!shelf || !isPick(shelf)) return false;
      arrangeBook(shelf, sourceId, before === undefined ? null : before);
      return true;
    },
    /** design/0019 -- is this spine on its way off the shelf? @param {string} bookId */
    leaving: function (bookId) {
      var spine = root.querySelector("#" + ID + 'shelves [data-book="' + cssEscape(bookId) + '"]');
      return !!spine && spine.getAttribute("data-leaving") === "1";
    },
    /** @param {string} sourceId @param {string} [from] */
    unpick: function (sourceId, from) {
      var shelf = from ? shelfById(from) : pickShelves()[0];
      if (!shelf || !isPick(shelf)) return false;
      takeOff(shelf, sourceId);
      return true;
    },
    /** github#0 -- delete a shelf, the way the second press of the Manage button does.
     * @param {string} id */
    deleteShelf: function (id) {
      var had = settings.shelves.length;
      deleteShelf(id);
      return settings.shelves.length === had - 1;
    },
    /** github#0 -- carry a shelf by its floor and drop it above or below another.
     * @param {string} id @param {string} beforeId @param {"before"|"after"} side */
    moveShelf: function (id, beforeId, side) {
      moveShelf(id, beforeId, side === "after" ? "after" : "before");
      return views.map(function (v) { return v.shelf.id; });
    },
    /** github#0 -- open the builder on an existing shelf, as Manage's Edit does.
     * @param {string} id */
    editShelf: function (id) {
      var shelf = shelfById(id);
      if (!shelf) return false;
      openBuilder(shelf);
      return true;
    },
    /** github#0 -- open the builder as one of the two "+ New shelf" buttons does.
     * @param {"top"|"end"} at */
    newShelf: function (at) { openBuilder(null, at); },
    /** design/0019 -- every pick shelf the library is showing, with what each one holds. */
    picks: function () {
      return pickShelves().map(function (s) {
        return { id: s.id, name: s.name, picks: (s.picks || []).slice() };
      });
    },
    /**
     * design/0020 -- the write the sheet's Save makes; returns the address.
     * @param {string} shelfId @param {import("./core/index").MadeBook} def @param {string|null} [before]
     */
    makeBook: function (shelfId, def, before) {
      var shelf = shelfById(shelfId);
      if (!shelf || shelf.direction !== "manual") return "";
      var key = writeMadeBook(shelf, null, core.clone(def), before === undefined ? null : before);
      return core.bookId(shelf.id, key);
    },
    /** design/0020 -- edit a made book; the address stays.
     * @param {string} bookId @param {import("./core/index").MadeBook} def */
    editBook: function (bookId, def) {
      var book = findBook(bookId);
      var shelf = book ? shelfById(book.shelfId) : null;
      if (!book || !shelf || !shelf.made || !shelf.made[book.key]) return false;
      writeMadeBook(shelf, book.key, core.clone(def), null);
      return true;
    },
    /** design/0020 -- delete a made book, as the menu and the drag do.
     * @param {string} bookId */
    unmakeBook: function (bookId) {
      var book = findBook(bookId);
      var shelf = book ? shelfById(book.shelfId) : null;
      if (!book || !shelf || !core.isMadeKey(book.key)) return false;
      takeOff(shelf, book.key);
      return true;
    },
    /** design/0020 -- the books made on one pick shelf, by key.
     * @param {string} shelfId */
    made: function (shelfId) {
      var shelf = shelfById(shelfId);
      return shelf && shelf.made ? core.clone(shelf.made) : {};
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
