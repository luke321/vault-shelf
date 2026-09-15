# 0017 — A gate carries its own negative controls

**Date** 2026-09-15 · **Status** accepted · **Issue** [#81](https://github.com/luke321/vault-shelf/issues/81)

## Context

`scripts/check-scope.mjs` is the gate behind a Law — *the page is scoped, in both directions* —
and the pre-push hook lists it among the checks with no skip flag, because `src/page.css` is
loaded into Obsidian itself. One unscoped element selector restyles the whole app, and the
failure reads as an Obsidian bug rather than as ours.

Its CSS half read **one line at a time**, and took the selector to be
`code.slice(0, code.indexOf("{"))` — the text on the single line the opening brace sits on. A
pre-release review of `a2de7fa` planted shapes into a throwaway copy of the tree and asked it:

| planted into `page.css` | what the gate said |
|---|---|
| `p,` `blockquote,` `input,` `.vault-shelf .vs-spine {` over four lines | **clean, exit 0** |
| `@media (…) { body { margin: 0 } }` on one line | **clean, exit 0** |
| `@supports { @media { html { … } } }` | **clean, exit 0** |
| `.vault-shelf .vs-a { … } body { … }` on one line | **clean, exit 0** |
| `.vault-shelf :is(.vs-a, .vs-b) { … }` | **exit 1** — a false positive on valid CSS |

The first four are the same defect wearing four hats: the selector is not the line, and the
depth window `depth === 0 || depth === 1` is not the nesting. The last is its mirror — commas
split with no regard for parentheses, so the gate **refuses** correctly-scoped CSS nobody has
written yet.

Two things make this worse than an ordinary bug. Nothing looked wrong: the rule total stayed at
its baseline 513 in every one of those runs, so a reader watching the number saw a gate doing its
job. And **62 selector members in the three shipped sheets were never read** — every one of them
scoped, so the gate had been passing for the right answer by luck for months.

## Decision

Two parts, and the second is the one worth an ADR.

**One character walker, and it is the only CSS parser in the file.** Comments are blanked to
same-length whitespace so offsets still map to lines; quoted regions are skipped so a brace
inside `content: "}"` is not structure; a block's prelude is everything since the last `}`, `;`
or `{`, which is the fix the issue prescribed. At-rules are classified rather than pattern-
matched: conditional group rules are entered and the style rules inside them checked at **any**
depth, declaration and keyframe at-rules are skipped because no style rule can live in one, and
**anything else is a problem naming the at-rule**. Anything opened inside a style rule — a nested
rule or a nested at-rule alike — is refused rather than read as if it were top-level. The
class-prefix scan, a second independent walk with a hole of its own (`sel.trim().startsWith("@")`
skipped the first rule inside every `@media`), now consumes the selectors this parser produced.

**The planted shapes ship with the gate, and run on every invocation.** Twenty-eight in-memory
fixtures, each asserting the rules read, the selectors read, and the exact set of problems
raised. A control that stops biting fails the gate like any other problem.

They prove the parser, not the wiring around it — they call `scanSheet` directly. Two things
cover that seam: a sheet the gate reads **no** rules out of is itself a problem, so a sheet
dropped from the list or a parser returning nothing cannot pass quietly; and the throwaway-copy
plant harness that measured the defect is re-run end to end through the real script whenever this
file changes, with its before and after in `changelog-detail.md`.

## Alternatives

**Accumulate lines since the last `}` in the existing line walker.** It fixes the multi-line list
and neither of the other two shapes, and leaves two parsers in the file disagreeing about what a
selector is. The cheapest change, and it would have left three of the five rows above unchanged.

**A `--selftest` flag the pre-push hook calls, the way `lock.mjs` and `update-note-selftest.mjs`
are called.** This is the repo's own idiom and it was the obvious answer. It was rejected for the
reason the issue exists: *a gate that has never been seen to fail is not known to work*. A flag is
a thing somebody has to remember to run, and this defect survived because nobody had run the
equivalent by hand. All twenty-eight parse in **0.21 ms**, against **4.5 ms** to scan the three
sheets and **102 ms** for the whole check, so there is no budget to defend and no reason to
make the proof optional. `--selftest` survives as the verbose form, for a human reading which
control does what.

**Skip a construct the parser cannot judge.** Nested CSS (`&`) is refused rather than skipped, and
so is an at-rule nobody has classified. No sheet here uses either, so the cost is one line when CSS
grows one — and the alternative is a silent hole, which is precisely how `@media`-on-one-line got
in. A gate that cannot read something must say so.

## What it costs

A future sheet using nested CSS or a new at-rule is **blocked** until someone teaches this file
about it. That is deliberate: the message names the construct and says what to do. The strictness
is only defensible because the controls prove, on every run, that the refusals are the ones
intended. Six of the twenty-eight exist only to keep the refusals honest — a sibling combinator
*inside* the page, a comma inside `:is()`, a comma and a space inside an attribute value, a child
combinator, and braces inside a comment are all still fine, and a control says so.

## What it caught immediately

Writing the controls turned up a shape the issue had not listed: `.vault-shelf + p` and
`.vault-shelf:hover ~ p` style a **sibling** of the page and were read as scoped, because
`startsWith(".vault-shelf ")` cannot tell a descendant combinator from a sibling one. So `scoped()`
now walks the compound after the root class and refuses a `+` or `~` that follows it. Three
controls hold that line, including the one that proves `.vault-shelf .vs-a + .vs-b` is still fine.
