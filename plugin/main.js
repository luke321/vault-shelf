import { addIcon, Component, ItemView, MarkdownRenderer, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { mountVaultShelf } from "../src/page.js";
import * as core from "../src/core/index";
import PAGE_HTML from "raw:../src/page.html";
import WHATS_NEW from "raw:./whats-new.md";
import RELEASES from "vs:releases";
import { CHAIN_MAX, decideNote, minorOf, parseNote, releaseChain } from "./update-note.mjs";

export const VIEW_TYPE = "vault-shelf-view";
export const ICON_ID = "vault-shelf-books";

// github#33, design/0023
const RELEASE_URL = "https://github.com/luke321/vault-shelf/releases/tag/";
const RELEASES_URL = "https://github.com/luke321/vault-shelf/releases";
const GALLERY_URL = "https://luke321.github.io/vault-shelf/features.html";
const NEW_CLASS = "vs-new";

// github#5 -- how long a burst of changes may coalesce, in ms
export const REBUILD_MS = 400;

/* ================================================================= the icon ==
 * design/0005 -- a shelf, not a book. Obsidian's own `library` icon is a stack of volumes and
 * reads as "a book" at 18px, which is the wrong noun: the thing in the sidebar is the room,
 * not one volume.
 *
 * THREE BOOKS, NOT SIX, AND ONE SHELF, NOT TWO. Rendered at 16, 18, 20, 24, 32, 64 and 128px
 * and looked at: a two-shelf version with six books is a legible bookcase at 64px and an
 * illegible smudge at 18, which is the only size the ribbon ever draws. Three shapes with
 * 6-unit gaps stay separate down to 16px.
 *
 * Filled spines, stroked rail. A stroked outline at 18px leaves under a device pixel of
 * daylight inside each book and fills in; a filled rail at that size is a smear.
 *
 * ONE BOOK LEANS. A bookcase frame around upright books (drawn, compared, rejected) reads as a
 * bar chart in a box. The leaning book is what makes it a shelf somebody uses.
 */
function shelfIcon() {
  return [
    '<g fill="currentColor" stroke="none">',
    '<rect x="16" y="28" width="16" height="43" rx="3"/>',
    '<rect x="38" y="14" width="16" height="57" rx="3"/>',
    '<path d="M60 71 68 26 82 29 74 71Z"/>',
    '</g>',
    '<path d="M8 78h84" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>',
  ].join("");
}

/** @typedef {import("../src/page.js").ShelfNote} ShelfNote */
/** @typedef {import("../src/page.js").ShelfData} ShelfData */
/** @typedef {import("../src/core/index").Persisted} Persisted */

/**
 * Swallow and return, so a teardown step that fails does not strand the rest.
 * @param {() => void} fn
 * @returns {unknown}
 */
function attempt(fn) {
  try { fn(); return null; } catch (e) { return e; }
}

/* ================================================================ the data ==
 * decisions/0005 -- the plugin reads Obsidian's metadata cache, never the filesystem. The
 * cache already knows every note's frontmatter, tags and links, it is kept current by the
 * app, and reading files behind the app's back is how a plugin ends up disagreeing with the
 * vault it is displaying.
 */

/**
 * @param {import("obsidian").App} app
 * @param {Persisted} settings
 * @returns {ShelfData}
 */
export function buildData(app, settings) {
  const files = app.vault.getMarkdownFiles().slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  /** @type {ShelfNote[]} */
  const notes = [];
  /** @type {Map<string, number>} */
  const folderCounts = new Map();

  /* decisions/0003 -- WHICH NOTES ARE PEOPLE, decided once before any note is read. A vault
   * that keeps a note per person links to it rather than repeating the name in a property,
   * and the link is the declaration: the target says what it is. The rule is the person's own
   * (`type: people`, or `#person`), and the name a link earns is the target's `name` property
   * or its title -- so `[[Ada Lovelace|Ada]]` and `[[Ada Lovelace]]` are one person, which a
   * property could not have promised. */
  /** @type {Map<string, string>} */
  const personByPath = new Map();
  if (settings.personNote) {
    for (const file of files) {
      const cache = app.metadataCache.getFileCache(file);
      const fm = cache && cache.frontmatter ? cache.frontmatter : {};
      if (!core.isPersonNote(settings.personNote, propsOf(fm, settings), tagsOf(cache, fm))) continue;
      const named = typeof fm.name === "string" && fm.name.trim() ? fm.name.trim() : file.basename;
      personByPath.set(file.path, core.cleanPerson(named) || file.basename);
    }
  }

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    /** @type {Record<string, unknown>} */
    const fm = cache && cache.frontmatter ? cache.frontmatter : {};
    const folder = file.path.indexOf("/") < 0 ? "(vault root)" : file.path.slice(0, file.path.indexOf("/"));
    const props = propsOf(fm, settings);

    const stamp = settings.useFileStamp
      ? core.stampOf(file.stat.ctime, file.stat.mtime)
      : null;
    const date = core.resolveDate(props, file.basename, stamp, settings.dateFields);
    const tags = tagsOf(cache, fm);

    /* decisions/0003 -- EVERY people property, merged. A vault does not use one name for
     * them: meeting notes carry `attendees`, a 1-on-1 carries `person`, something written by
     * hand carries `people`. Reading only the first is how a People shelf comes up empty in a
     * vault that is full of people.
     * @type {string[]} */
    const people = [];
    for (const field of settings.peopleFields) {
      const raw = fm[field];
      if (Array.isArray(raw)) {
        for (const p of raw) if (typeof p === "string") people.push(core.cleanPerson(p));
      } else if (typeof raw === "string") {
        people.push(core.cleanPerson(raw));
      }
    }
    /* ...and every link to a person's note, body and frontmatter alike, resolved the way the
     * app resolves it so an alias, a subfolder or a shortest-path link all land. A person's
     * own note does not name itself. */
    if (personByPath.size && cache) {
      const links = (cache.links || []).concat(cache.frontmatterLinks || []);
      for (const link of links) {
        const target = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (!target || target.path === file.path) continue;
        const who = personByPath.get(target.path);
        if (who) people.push(who);
      }
    }

    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
    notes.push({
      id: file.path,
      path: file.path,
      title: file.basename,
      folder,
      date,
      people: [...new Set(people.filter(Boolean))].sort(),
      tags: [...new Set(tags)].sort(),
      props,
      excerpt: "",
      body: "",
    });
  }

  const folders = [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([path, count], i) => ({ path, count, slot: i }));

  return {
    vault: app.vault.getName(),
    generated: new Date().toISOString().slice(0, 16).replace("T", " "),
    notes,
    folders,
    stats: {
      notes: notes.length,
      dated: notes.filter((n) => n.date !== null).length,
      people: new Set(notes.flatMap((n) => n.people)).size,
      tags: new Set(notes.flatMap((n) => n.tags)).size,
    },
  };
}


