# 0004 — The reading spread, the reading table, and getting back

## The reader is an overlay, not a route

Opening a book must not cost the shelf its scroll position. The whole feeling the product is
after is *returning to a familiar place*, and a library that scrolls back to the top every
time you close a book does not have that feeling however good the books are.

So `#vs-reader` is `position: absolute; inset: 0` over the library, shown and hidden with the
`hidden` attribute. The library keeps its scroll because it was never re-laid-out. Escape
closes it and puts focus back on **the spine that opened it** — `reader.opener` is captured at
open time and checked against `root.contains` before being focused, because the spine may have
been re-rendered away underneath.

*escape closes the reader and leaves the shelf where it was* measures all three: the reader
opened, it closed, the scroll offset is identical, and `document.activeElement` is the spine.

## Two pages

**Left**: the collection's title, its note count and source mix, a *find within this book*
box, and the contents. The find box filters the contents list only — it is a different thing
from the global search and lives in a different place for that reason.

**Right**: the note. In the standalone that is a fifteen-line Markdown renderer covering
headings, lists, quotes and paragraphs; in the plugin, `body` is empty and the excerpt shows
with *Edit in Obsidian* underneath (`decisions/0005`). Either way it **builds elements**, never
an HTML string: the note body is the user's own text and assembling markup out of it is how a
vault ends up executing itself.

## Index tabs are semantic, and they are capped

The right-edge tabs are the book's own shape, not decoration:

- a **year** book gets months;
- a **month** or **week** book gets days;
- everything else gets title initials.

Then: **if there are more than 26, they collapse into twelve ranges** (`A–F`, `G–L`, …). A
10,000-note vault produces an Encyclopedia volume with hundreds of distinct initials-and-a-
number, and a tab you cannot hit is not navigation. *the reader's index tabs stay countable on
the biggest book* finds the largest book in the vault and asserts the count is between 1 and
26.

Tabs are `<button>`s with `aria-current`, not styled divs, so they are reachable by keyboard
and announced as controls.

## Also shelved in

Under the note, the other books that hold it — up to eight, labelled with their shelf. Clicking
one moves to that book **on the same note**, which is the move that makes the overlapping-
shelves idea concrete rather than theoretical: you are reading a note in September 2026, and
you step sideways into Mira's volume without losing your place in the note.

`core.alsoShelvedIn` skips hidden shelves and the current book. The suite finds a note that
genuinely appears in two books, follows the first link, and asserts the book changed and the
note did not.

## Collection history

`openBook` pushes the previous book onto a stack whenever the book actually changes, and
**Previous collection** / **Alt+Left** pops it. It is a stack rather than a single previous,
because the sideways moves compose: three "also shelved in" hops should walk back three times.

Closing the reader clears the stack. A history that survives a close is a history that offers
to take you somewhere you have forgotten asking for.

## The reading table

A small persistent landing area in the directory, fed by the bookmark control in the reader.
Each row is a note, its saved book, and the ability to reopen it.

**Rows re-resolve rather than trusting what was saved.** `core.resolveReading` looks for the
named book, and failing that for the first visible book anywhere that still holds the note. So
a bookmark survives its shelf being hidden, its book being emptied by a filter, and a shelf
being deleted outright — the row still opens the note somewhere true. A note that no longer
exists at all renders **disabled** rather than vanishing, because a row that disappears
silently is a person wondering whether they imagined saving it.

Two checks cover this: one hides the bookmarked note's shelf and asserts the row is still
present and still enabled; the other calls `resolveReading` with a book id that has never
existed and asserts it falls back to a book that genuinely holds the note, and that a bookmark
for a deleted note resolves to `null` rather than to something plausible.

## Keyboard, and the plain list

Arrow keys walk the notes; Alt+Left walks the collections; Escape leaves. All three are bound
on `root.ownerDocument`, never on `document` — in a popout window those are different objects
and a listener on the wrong one silently does nothing (`scripts/check-scope.mjs` refuses the
second form).

`data-list="1"` on the root turns every rail into a vertical list of full-width rows with
horizontal labels: the same books, the same buttons, the same addresses, in a shape a screen
reader and a narrow phone can both work through. *plain list mode keeps every book reachable*
asserts the book count is identical in both modes.

## A link in a book stays in the library (2026-09-11)

> "wikilinks in the shelf should move to the same note in the same shelf or nearest shelf —
> not to normal obsidian"

Following `[[a note]]` from the spread used to hand the note to Obsidian's editor, which is
leaving the library to look something up that is on the next shelf. `openNote` keeps it in
the room: the target is opened **in this book** if the book holds it, else **in another book
on this shelf**, else **in a book on the nearest shelf** — nearest by position, since the
shelves a person keeps side by side are the ones they think of together. Only a note the
library does not hold at all is left to the host; the plugin tries the library first and
falls through to `openLinkText` for exactly that case, and a Ctrl/Cmd-click is the ask for a
real pane and always goes to Obsidian.

The standalone's fallback renderer turns `[[wikilinks]]` into links of its own for the same
reason; a link to a note the library does not hold is drawn as a dead link rather than as a
promise.

## The desk is the reader itself, and everything in it is the book (2026-09-12)

A click on the dark around the spread puts the book down. The rule was written as an
allow-list — *not* `.vs-spread`, `#vs-marks`, `.vs-readerbar` or `#vs-dye` — and an allow-list
has to be joined. Twice now furniture has shipped without joining it, and the second time cost
the whole feature: `github#36` put `<footer class="vs-turn">` inside `#vs-reader` and outside
`.vs-spread`, so **Previous**, **Next**, the place label between them and the footer's own
background all read as desk. The button's handler turned the page and the desk handler
immediately closed the book, in all three looks. The turn happened and was thrown away.

So the predicate is inverted, and `github#54` is where it happened:

```js
var offBook = function (target) { return target === $("reader"); };
```

**`#vs-reader` is the desk. Its children are the book.** New furniture is inside the book by
default and only says otherwise on purpose, which is the way round that cannot fail silently —
a forgotten allow-list entry closes the book under a control, and nobody notices until they
click it, whereas a forgotten desk entry is a piece of dark that does not respond, which is
visible the first time.

The measurement that lets the desk test be an identity rather than a `closest()` call: the
spread is inset by 96px (`page.css`, `github#0`), so `elementFromPoint` in the gutter beside the
book returns `#vs-reader` itself and nothing else — measured, not assumed, and asserted by
*nothing in the reader but the desk puts the book down*.

`#vs-dye` left the predicate with it. The dye menu is a **sibling** of `#vs-reader`
(`page.html:179`), so its clicks never reached this handler in the first place; it was a dead
entry that read as a live one.

Two things this deliberately does not change. **Both ends of the click still have to be off the
book**, so a text selection dragged out past the cover does not close it on release — that is
what `pressedOffBook` is for, and it is unchanged. And `#vs-back` still closes the book, by its
own `click` handler in the reader bar rather than by being desk.

The cost is stated rather than hidden: a future child of `#vs-reader` that is genuinely meant to
be desk — a full-bleed backdrop, say — now has to say so, because it would inherit the book.
