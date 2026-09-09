// Obsidian's own guideline linter, plus typescript-eslint's type-aware rules on our own
// JavaScript. Running both locally is the point: the community directory re-scans EVERY
// published version with the same rule set, so a rule broken here is a rejected release
// later, not a style opinion -- and the preset ships several of the rules it applies turned
// off, which is how a local run can read clean while the directory's board fills up.
//
// The recommended preset is aimed at TypeScript plugins. The plugin and the page are plain
// JavaScript -- deliberately, so there is no compile step beyond bundling; the core under
// src/core is TypeScript, which esbuild compiles as part of that same bundling. "Plain
// JavaScript" is often read as "so the type-aware rules cannot run", and it is not so:
// typescript-eslint builds a program from tsconfig.json (allowJs) and the type-aware rules
// read it whether a file says .ts or .js, which is exactly how the directory runs them on
// our .js. What the preset's own `files` scoping keeps on `**/*.{ts,...}` is switched on by
// hand below, where it matters.
//
// THREE SCOPES. The plugin and the page run inside Obsidian, so every guideline rule and the
// type-aware set apply to them. The exporter (src/*.mjs) and scripts/ are Node programs that
// never run inside Obsidian, so Obsidian's rules say nothing about them and are off there;
// the syntax rules and no-unused-vars still run.

import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig } from "eslint/config";
import { METER_RULES } from "./scripts/lint-summary.mjs";

// THE FIVE no-unsafe RULES, AS ERRORS. The community directory's review runs them on every
// published version and the 0.4.1 preset leaves them off, so a finding here is a rejected
// release later rather than a style opinion. They are errors from the first commit here on
// purpose: next door they were switched on against 6,977 existing findings and took eleven
// batches to clear, which is a bill this repo can simply never run up.
//
// The list lives in scripts/lint-summary.mjs and is imported here, so what the formatter
// counts and what this file enables cannot drift apart.
const METER = Object.fromEntries(METER_RULES.map((rule) => [rule, "error"]));

// Every obsidianmd rule, off -- for the Node-side scope below. Generated from the plugin's own
// rule list rather than written out, so a rule the next preset version adds is off there too.
const OBSIDIAN_OFF = Object.fromEntries(
  Object.keys(obsidianmd.rules).map((name) => ["obsidianmd/" + name, "off"]));

export default defineConfig([
  ...obsidianmd.configs.recommended,
  {
    // THE PLUGIN, THE PAGE AND THE CORE: what actually runs inside Obsidian. The core
    // (src/core) is the one TypeScript here, and listing it in this block is what puts the
    // five no-unsafe-* errors and no-unsupported-api on it; the preset's own `**/*.ts`-scoped
    // rules reach it on their own.
    files: ["plugin/**/*.js", "src/page.js", "src/core/**/*.ts"],
    rules: {
      // THE PRESET SCOPES THIS RULE TO `**/*.{ts,cts,mts,tsx}`, so on a plain-JavaScript
      // plugin it silently never runs -- and the directory's scanner runs it anyway. That gap
      // cost the sister repo a rejected release over two `revealLeaf` calls the local run
      // called clean. Turning it on here closes the hole between what this repo checks and
      // what the directory checks; the five below close the other one.
      "obsidianmd/no-unsupported-api": "error",
      ...METER,
      // THE DIRECTORY'S FORM OF THE RULE, with no allowance for an empty catch. The directory
      // runs no-empty as shipped, so eighteen bare teardown catches next door came back as
      // eighteen warnings on a release board. The idiom here is `attempt(fn)`, a helper in the
      // page and in the plugin that swallows and returns the error.
      "no-empty": "error",
    },
    languageOptions: {
      ecmaVersion: 2022,
      // MODULE, not commonjs. Getting this wrong is invisible and expensive: eslint keeps
      // treating the file as a script, so every top-level function is a "global" and the
      // `Plugin` import collides with the DOM's own `Plugin` -- a handful of errors that
      // describe the config rather than the code.
      sourceType: "module",
      // The type-aware rules read a program, and tsconfig.json is that program's config and
      // nothing else -- see the comment in it, including why its `include` names src/page.js.
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        performance: "readonly",
        URL: "readonly",
        Blob: "readonly",
        URLSearchParams: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        matchMedia: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        require: "readonly",
        module: "writable",
      },
    },
  },
  {
    // THE EXPORTER AND THE TOOLING: Node programs, never loaded by Obsidian. No type program
    // here -- nothing type-aware is on for them, so none is built -- and Node's globals rather
    // than the page's.
    files: ["src/**/*.mjs", "scripts/**/*.mjs"],
    rules: {
      ...OBSIDIAN_OFF,
      // AND THE PRESET'S OBSIDIAN-FLAVOURED CORE RULES. Beyond obsidianmd/*, the recommended
      // set configures a few core and third-party rules for code that runs inside Obsidian --
      // a global `fetch` is told to use `requestUrl`, DOM sinks are policed -- and a Node
      // script that has no DOM is not what they are about.
      // import/no-extraneous-dependencies stays on: a script importing a package that
      // package.json does not declare is a finding.
      "no-restricted-globals": "off",
      "@typescript-eslint/no-restricted-imports": "off",
      "no-alert": "off",
      "@microsoft/sdl/no-document-write": "off",
      "@microsoft/sdl/no-inner-html": "off",
      "no-unsanitized/method": "off",
      "no-unsanitized/property": "off",
      // `try { ... } catch {}` is the teardown idiom in every harness here -- kill the child,
      // close the socket, remove the profile -- and none of those failing is news. The scripts
      // are not shipped and the directory does not scan them; the plugin, the page and the
      // exporter run the strict rule above.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    // plugin/**/*.d.ts: declarations for the type program (the bundler's `raw:`/`b64:`
    // modules), not code -- there is nothing in one for a rule to say, and the preset's
    // `**/*.ts` scoping would otherwise run its type-aware rules on it with no parserOptions
    // and abort the whole run. tsconfig.json names them; this file need not.
    ignores: ["node_modules/**", "dist/**", "demo-vault/**", "library-vault/**",
              "sparse-vault/**", ".fixtures/**", "scripts/shelf-snapshots/**",
              "plugin/**/*.d.ts"],
  },
]);