/**
 * Scalar frontmatter as strings, minus the fields that have first-class homes.
 * @param {Record<string, unknown>} fm @param {Persisted} settings @returns {Record<string, string>}
 */
function propsOf(fm, settings) {
  /** @type {Record<string,string>} */
  const props = {};
  for (const key of Object.keys(fm)) {
    if (key === "position" || key === "tags" || settings.peopleFields.indexOf(key) >= 0) continue;
    const value = fm[key];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      props[key] = String(value);
    }
  }
  return props;
}

/**
 * Every tag on a note, from the body and the frontmatter, without its `#`.
 * @param {import("obsidian").CachedMetadata | null} cache
 * @param {Record<string, unknown>} fm
 * @returns {string[]}
 */
function tagsOf(cache, fm) {
  /** @type {string[]} */
  const tags = [];
  if (cache && cache.tags) for (const t of cache.tags) tags.push(t.tag.replace(/^#/, ""));
  const fmTags = fm.tags;
  if (Array.isArray(fmTags)) {
    for (const t of fmTags) if (typeof t === "string") tags.push(t.replace(/^#/, ""));
  } else if (typeof fmTags === "string") {
    for (const t of fmTags.split(/[,\s]+/)) if (t) tags.push(t.replace(/^#/, ""));
  }
  return tags;
}

/**
 * The `a.internal-link` under a mouse event, if there is one.
 * @param {MouseEvent} evt @returns {HTMLElement|null}
 */
function linkUnder(evt) {
  const target = evt.target;
  if (!(target instanceof HTMLElement)) return null;
  const anchor = target.closest("a.internal-link");
  return anchor instanceof HTMLElement ? anchor : null;
}

/* ================================================================= the view == */

export class ShelfView extends ItemView {
  /** @param {import("obsidian").WorkspaceLeaf} leaf @param {VaultShelfPlugin} plugin */
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.handle = null;
    /** @type {HTMLElement|null} */
    this.page = null;
    /** @type {Component|null} github#99 -- the open note's renderer */
    this.noteComponent = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Vault shelf"; }
  getIcon() { return ICON_ID; }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("vault-shelf-view");
    this.mountNote();

    // Parsed, not assigned: the markup is ours and static, and building it through innerHTML
    // would put a sink in the shipped bundle that a reviewer has to take on trust.
    const parsed = new DOMParser().parseFromString(PAGE_HTML, "text/html");
    const page = parsed.body.firstElementChild;
    if (!page) throw new Error("page markup did not parse to an element");
    root.appendChild(page);

    this.page = page;
    this.syncTheme();
    this.registerEvent(this.app.workspace.on("css-change", () => this.syncTheme()));

    this.handle = mountVaultShelf(page, buildData(this.app, this.plugin.config), {
      core,
      settings: this.plugin.config,
      onSettings: (next) => { void this.plugin.saveSettings(next); },
      onOpenNote: (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
      },
      renderNote: (into, note) => this.renderNote(into, note),
    });

    this.markNew();
  }

  /* ------------------------------------------------- the update note (github#33) */

  // github#33, design/0023 -- above the page root, so the library re-fits around it
  mountNote() {
    const note = this.plugin.pendingNote;
    if (!note) return;
    const strip = this.contentEl.createDiv({ cls: "vs-whatsnew", attr: { role: "status" } });
    const head = strip.createDiv({ cls: "vs-whatsnew-head" });
    head.createEl("strong", { text: "What's new in Vault Shelf " + minorOf(note.version) });
    const links = { target: "_blank", rel: "noopener" };
    // github#33 -- every release since the one last seen, oldest first
    const chain = head.createSpan({ cls: "vs-whatsnew-chain" });
    const all = this.plugin.pendingChain;
    const shown = all.length > CHAIN_MAX ? all.slice(all.length - CHAIN_MAX) : all;
    if (shown.length < all.length) {
      chain.createEl("a", { text: "…", href: RELEASES_URL,
                            attr: Object.assign({ title: (all.length - shown.length) + " earlier releases" }, links) });
      chain.appendText(" – ");
    }
    shown.forEach((r, i) => {
      if (i) chain.appendText(" – ");
      chain.createEl("a", { text: r.version, href: RELEASE_URL + r.version,
                            attr: r.name ? Object.assign({ title: r.name }, links) : links });
    });
    head.createEl("a", { text: "Feature gallery", href: GALLERY_URL, attr: links });
    const list = strip.createEl("ul");
    for (const line of note.lines) list.createEl("li", { text: line });
    const ok = strip.createEl("button", { text: "Got it", cls: "vs-whatsnew-ok", attr: { type: "button" } });
    this.registerDomEvent(ok, "click", () => { void this.dismissNote(strip); });
  }

  // github#33, design/0023 -- the controls the note points at, while it is up
  markNew() {
    const note = this.plugin.pendingNote;
    if (!note || !this.page) return;
    for (const id of note.points) {
      const el = this.page.querySelector("#" + id);
      if (el instanceof HTMLElement) el.addClass(NEW_CLASS);
    }
  }

  // github#33 -- dismissing is the write that marks the version seen
  /** @param {HTMLElement} strip */
  async dismissNote(strip) {
    strip.remove();
    this.plugin.pendingNote = null;
    // github#33 -- a second leaf has its own copy, and its own pulse
    this.plugin.eachView((view) => {
      view.contentEl.querySelectorAll(".vs-whatsnew").forEach((el) => el.remove());
      view.contentEl.querySelectorAll("." + NEW_CLASS).forEach((el) => el.removeClass(NEW_CLASS));
    });
    await this.plugin.recordVersion();
  }

  /* design/0005 -- the library follows the app. Obsidian fires css-change when the theme or
   * a snippet changes, which is the only signal that the twelve slots may now resolve to
   * different values; the page re-reads them rather than repainting from a stale array. */
  syncTheme() {
    if (!this.page) return;
    const want = document.body.classList.contains("theme-dark") ? "dark" : "light";
    if (this.page.getAttribute("data-theme") === want) return;
    this.page.setAttribute("data-theme", want);
    if (this.handle) attempt(() => this.handle.readTheme());
  }

  /**
   * design/0010 -- OBSIDIAN'S OWN RENDERER, over the file's own text.
   *
   * buildData deliberately never reads a file (decisions/0005): the metadata cache holds
   * everything a shelf needs and reading the vault behind the app's back is how a plugin ends
   * up disagreeing with it. Rendering ONE open note is the other case entirely -- it is one
   * file, on demand, through the app's own cachedRead, and the alternative is showing a
   * two-line excerpt of a note the reader is looking straight at.
   *
   * @param {HTMLElement} into @param {import("../src/page.js").ShelfNote} note
   */
  async renderNote(into, note) {
    // github#99 -- one note, one component
    if (this.noteComponent) this.removeChild(this.noteComponent);
    this.noteComponent = null;
    const file = this.app.vault.getAbstractFileByPath(note.path);
    if (!(file instanceof TFile)) {
      into.createEl("p", { text: "That note is no longer in the vault." });
      return;
    }
    const owner = this.addChild(new Component());
    this.noteComponent = owner;
    const text = await this.app.vault.cachedRead(file);
    if (this.noteComponent !== owner) return;
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    /* design/0010 -- THE RENDERER IS ONLY HALF OF IT. `MarkdownRenderer.render` produces
     * Obsidian's own markup, and Obsidian styles that markup through a class it expects on the
     * container: without `markdown-rendered` a table is an unstyled table, a callout is a
     * blockquote and a code block has no chrome. It looked like the wrong renderer and was the
     * right renderer in an unmarked box. */
    into.addClass("markdown-rendered");
    await MarkdownRenderer.render(this.app, body, into, note.path, owner);

    /* AND A LINK IS A LINK. `internal-link` anchors carry a `data-href` and no behaviour of
     * their own -- the workspace does the opening, and in a view of our own nobody had asked
     * it to, so every wikilink in a note was inert. */
    owner.registerDomEvent(into, "click", (evt) => {
      const anchor = linkUnder(evt);
      if (!anchor) return;
      const href = anchor.getAttribute("data-href") || anchor.getAttribute("href");
      if (!href) return;
      evt.preventDefault();
      /* design/0004 -- IN THE LIBRARY FIRST. A link followed from a book goes to that note in
       * this book, this shelf or the nearest one; only a note the library does not hold --
       * or a Ctrl/Cmd-click, which is the ask for a real pane -- goes to Obsidian's editor. */
      const wantsPane = evt.ctrlKey || evt.metaKey;
      if (!wantsPane && this.handle) {
        const target = this.app.metadataCache.getFirstLinkpathDest(href.split("#")[0], note.path);
        if (target && this.handle.openNote(target.path)) return;
      }
      void this.app.workspace.openLinkText(href, note.path, wantsPane);
    });

    /* The hover preview every other view gives you, through the same event the app listens
     * for; without it a link in here is the one link in Obsidian that does not preview. */
    owner.registerDomEvent(into, "mouseover", (evt) => {
      const anchor = linkUnder(evt);
      if (!anchor) return;
      const href = anchor.getAttribute("data-href") || anchor.getAttribute("href");
      if (!href) return;
      this.app.workspace.trigger("hover-link", {
        event: evt, source: VIEW_TYPE, hoverParent: this, targetEl: anchor,
        linktext: href, sourcePath: note.path,
      });
    });
  }

  /** The Refresh command and the metadata-cache listener both land here. */
  rebuild() {
    if (this.handle) this.handle.refresh(buildData(this.app, this.plugin.config));
  }

  /* design/0016 -- the settings tab wrote a field the mounted page keeps its own copy of, so
   * the page is told rather than left to find out when it is next opened. Only the tab calls
   * this: the page's own persist() is where those settings came from, and handing them back
   * would re-render the room every time a book is opened. */
  // github#100 -- also rebuild the notes; settings alone leaves them stale
  adopt() {
    if (!this.handle) return;
    this.handle.setSettings(this.plugin.config);
    this.handle.refresh(buildData(this.app, this.plugin.config));
  }

  onClose() {
    if (this.handle) attempt(() => this.handle.destroy());
    this.handle = null;
    this.page = null;
    if (this.noteComponent) this.removeChild(this.noteComponent);
    this.noteComponent = null;
    this.contentEl.empty();
  }
}

/* =============================================================== the plugin == */

export default class VaultShelfPlugin extends Plugin {
  /* NOT `settings`. Obsidian 1.13 put a `settings` property on Plugin itself, and this
   * plugin's minAppVersion is 1.7.2 -- obsidianmd/no-unsupported-api reports every read of
   * the inherited one. A field of our own, with its own name and its own type, is not that
   * property and cannot be mistaken for it. */
  /** @type {Persisted} */
  config = core.emptySettings();

  /** @type {number} */
  pending = 0;

  /** @type {number} */
  rebuilds = 0;

  // github#33 -- the note the next view mount shows, until it is dismissed
  /** @type {import("./update-note.mjs").UpdateNote | null} */
  pendingNote = null;

  /** @type {import("./update-note.mjs").Release[]} */
  pendingChain = [];

  // github#33, design/0023 -- the marker cannot live in `config`
  /** @type {string | undefined} */
  lastSeenVersion = undefined;

  async onload() {
    /** @type {unknown} */
    const saved = await this.loadData();
    this.config = core.migrate(saved);
    this.lastSeenVersion = versionSeenIn(saved);

    // github#33, design/0023 -- decided once per load; a shown note is recorded on dismiss
    const verdict = decideNote({
      installed: this.manifest.version,
      lastSeen: this.lastSeenVersion,
      hadData: saved !== null && saved !== undefined,
      note: parseNote(WHATS_NEW).note,
    });
    this.pendingNote = verdict.show;
    this.pendingChain = verdict.show
      ? releaseChain({ releases: RELEASES, lastSeen: this.lastSeenVersion,
                       installed: this.manifest.version, note: verdict.show })
      : [];
    if (verdict.record) await this.recordVersion();

    this.registerView(VIEW_TYPE, (leaf) => new ShelfView(leaf, this));

    addIcon(ICON_ID, shelfIcon());
    this.addRibbonIcon(ICON_ID, "Vault shelf", () => { void this.activate(); });

    this.addCommand({
      id: "open",
      name: "Open the library",
      callback: () => { void this.activate(); },
    });

    this.addCommand({
      id: "refresh",
      name: "Rebuild from the metadata cache",
      callback: () => { this.eachView((view) => view.rebuild()); },
    });

    this.addSettingTab(new ShelfSettingTab(this.app, this));

    // github#5 -- the three signals that a note's metadata moved
    this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRebuild()));
    this.registerEvent(this.app.metadataCache.on("deleted", () => this.scheduleRebuild()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRebuild()));
  }

  /* github#5 -- one rebuild per burst, not one per changed file */
  scheduleRebuild() {
    if (this.pending) return;
    this.pending = window.setTimeout(() => {
      this.pending = 0;
      this.rebuildViews();
    }, REBUILD_MS);
  }

  /** github#5 -- every open library, rebuilt from the cache */
  rebuildViews() {
    this.rebuilds++;
    this.eachView((view) => view.rebuild());
  }

  onunload() {
    if (this.pending) window.clearTimeout(this.pending);
    this.pending = 0;
    this.eachView((view) => attempt(() => view.onClose()));
  }

  /** @param {(view: ShelfView) => void} fn */
  eachView(fn) {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      // Since Obsidian 1.7.2 a tab restored in the background is DEFERRED: the leaf is real
      // and getLeavesOfType finds it, but leaf.view is a placeholder until something reveals
      // it. Reaching into a placeholder as if it were the view is the bug that costs an hour.
      const view = leaf.view;
      if (view instanceof ShelfView) fn(view);
    }
  }

  async activate() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length) {
      await this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  /** @param {Persisted} next */
  async saveSettings(next) {
    this.config = core.migrate(next);
    await this.saveData(this.persisted());
  }

  // github#33, design/0023 -- config, with the host's marker put back
  /** @returns {Record<string, unknown>} */
  persisted() {
    const out = /** @type {Record<string, unknown>} */ (Object.assign({}, this.config));
    if (this.lastSeenVersion !== undefined) out.lastSeenVersion = this.lastSeenVersion;
    return out;
  }

  // github#33, design/0023 -- the marker onto what is on disk, never onto nothing
  async recordVersion() {
    /** @type {unknown} */
    const disk = await this.loadData();
    const base = disk && typeof disk === "object" ? /** @type {Record<string, unknown>} */ (disk) : {};
    this.lastSeenVersion = this.manifest.version;
    await this.saveData(Object.assign({}, base, { lastSeenVersion: this.manifest.version }));
  }
}

// github#33 -- what a data.json says it last saw, verbatim
/** @param {unknown} saved @returns {string | undefined} */
function versionSeenIn(saved) {
  if (!saved || typeof saved !== "object") return undefined;
  const v = /** @type {Record<string, unknown>} */ (saved).lastSeenVersion;
  return v === undefined || v === null ? undefined : String(v);
}

/* ============================================================ the settings ==
 * Obsidian 1.13 renders a settings tab from getSettingDefinitions() -- that is also what its
 * settings search indexes -- and does not call display() when the definitions are non-empty.
 * Below 1.13 only display() exists. minAppVersion is 1.7.2, so BOTH are here, built from the
 * same table (SETTINGS), so what one path shows the other shows too.
 */

/**
 * design/0016 -- THE LOOK IS NOT IN HERE. It used to be a toggle on this tab and a button
 * bolted to the standalone's chrome; it is now one selector in the library's own top bar,
 * which serves both hosts and is where you are standing when you want to change it. A setting
 * that lives two places drifts, and a third look would have needed a dropdown here anyway.
 *
 * @type {{ key: "dateFields" | "peopleFields" | "personNote" | "useFileStamp", name: string, desc: string, kind: "text" | "toggle" }[]}
 */
const SETTINGS = [
  { key: "dateFields", kind: "text",
    name: "Date properties",
    desc: "Comma-separated frontmatter fields, tried in order. A note with none of them " +
          "falls back to a date in its title." },
  { key: "peopleFields", kind: "text",
    name: "People properties",
    desc: "Comma-separated frontmatter properties that name people, merged -- `people, " +
          "attendees, person` by default, because a vault rarely uses one of them. Values " +
          "may be wikilinks. People are never inferred from a note's prose." },
  { key: "personNote", kind: "text",
    name: "What makes a note a person",
    desc: "A link to a note that matches this names that person: `type: people` (a property " +
          "and its value) or `#person` (a tag). Empty turns it off. The name comes from the " +
          "note's `name` property or its title, so an alias in the link still counts as the " +
          "same person." },
  { key: "useFileStamp", kind: "toggle",
    name: "Fall back to the file's creation date",
    desc: "On by default. A note with no date property and no date in its title takes the " +
          "earliest stamp the filesystem has for it -- which survives a bulk reformat and a " +
          "copied vault better than either stamp alone. Turn it off to send those notes to " +
          "Undated instead, where you can see how many there are." },
];

class ShelfSettingTab extends PluginSettingTab {
  /** @param {import("obsidian").App} app @param {VaultShelfPlugin} plugin */
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * The declarative tab, for 1.13 and later.
   * @returns {import("obsidian").SettingDefinitionItem[]}
   */
  getSettingDefinitions() {
    return SETTINGS.map((s) => {
      if (s.kind === "toggle") {
        return { name: s.name, desc: s.desc,
                 control: { type: /** @type {"toggle"} */ ("toggle"), key: s.key,
                            defaultValue: false } };
      }
      return { name: s.name, desc: s.desc,
               control: { type: /** @type {"text"} */ ("text"), key: s.key, defaultValue: "" } };
    });
  }

  /** @param {string} key @returns {unknown} */
  getControlValue(key) {
    if (key === "dateFields") return this.plugin.config.dateFields.join(", ");
    if (key === "peopleFields") return this.plugin.config.peopleFields.join(", ");
    if (key === "personNote") return this.plugin.config.personNote;
    if (key === "useFileStamp") return this.plugin.config.useFileStamp;
    return undefined;
  }

  /** @param {string} key @param {unknown} value */
  async setControlValue(key, value) {
    this.write(key, value);
    await this.plugin.saveSettings(this.plugin.config);
    this.plugin.eachView((view) => view.adopt());
  }

  /**
   * The one place a setting is written, so the declarative path and display() cannot drift.
   * @param {string} key @param {unknown} value
   */
  write(key, value) {
    if (key === "dateFields") {
      const fields = String(value).split(",").map((s) => s.trim()).filter(Boolean);
      this.plugin.config.dateFields = fields.length ? fields : ["date"];
      return;
    }
    if (key === "peopleFields") {
      const fields = String(value).split(",").map((f) => f.trim()).filter(Boolean);
      this.plugin.config.peopleFields = fields.length ? fields : ["people"];
      return;
    }
    if (key === "personNote") { this.plugin.config.personNote = String(value).trim(); return; }
    if (key === "useFileStamp") this.plugin.config.useFileStamp = value === true;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    for (const def of SETTINGS) {
      const setting = new Setting(containerEl).setName(def.name).setDesc(def.desc);
      const save = (/** @type {unknown} */ value) => {
        this.write(def.key, value);
        void this.plugin.saveSettings(this.plugin.config);
        this.plugin.eachView((view) => view.adopt());
      };
      if (def.kind === "toggle") {
        setting.addToggle((toggle) => toggle
          .setValue(this.getControlValue(def.key) === true)
          .onChange(save));
      } else {
        setting.addText((text) => text
          .setValue(String(this.getControlValue(def.key)))
          .onChange(save));
      }
    }

    new Setting(containerEl)
      .setName("Restore every shelf")
      .setDesc("Un-hides every shelf. Hiding never deleted one.")
      .addButton((button) => button
        .setButtonText("Show all")
        .onClick(() => {
          for (const shelf of this.plugin.config.shelves) shelf.hidden = false;
          void this.plugin.saveSettings(this.plugin.config);
        }));
  }
}
