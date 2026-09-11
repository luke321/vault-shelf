import { build, context } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseNote, parseReleases } from "../plugin/update-note.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const WATCH = process.argv.includes("--watch");

/* ------------------------------------------------------------------ assets --
 * `raw:` and `b64:` import prefixes, so main.js can say what it needs and the bundler
 * decides how it travels. Without a namespace plugin there is no way to say "this .html is
 * text, that .png is base64" -- esbuild keys loaders off the extension alone.
 */
const rawLoader = {
  name: "raw-and-base64",
  setup(b) {
    for (const [prefix, loader] of [["raw:", "text"], ["b64:", "base64"]]) {
      const filter = new RegExp("^" + prefix);
      b.onResolve({ filter }, (args) => ({
        path: relative(ROOT, resolve(dirname(args.importer), args.path.slice(prefix.length))).split(sep).join("/"),
        namespace: prefix,
      }));
      b.onLoad({ filter: /.*/, namespace: prefix }, (args) => ({
        contents: readFileSync(join(ROOT, args.path)),
        loader,
      }));
    }
  },
};

/* -------------------------------------------------------------- debug api --
 * The `window.__vs` debug surface (membership reports, address dumps, the counts the suite
 * reads) lives in src/page.js because that is the one file both hosts share -- and none of
 * it has a job inside Obsidian: the invariant suite drives the STANDALONE build over CDP,
 * and the plugin's view has no console a check can reach into anyway. Shipping it is dead
 * weight and a larger review surface than the plugin needs.
 *
 * One region in src/page.js is marked with a matching BEGIN/END comment pair. This removes
 * the TEXT between them before esbuild ever parses the file -- not a runtime flag, because a
 * flag would still ship the source and only hide it, which answers "can a user reach this"
 * but not "is this code in the file".
 *
 * The exporter (src/build-shelf.mjs, src/shell.html) does not go through esbuild at all and
 * is untouched: smoke.mjs runs against that build and needs the region intact.
 *
 * COUNT-CHECKED, not just pattern-matched: a marker pair that silently stops matching -- a
 * typo introduced while editing near one -- would ship the whole debug surface with no error
 * at all. If the count ever changes on either side, the build fails loudly instead of
 * silently shipping (or over-stripping) the wrong amount.
 */
const DEMO_MARKER_BEGIN =
  "/* ---- BEGIN: debug api -- stripped from the plugin build, see scripts/build-plugin.mjs (stripDebug) ---- */";
const DEMO_MARKER_END = "/* ---- END: debug api ---- */";
const EXPECTED_DEBUG_REGIONS = 1;

function stripDebug(source, filePath) {
  const beginCount = source.split(DEMO_MARKER_BEGIN).length - 1;
  const endCount = source.split(DEMO_MARKER_END).length - 1;
  if (beginCount !== EXPECTED_DEBUG_REGIONS || endCount !== EXPECTED_DEBUG_REGIONS) {
    throw new Error(
      `stripDebug: expected ${EXPECTED_DEBUG_REGIONS} BEGIN/END marker pair(s) in ` +
      `${filePath}, found ${beginCount} BEGIN and ${endCount} END -- a marker was added, ` +
      `removed or mistyped. Fix the markers before building.`
    );
  }
  let out = source;
  for (let i = 0; i < EXPECTED_DEBUG_REGIONS; i++) {
    const start = out.indexOf(DEMO_MARKER_BEGIN);
    const end = out.indexOf(DEMO_MARKER_END, start);
    if (start < 0 || end < 0 || end < start) {
      throw new Error(`stripDebug: marker pair ${i + 1} is out of order in ${filePath}`);
    }
    out = out.slice(0, start) + out.slice(end + DEMO_MARKER_END.length);
  }
  return out;
}

const stripDebugPlugin = {
  name: "strip-debug",
  setup(b) {
    b.onLoad({ filter: /[\\/]page\.js$/, namespace: "file" }, (args) => ({
      contents: stripDebug(readFileSync(args.path, "utf8"), args.path),
      loader: "js",
    }));
  },
};

