import { relative } from "node:path";

/* ---- the meter ---------------------------------------------------------- */

export const METER_RULES = [
  "@typescript-eslint/no-unsafe-assignment",
  "@typescript-eslint/no-unsafe-member-access",
  "@typescript-eslint/no-unsafe-call",
  "@typescript-eslint/no-unsafe-argument",
  "@typescript-eslint/no-unsafe-return",
];

/* ---- the formatter ------------------------------------------------------ */

export default function summarise(results, context) {
  const cwd = (context && context.cwd) || process.cwd();
  const meter = new Set(METER_RULES);
  const lines = [];
  const perRule = new Map();
  let errors = 0, warnings = 0, metered = 0;

  for (const r of results) {
    const file = relative(cwd, r.filePath).split("\\").join("/");
    for (const m of r.messages) {
      if (m.severity === 2) errors++; else warnings++;
      if (meter.has(m.ruleId)) {
        metered++;
        perRule.set(m.ruleId, (perRule.get(m.ruleId) || 0) + 1);
      }
      const sev = m.fatal || m.severity === 2 ? "error" : "warning";
      lines.push(`${file}:${m.line}:${m.column}  ${sev}  ${m.message}${m.ruleId ? `  (${m.ruleId})` : ""}`);
    }
  }

  const out = [];
  if (lines.length) out.push(...lines, "");
  if (metered) {
    const rules = METER_RULES.filter((k) => perRule.has(k))
      .map((k) => `${k.replace("@typescript-eslint/no-unsafe-", "")} ${perRule.get(k)}`).join(" \u00b7 ");
    out.push(`no-unsafe: ${rules} -- a value that lost its type. Type it rather than casting it away.`);
  }
  out.push(`${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`);
  return out.join("\n") + "\n";
}
