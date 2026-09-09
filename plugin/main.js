import { addIcon, ItemView, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import { mountVaultShelf } from "../src/page.js";
import * as core from "../src/core/index";
import PAGE_HTML from "raw:../src/page.html";

export const VIEW_TYPE = "vault-shelf-view";
export const ICON_ID = "vault-shelf-books";

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

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    /** @type {Record<string, unknown>} */
    const fm = cache && cache.frontmatter ? cache.frontmatter : {};
    const folder = file.path.indexOf("/") < 0 ? "(vault root)" : file.path.slice(0, file.path.indexOf("/"));

    /** @type {Record<string,string>} */
    const props = {};
    for (const key of Object.keys(fm)) {
      if (key === "position" || key === "tags" || key === settings.peopleProperty) continue;
      const value = fm[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        props[key] = String(value);
      }
    }

    const stamp = settings.useFileStamp
      ? new Date(file.stat.mtime).toISOString().slice(0, 10)
      : null;
    const date = core.resolveDate(props, file.basename, stamp, settings.dateFields);

    /** @type {string[]} */
    const tags = [];
    if (cache && cache.tags) for (const t of cache.tags) tags.push(t.tag.replace(/^#/, ""));
    const fmTags = fm.tags;
    if (Array.isArray(fmTags)) {
      for (const t of fmTags) if (typeof t === "string") tags.push(t.replace(/^#/, ""));
    } else if (typeof fmTags === "string") {
      for (const t of fmTags.split(/[,\s]+/)) if (t) tags.push(t.replace(/^#/, ""));
    }

    /** @type {string[]} */
    const people = [];
    const raw = fm[settings.peopleProperty];
    if (Array.isArray(raw)) {
      for (const p of raw) if (typeof p === "string") people.push(cleanLink(p));
    } else if (typeof raw === "string") {
      people.push(cleanLink(raw));
    }

    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
    notes.push({
      id: file.path,
      path: file.path,
      title: file.basename,
      folder,
      date,
      people: [...new Set(people)].sort(),
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
 * decisions/0003 -- a wikilink to a person note is the person; the brackets are not.
 * @param {string} value
 * @returns {string}
 */
function cleanLink(value) {
  const inner = value.replace(/^\[\[|\]\]$/g, "");
  const label = inner.split("|").pop() || inner;
  const leaf = label.split("/").pop() || label;
  return leaf.trim();
}

/* ================================================================= the view == */

export class ShelfView extends ItemView {
  /** @param {import("obsidian").WorkspaceLeaf} leaf @param {VaultShelfPlugin} plugin */
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.handle = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Vault shelf"; }
  getIcon() { return ICON_ID; }

  onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("vault-shelf-view");

    // Parsed, not assigned: the markup is ours and static, and building it through innerHTML
    // would put a sink in the shipped bundle that a reviewer has to take on trust.
    const parsed = new DOMParser().parseFromString(PAGE_HTML, "text/html");
    const page = parsed.body.firstElementChild;
    if (!page) throw new Error("page markup did not parse to an element");
    root.appendChild(page);

    this.handle = mountVaultShelf(page, buildData(this.app, this.plugin.config), {
      core,
      settings: this.plugin.config,
      onSettings: (next) => { void this.plugin.saveSettings(next); },
      onOpenNote: (path) => {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) void this.app.workspace.getLeaf(false).openFile(file);
      },
    });
  }

  /** The Refresh command and the metadata-cache listener both land here. */
  rebuild() {
    if (this.handle) this.handle.refresh(buildData(this.app, this.plugin.config));
  }

  onClose() {
    if (this.handle) attempt(() => this.handle.destroy());
    this.handle = null;
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

  async onload() {
    /** @type {unknown} */
    const saved = await this.loadData();
    this.config = core.migrate(saved);

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
  }

  onunload() {
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
    await this.saveData(this.config);
  }
}

/* ============================================================ the settings ==
 * Obsidian 1.13 renders a settings tab from getSettingDefinitions() -- that is also what its
 * settings search indexes -- and does not call display() when the definitions are non-empty.
 * Below 1.13 only display() exists. minAppVersion is 1.7.2, so BOTH are here, built from the
 * same table (SETTINGS), so what one path shows the other shows too.
 */

/** @type {{ key: "dateFields" | "peopleProperty" | "useFileStamp" | "skin", name: string, desc: string, kind: "text" | "toggle" | "dropdown", options?: [string, string][] }[]} */
const SETTINGS = [
  { key: "dateFields", kind: "text",
    name: "Date properties",
    desc: "Comma-separated frontmatter fields, tried in order. A note with none of them " +
          "falls back to a date in its title." },
  { key: "peopleProperty", kind: "text",
    name: "People property",
    desc: "The frontmatter property that names people. People are never inferred from a " +
          "note's prose." },
  { key: "useFileStamp", kind: "toggle",
    name: "Fall back to the file's own date",
    desc: "Off by default. A file's modification time is almost never the date the note is " +
          "about -- a sync or a bulk reformat restamps the whole vault -- so a note with no " +
          "date property and no date in its title goes to Undated instead." },
  { key: "skin", kind: "dropdown",
    name: "Skin",
    desc: "Graphite is the charcoal archive; Paper & cloth is the same library in warm " +
          "paper. Both have every feature.",
    options: [["graphite", "Graphite"], ["paper", "Paper & cloth"]] },
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
      if (s.kind === "dropdown") {
        return { name: s.name, desc: s.desc,
                 control: { type: /** @type {"dropdown"} */ ("dropdown"), key: s.key,
                            defaultValue: "graphite",
                            options: (s.options || []).map(([value, label]) => ({ value, label })) } };
      }
      return { name: s.name, desc: s.desc,
               control: { type: /** @type {"text"} */ ("text"), key: s.key, defaultValue: "" } };
    });
  }

  /** @param {string} key @returns {unknown} */
  getControlValue(key) {
    if (key === "dateFields") return this.plugin.config.dateFields.join(", ");
    if (key === "peopleProperty") return this.plugin.config.peopleProperty;
    if (key === "useFileStamp") return this.plugin.config.useFileStamp;
    if (key === "skin") return this.plugin.config.skin;
    return undefined;
  }

  /** @param {string} key @param {unknown} value */
  async setControlValue(key, value) {
    this.write(key, value);
    await this.plugin.saveSettings(this.plugin.config);
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
    if (key === "peopleProperty") {
      this.plugin.config.peopleProperty = String(value).trim() || "people";
      return;
    }
    if (key === "useFileStamp") { this.plugin.config.useFileStamp = value === true; return; }
    if (key === "skin") this.plugin.config.skin = value === "paper" ? "paper" : "graphite";
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    for (const def of SETTINGS) {
      const setting = new Setting(containerEl).setName(def.name).setDesc(def.desc);
      const save = (/** @type {unknown} */ value) => {
        this.write(def.key, value);
        void this.plugin.saveSettings(this.plugin.config);
      };
      if (def.kind === "toggle") {
        setting.addToggle((toggle) => toggle
          .setValue(this.getControlValue(def.key) === true)
          .onChange(save));
      } else if (def.kind === "dropdown") {
        setting.addDropdown((drop) => {
          for (const [value, label] of def.options || []) drop.addOption(value, label);
          drop.setValue(String(this.getControlValue(def.key))).onChange(save);
        });
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
