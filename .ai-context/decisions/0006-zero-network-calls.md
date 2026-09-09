# 0006 — Zero network calls, and a check that says so

**Date** 2026-09-09 · **Status** accepted

## Context

The Obsidian community directory's automated review reports, under **Disclosures**, how many
network request calls the shipped `main.js` contains. Users read that number.

Both of this project's artifacts are offline objects: one HTML file somebody can open off a
USB stick, and a plugin that reads a vault which is nobody else's business. Vault Shelf reads
more of a vault than its sister does — the people named in it, every frontmatter property —
so the claim matters more here, not less.

## Alternatives weighed

| Option | Why not |
|---|---|
| **Make the call and disclose it** | Disclosure is for requests that are *necessary*. There is nothing this plugin needs from a network. |
| **A webfont for the serif reading face** | It is a request, and a quieter one than an API call. The prose stack is a system-font list ending in a generic serif; a reader who has none of the named faces gets their platform's serif and the page is unchanged in every way that matters. |
| **A CDN for a markdown renderer** | Same, plus a supply chain. The standalone's renderer is fifteen lines and builds elements rather than HTML; the plugin has Obsidian's. |
| **Shadow `fetch` with a local binding** | Neutralises the call at runtime and leaves the literal `fetch(` in the shipped file. A reviewer's count, and a user's grep, would both still be non-zero. |

## Decision

**Zero, as a property of code we wrote, checked from two directions.**
`scripts/check-network.mjs` reads our own sources — the plugin, the page, every `.ts` under
`src/core`, the markup and both stylesheets — and whatever a build left behind, and looks for
seven network primitives (`fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`,
`sendBeacon`, `importScripts`, `requestUrl`) plus four kinds of remote resource (`src=`,
stylesheet `href=`, `@import`, `url()`).

It costs milliseconds, needs no browser, and it is **unskippable** in the pre-push hook — the
same bar as the PII and scope checks, and for the same reason: cheap, and about somebody
other than us.

Anchors are deliberately excluded. A link a person may choose to click is not the page
reaching out on its own.

## Consequences

- The suite also asserts it from the other side, in a real browser: *nothing on the page
  reaches the network* counts `performance.getEntriesByType("resource")` entries with an
  `http` scheme after the page has loaded and been driven.
- Any future dependency has to be vendored or written, and `check-network` is where that
  argument gets had.
- If a request ever is genuinely needed, it has to be disclosed to users and this record
  rewritten — not hidden from the check.

## Verify

```bash
node scripts/check-network.mjs      # -> check-network: clean (13 files, 2 built artifacts)
```
