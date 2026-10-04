// github#109, design/0036
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf("--" + name);
  return i < 0 ? fallback : args[i + 1];
};
const tools = resolve(arg("tools", ROOT));
const require = createRequire(join(tools, "package.json"));
const { default: stylelint } = await import(pathToFileURL(require.resolve("stylelint")));
const { default: official } = await import(pathToFileURL(require.resolve("stylelint-config-obsidianmd")));
const results = [];
for (const target of ["electron 30.0", "electron >= 30.0", "electron >= 31.0"]) {
  const config = {
    plugins: official.plugins,
    rules: {
      "declaration-no-important": official.rules["declaration-no-important"],
      "plugin/no-unsupported-browser-features": [true, { severity: "warning", browsers: [target] }],
    },
  };
  for (const file of ["src/page.css", "src/leather.css", "src/cyber.css", "styles.css"]) {
    const result = await stylelint.lint({ code: readFileSync(join(ROOT, file), "utf8"),
      codeFilename: file, config, configBasedir: tools });
    const warnings = result.results.flatMap(r => r.warnings);
    const counts = {};
    for (const warning of warnings) {
      const feature = /browser feature "([^"]+)"/.exec(warning.text)?.[1] || warning.rule;
      counts[feature] = (counts[feature] || 0) + 1;
    }
    results.push({ target, file, warnings });
    console.log(`${target}: ${file}: ${warnings.length} warnings ${JSON.stringify(counts)}`);
    if (result.errored) process.exitCode = 1;
  }
}
const out = arg("out", "");
if (out) writeFileSync(resolve(out), JSON.stringify(results, null, 2) + "\n");
console.log("CSS review report only; warnings remain visible and do not certify a community score.");
