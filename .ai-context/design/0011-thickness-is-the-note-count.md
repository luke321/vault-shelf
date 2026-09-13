# 0011 — Thickness is the note count

A book on the shelf is `--spine-w` wide, and that width is a **measurement of the book**, not a
constant. `src/page.js`:

```js
var SPINE_MIN = 22;
var SPINE_MAX = 58;

function thicknessOf(n) {
  if (thickest <= 1) return SPINE_MIN;
  var t = Math.log(1 + n) / Math.log(1 + thickest);
  return Math.round(SPINE_MIN + (SPINE_MAX - SPINE_MIN) * t);
}
```

## Why the shelf needed it

Before this the rail was a row of identical tiles with numbers printed on them, and the number
was the only thing carrying the size. That is a bar chart drawn as furniture: the eye has to
read every label to find the big one, which is precisely the work a shelf is supposed to do for
you. In a real library you find the year somebody wrote a lot without reading a single spine.

It is also the cheapest possible magic. Nothing animates, nothing hovers, nothing has to be
explained — the shelf simply *is* uneven in the way a shelf is, and the unevenness happens to
be true.

## Log, not linear

A vault's book sizes are not evenly spread; they are a long tail. Measured on a mirror of a
real 543-note vault (design/0013), the Years shelf runs **463, 21, 18, 7, 7, 4, 2, 2, 2, 2, 1**
with a median of **4**, and the People shelf's 126 books run **303, 171, 71 … median 1**.

On a linear scale every book but the first is pinned within a pixel or two of `SPINE_MIN`: the
shelf looks exactly as flat as it did before, with a single plank on the end. The log flattens
the top and spends the range where the books actually are, so 4 against 21 against 71 is
legible and 463 is merely the widest rather than the only wide one.

## Against the library, not against the shelf

`thickest` is the largest book count **anywhere in the library**, computed once in `rebuild()`
and shared by every rail. Scaling per shelf would be the obvious local choice and it lies: a
shelf whose largest book has three notes would draw that book at 58px, the same as the 184-note
volume one rail down, and the two would look identical. Thickness has to mean the same thing
everywhere on the page or it means nothing.

The cost is that a vault with one enormous book compresses everything else. That is honest —
that vault *does* have one enormous book — and the log scale is what keeps it readable.

## The bounds

22px is the narrowest spine that still holds a rotated title and reads as an object rather than
a rule; 58px is about where a spine starts to look like a box. Both are in
`.ai-context/invariants.md`, and changing either changes it in the same commit.

`--spine-w: 34px` survives in `src/page.css` as the fallback for a spine nobody has sized. The
builder's preview draws before there is a library maximum to scale against, and a preview whose
spines are all `SPINE_MIN` would read as a preview of a shelf full of empty books.