/* ------------------------------------------------------------- update note -- */
// github#33, design/0023
const NOTE_FILE = join(ROOT, "plugin", "whats-new.md");
const PAGE_MARKUP = join(ROOT, "src", "page.html");

function checkWhatsNew() {
  const text = readFileSync(NOTE_FILE, "utf8");
  const { note, problems } = parseNote(text);
  if (note) {
    const markup = readFileSync(PAGE_MARKUP, "utf8");
    for (const id of note.points) {
      if (!markup.includes('id="' + id + '"')) {
        problems.push("points at " + id + ", which is no id in src/page.html");
      }
    }
  }
  if (!note || problems.length) {
    throw new Error("plugin/whats-new.md is not an update note the plugin can show:\n  " +
                    problems.join("\n  ") + "\nSee the comment at the top of that file.");
  }
  return { note, bytes: Buffer.byteLength(text) };
}

// github#33, design/0023 -- "vs:releases": every release the CHANGELOG has a heading for
const CHANGELOG = join(ROOT, "CHANGELOG.md");

function readReleases() {
  return parseReleases(readFileSync(CHANGELOG, "utf8"));
}

const releasesPlugin = {
  name: "releases",
  setup(b) {
    b.onResolve({ filter: /^vs:releases$/ }, (args) => ({ path: args.path, namespace: "vs:" }));
    b.onLoad({ filter: /.*/, namespace: "vs:" }, () => ({
      contents: "export default " + JSON.stringify(readReleases()) + ";",
      loader: "js",
      watchFiles: [CHANGELOG],
    }));
  },
};

const whatsNew = checkWhatsNew();

const options = {
  entryPoints: [join(ROOT, "plugin", "main.js")],
  outfile: join(ROOT, "main.js"),
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2020",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  sourcemap: false,
  minify: false,
  logLevel: "info",
  plugins: [rawLoader, releasesPlugin, stripDebugPlugin],
  banner: {
    js: "/* Vault Shelf -- built by scripts/build-plugin.mjs. Source: plugin/ and src/. */\n",
  },
};

function copyStyles() {
  const host = readFileSync(join(ROOT, "plugin", "styles.css"), "utf8");
  const page = readFileSync(join(ROOT, "src", "page.css"), "utf8");
  /* design/0016 -- the leather look ships alongside the default one and paints nothing until
   * `data-look="leather"` is on the root. Last in the file, so it is reading the tokens the
   * default look has already declared rather than racing them. */
  const looks = ["leather.css", "cyber.css"]
    .map((f) => "/* ---- src/" + f + " " + "-".repeat(Math.max(0, 56 - f.length)) + " */\n" +
                readFileSync(join(ROOT, "src", f), "utf8").trimEnd())
    .join("\n\n");
  writeFileSync(join(ROOT, "styles.css"),
    "/* Built by scripts/build-plugin.mjs from plugin/styles.css + src/page.css + " +
    "every look in src/. */\n" +
    host.trimEnd() + "\n\n" +
    "/* ---- src/page.css ---------------------------------------------------- */\n" +
    page.trimEnd() + "\n\n" +
    looks + "\n", "utf8");
}

if (WATCH) {
  const ctx = await context(options);
  await ctx.watch();
  copyStyles();
  console.log("watching plugin/ -- ctrl-c to stop");
} else {
  await build(options);
  copyStyles();
  const kb = (n) => (n / 1024).toFixed(0) + " KB";
  const sizes = ["main.js", "styles.css", "manifest.json"]
    .map((f) => f + " " + kb(readFileSync(join(ROOT, f)).length));
  const releases = readReleases();
  console.log("built: " + sizes.join(", ") +
              "; update note for " + whatsNew.note.version + ": " + whatsNew.note.lines.length +
              " line" + (whatsNew.note.lines.length === 1 ? "" : "s") + ", " + whatsNew.bytes + " bytes" +
              (whatsNew.note.points.length ? ", pointing at " + whatsNew.note.points.join(" ") : "") +
              "; " + releases.length + " release" + (releases.length === 1 ? "" : "s") +
              " from the CHANGELOG, newest " + (releases[0] ? releases[0].version : "none"));
}
