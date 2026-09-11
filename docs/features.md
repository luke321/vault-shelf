---
title: Features
---

[Home](index.html) · [Features](features.html) · [Try it live](demo/) · [GitHub](https://github.com/luke321/vault-shelf)

# Features

Everything the library does, in the words of the design record that settled it. The
[live demo](demo/) is the fastest way to check any of it: every claim below is something you
can do to a real 424-note vault in the page itself.

| | |
|---|---|
| **The library** | [Favourites, at the top](#favourites-at-the-top) · [Six shelves, and every one is the whole vault](#six-shelves-and-every-one-of-them-is-the-whole-vault) · [Build your own, from two questions](#build-your-own-from-two-questions) · [Arranged by hand](#arranged-by-hand) · [The room has no sidebar](#the-room-has-no-sidebar) · [Hiding never deletes](#hiding-never-deletes) |
| **The bookcase** | [A shelf is a bookcase, not a conveyor belt](#a-shelf-is-a-bookcase-not-a-conveyor-belt) · [Thickness is the note count](#thickness-is-the-note-count) · [Year and decade plaques](#year-and-decade-plaques) · [A spine tells you where its notes came from](#a-spine-tells-you-where-its-notes-came-from) |
| **Reading a book** | [The two-page spread](#the-two-page-spread) · [Index tabs, cut the way the book is ordered](#index-tabs-cut-the-way-the-book-is-ordered) · [Also shelved in](#also-shelved-in) · [Which end you open](#which-end-you-open) · [Obsidian's own renderer](#obsidians-own-renderer) |
| **The magic** | [Ribbons that hang out of the book](#ribbons-that-hang-out-of-the-book) · [Shelf wear](#shelf-wear) · [The shelf parts as you type](#the-shelf-parts-as-you-type) |
| **Paint** | [Two looks on offer, and none of them moves anything](#two-looks-on-offer-and-none-of-them-moves-anything) · [The theme is your Obsidian's](#the-theme-is-your-obsidians) |
| **What it promises** | [It never writes to your notes](#it-never-writes-to-your-notes) · [It makes no network requests](#it-makes-no-network-requests) · [It never guesses](#it-never-guesses) |

The reasoning behind every entry lives in
[`.ai-context/`](https://github.com/luke321/vault-shelf/tree/main/.ai-context) — `decisions/`
for the choices that had alternatives, `design/` for how each part actually works. The record
each entry came from is named at the end of it.

---

## The library

### Favourites, at the top

The first shelf in the room starts **empty**, and holds whichever books you drag onto it from
any other shelf, in the order you dropped them. Drag a spine onto the rail — it is a drop
target along its whole length, and the mark between two books says where the next one will
land. **To take one off, drag it off** — carry it away from the rail and drop it anywhere else in the
library. The shelf you drop it on does not gain it; Favourites simply loses the reference, and
the spine shows a dashed outline while that is what the drop would do. A drag you abandon with
Escape, or by dropping outside the window, puts the book back. Right-clicking works too:
**Add to Favourites** on any spine, **Take off Favourites** on a favourite.

**A favourite is a reference to the book, not a copy of it.** It is stored as that book's
address, so its title, its notes, its thickness and its colour are the source book's and they
are **live**: a favourite *2024* grows as notes arrive in 2024. Opening one opens the source
book, so a ribbon left in it and the wear on its spine are one thing rather than two.

The laws hold on it like any other shelf: a note in two favourites is **one note** in the
shelf's count, addresses do not move across a rebuild, a filter narrows a favourite the way it
narrows its source, and a favourite of a book on a **hidden** shelf still resolves — hiding
keeps a shelf's books. A favourite whose source no longer exists is dropped the next time the
shelf is saved, never while you are only looking at it.

**As many as you like.** *Books you drag onto it* is one of the answers to *what makes a book*
in the builder, so Favourites is a **kind** of shelf rather than one shelf: a reading list, a
shortlist for one project, and Favourites, side by side. A book can sit on several of them at
once — each reference is its own, so taking it off one leaves the others alone — and the
right-click menu names every shelf that would take it.

`design/0019`

### Six shelves, and every one of them is the whole vault

Encyclopedia (title initial, with an explicit `0–9` volume), Years, Months, Weeks, People and
Tags. Not six slices of the vault — six *addresses* into all of it. The same note is in
Encyclopedia **Ü**, the **2016** yearbook, **February 2016** and the **#attention** anthology
at once, and it is still one file that never moved.

That is a measurable claim rather than a slogan, and the suite measures it: on the demo vault
the People shelf reports **424 unique notes across books holding 495 places between them**, and
the Tags shelf 424 across 683. *A shelf's note count is unique notes, never the sum of its
books.*

**Weeks ships hidden.** A vault of any age has hundreds of ISO weeks, which as a bookcase is a
dozen rows deep — the longest thing in the library and the one nobody opened. It keeps its
definition, and one click in **Manage** brings it back.

`design/0002`

### Build your own, from two questions

*Which notes belong here* — the whole vault, a tag, a person, a folder. *What makes a book* —
title initial, year, month, ISO week, person, tag, folder, or any frontmatter property you
have. Eight classifiers crossed with any source, which is what makes them multiply into
something useful instead of eight fixed shelves: `#idea` × tag is an anthology of ideas
cross-cut by their other tags; one folder × person is who appears in this project; the whole
vault × `status` is a board, arranged as books.

**The preview runs the real thing.** It calls the same `buildShelf` the library uses, against
the same notes, and reports the actual note count, the actual books, the actual plaques, and
draws the actual spines. A builder that previews an estimate teaches the wrong thing about what
the shelf will contain.

Three recipes — a monthly journal, a book for each person, an anthology of ideas — fill the
whole form so you can then edit it. They are a starting point, not a menu.

`design/0002`

### Arranged by hand

Every shelf is sorted by a rule — A to Z, or the reading order in the top bar — until you tell
it not to be. Set a shelf's Order to **Arranged by hand** and its books stand where you put
them: **drag a spine** along the shelf, across rows, and drop it in front of another; or, with a
spine focused, `Alt+←` / `Alt+→` moves it one place.

It changes one thing, the sequence. Not a book's address, so no ribbon, no reading place, no
hand-given colour and no wear moves with it; not what is in a book; not the order of the notes
inside. A book nobody has placed stands at the **end**, in the order the shelf would otherwise
have had — a note that arrives overnight never lands in the middle of an arrangement. A drop is
recorded as "before which book", never as a position, which is the only form that survives a
filter: narrow the library to one folder, drag, and the placement of every book the filter is
hiding is kept.

`design/0018`

### The room has no sidebar

The library is the surface. The vault's name, a jump chip per shelf with its book count, the
search box, the hit count and **Manage** ride one rail across the top; a shelf's own **Edit**
and **Hide** appear on hover, so a room at rest is books and labels and nothing else.

The way to add a shelf is at **both ends** of the scroll — a dashed `+ New shelf` above the
first shelf and below the last — because the point the product has to make in its first ten
seconds is *these are not the shelves, they are six of the shelves.*

The room also has a width. Full-bleed put four books on an 1,800px board on a WQHD screen and
left the reading spread's index tabs 1,500px from the text they index; the measure is 1180px,
centred, and the chrome stays full-bleed while its contents do not.

`design/0009`

### Putting the book down

Click the desk around an open book to close it. The book is inset from the page so the desk is a
real target rather than a sliver at the edges.

### Search inside the book from the index

The strip of tabs down the right edge of an open book jumps to places in it. The first tab is a
**magnifying glass**: press it and the left page scrolls to the top with the cursor already in
*Find within this book*, so searching a book is one press from wherever you are reading.
Ctrl/Cmd+F does the same.

### The room parts where the thing will land

Drag a book and its new neighbour steps aside, with a thin accent bar standing in the gap that
opens. Drag a shelf by its floor and the shelf under the pointer makes room the same way, above
or below depending on which half you are over. It is the same parting the search does to the
room: nothing is removed, things move aside.

### Deleting, placing and carrying a shelf

**Delete** is on every row in Manage, and in the shelf's own Edit sheet. It asks once — the button becomes *Really delete?* and only
the second press does it — and it takes with it the wear and the colours you gave that shelf's
books, and any favourites pointing at them. A ribbon survives, because a ribbon names a note
rather than a shelf. If you delete every shelf, the room offers to build the default six back.

**A new shelf lands where the button is.** *+ New shelf* at the top of the library builds at the
top; the one at the foot appends.

**A shelf is carried by its floor.** Press the board under the books, drag, and drop it on the
half of another shelf you want it to land on — above or below. A spine is a book and a board is a
shelf, so the two drags never mean each other. Manage's arrows do the same move from the
keyboard.

### Hiding never deletes

**Manage shelves** reorders, hides and restores. Each row carries a **Shown** switch beside
its *Vary colours* one, so a row reads as two facts and no actions; a hidden shelf keeps its
definition and its books, and hiding everything still leaves a way back. Ribbons in a hidden
shelf's books re-resolve rather than breaking.

`design/0009`, `decisions/0002`

---

## The bookcase

### A shelf is a bookcase, not a conveyor belt

Nothing on the page scrolls sideways. A run of books too long for the room continues on the
next row down, as many rows as it takes, each the full width of the room.

The horizontal scroller it replaced was the honest failure: 126 books on a People shelf is a
rail four screens long of which you can see a quarter, with no indication of how much is off to
the right. The header said "126 books" and the shelf showed you thirty. A bookcase does not do
that — every book is on screen, and **the height of a shelf tells you how much is in it.**

The packing is done in JavaScript rather than by `flex-wrap`, because the plaques are the
reason the rows exist: a wrapped flex row cannot tell you where it broke, and a plaque has to
be drawn under the part of its run that landed on *this* board.

`design/0014`

### Thickness is the note count

A spine's width is a measurement of the book, not a constant: 22px at the thinnest, 58px at the
widest, on a log scale. In a real library you find the year somebody wrote a lot without
reading a single spine, and that is the whole of it — nothing animates and nothing has to be
explained, the shelf simply is uneven in the way a shelf is, and the unevenness happens to be
true.

**Log, not linear**, because a vault's book sizes are a long tail. A real 543-note vault's
Years shelf runs 463, 21, 18, 7, 7, 4, 2, 2, 2, 2, 1 — on a linear scale every book but the
first is pinned within a pixel of the minimum and the shelf looks as flat as it did before,
with a single plank on the end.

**Scaled against the library, not against the shelf.** The largest book anywhere on the page
sets the top of the range, so thickness means the same thing on every rail. Scaling per shelf
would draw a three-note book at full width one row above a 184-note volume drawn identically.

`design/0011`

### Year, decade and alphabet plaques

The shelf label a physical library would have: a small engraved plate under the run of books
that belongs to it. Months and weeks group under their **year**; years group under their
**decade**; people and tags group under their **letter**. "September 2026" in 11px vertical
type is not how anybody finds September 2026, and 126 names in one run are a list to be read
where the same 126 under A, B, C are a shelf to be scanned.

Three things make it a plaque rather than a label:

- **It is inside the same rail as its books.** Two elements that scroll independently are two
  elements that will eventually disagree, and that failure looks like a rendering glitch rather
  than a layout mistake. The plaque is a sibling of the books it names.
- **It is as wide as its run**, not as wide as its own text — and it is part of that run's
  width when the row is packed, which is what stops a one-book run under `2010-2019` from
  overflowing by exactly the width of the words.
- **A run that wraps is named on every row it reaches.** Each plate says what is on the board
  it is screwed to.

Plaques are date classifiers only, and only when asked for. A "year" plaque over a People shelf
would be a year taken from nowhere, so the builder disables the checkbox there. Week plaques
use the **ISO week-year**, so 2026-W53 sits under 2026 even though four of its days are in
January 2027 — otherwise one week hangs under two plaques.

**A plaque opens.** Click `2024` under Months and the reader opens on every note of 2024, in
reading order, with the contents cut by month; click `2010–2019` under Years and it is the
decade; click `M` under People and it is everyone whose name starts with M. The count is unique
notes — a note in two of the books under the plate is one note — and the meta line says how
many books it came across. A plaque-book has an address of its own (`shelfId/-plaque-2024`), so
a ribbon left in it comes back after a rebuild and it sits on the Reading shelf like any other
book. A plate drawn on two rows opens the same book from both; on a shelf arranged by hand a
plate opens exactly what is under it. The plate lights under the pointer, takes focus from the
keyboard, and has not moved a pixel to do it.

`design/0019`

`design/0003`

### A spine tells you where its notes came from

A spine is **dyed** with its dominant source folder's colour — one of twelve — so a book from the
meetings folder and one from the journal are different colours because they are different
kinds of book. The number at the foot is the count. Hover it and the peek says the same thing
in words: the label, the note count, how many ribbons are in it, how many times you have opened
it, the folders its notes came from, and the first three titles.

Three people can have an opinion about a book's colour, and they are ranked. **You**, by
right-clicking the spine: twelve swatches and *Automatic*, kept by the book's address so a
rebuild keeps it. **The shelf**, if it *varies* its books — a colour of its own per book,
hashed from the address so it never changes as notes arrive; per shelf, on its row in Manage,
Encyclopedia included. **The folder**, otherwise. And the twelve themselves are yours to edit in
Manage, as a table of twelve rows standing four columns of three: the dye on the left of each
row, and on the right **the ribbon that book hangs**. Both are painted swatches that open a picker, both are marked with a small × once they
are no longer the look's own — the mark is also that one's reset — and one **Reset colours**
puts the whole table back, quiet when nothing is yours. A chosen palette is written over every
look; twelve that are all the look's own again are saved as none, so the file follows the look
rather than pinning one look's colours under the next.

**A ribbon you have not chosen is its dye's complement.** One ribbon colour for the whole
library was the one colour certain to vanish against some of the twelve bindings, so a ribbon
is now per book colour and its default is computed from the dye: the opposite hue, more
saturated, and moved far enough in lightness that the thread is never the same weight as the
board it hangs off. It is computed rather than stored, so it follows the look and your Obsidian
theme the way the twelve do — and any one of them is yours to override.

`design/0002`, `design/0005`

---

## Reading a book

### The two-page spread

Opening a book is an overlay, not a route, so the shelf keeps its scroll position — the whole
feeling the product is after is *returning to a familiar place*, and a library that scrolls back
to the top every time you close a book does not have it. Escape closes it and puts focus back
on the spine that opened it.

**Left**: the collection's title, its note count and source mix, a *find within this book* box,
and the contents. **Right**: the note.

It reads as a book because of its geometry, not because of a texture. Both inner edges darken
toward the fold; both outer edges carry a repeating 1px-on-2px-off gradient — the stack of
leaves you see looking at a book from the front; the corners are rounded and the pages are cut
by the cover, so the spread lies **on** the surface instead of being a region of it. The
contents are set in the reading face with leader dots, the way a printed index is — and a
leader only exists when something is at the end of it, so an undated row has none.

**Previous collection** and `Alt+←` walk back through the books you came through; arrow keys
walk the notes. A page-turn animation was rejected: it is a delay between a person and their
note.

`design/0004`, `design/0012`

### Index tabs, cut the way the book is ordered

A tab is a **position in the contents**, so the cut has to follow the order the contents are
in. An Encyclopedia volume is alphabetical inside and gets letters; everything else is in date
order and gets dates.

| Book | Order | Tabs |
|---|---|---|
| an Encyclopedia volume | by title | letters — `A`, `Aft`, `Al` |
| a year | by date | months — `Jan`, `Feb` |
| a month, a week | by date | days — `04`, `09`, `27` |
| a person, a tag, a folder, a property value | by date | the span it covers |

**As deep as the book needs.** Every note in the M volume begins with M, so one letter is one
tab and one tab is no index at all: the cut goes to two letters — `Ma`, `Me`, `Mi` — and then
to three, and stops as soon as the tabs are worth having. The prefix is the first *word*, not
the first characters, so "A note on ferries" files under `A` rather than under a tab with a
space in it.

**A span, for the books that are neither.** A person's book of 62 notes over five years is
indexed by year; one of 40 notes inside a single year, by month; a fortnight of them, by day —
the biggest unit that gives more than one tab, which is the rule a printed index follows and
needs no setting.

Above 26 tabs the list collapses into twelve ranges. A tab you cannot hit is decoration.

**The contents follow.** A tab, Previous, Next, the arrow keys, a ribbon or a followed link
brings the current row into view on the left page — the smallest move that does it, the way a
printed index is thumbed to, never a re-centring — and the row is marked with a bar in the
margin. A list you have scrolled yourself is not moved by a redraw that changes nothing.

`design/0015`, `design/0004`

### A tag book's cover has no hash

The spine of a tag book reads `garden` or `area/health/sleep`, not `#garden`: a `#` turned on
its side at spine size is noise, and the shelf above it already says Tags. Everywhere the name
is set horizontally — the hover peek, the dye menu, the reader's title bar and heading, the
*also shelved in* chips — it keeps its hash, because that is how a tag is written and it is
what keeps a hierarchical tag from reading as a folder path. The address is the key and the
key did not change, so no book moves. A cover of three characters or fewer stands upright only
if it fits its spine, which is measured rather than assumed: `map` on a thin spine stays on its
side rather than being cut to `m…`.

`design/0002`

### Also shelved in

Under the note, the other books that hold it, each labelled with its shelf. Clicking one moves
to that book **on the same note** — you are reading a note in February 2016 and you step
sideways into Ines Calder's volume without losing your place in the note. It is the move that
makes the overlapping-shelves idea concrete rather than theoretical.

`design/0004`

### Which end you open

A book opens on its **oldest** note. Newest-first is what a feed does and what a notebook never
does: it reads as if the thing were written backwards. The top bar carries the one control that
says otherwise, in the bar rather than in a settings sheet, because it is a reading preference
and you change it while reading — and the button says what it **is**, not what pressing it
would do.

It turns the **shelf** as well as the books on it: a Years shelf reads 2011 → 2026 under
*Oldest first* and back under *Newest first*, and so do its months and weeks. It applies to
what is ordered by date. An Encyclopedia volume stays alphabetical under both, because "the
oldest of the As" is not a thing anybody wants, and a People or Tags shelf keeps its own A to Z.

`design/0015`

### Obsidian's own renderer

Inside Obsidian the right-hand page is rendered by **Obsidian's own renderer**, over the file's
own text: wikilinks that resolve and are clickable, embeds, callouts, task lists, tables, code
blocks in your own syntax theme, and any post-processor another plugin has registered.

That is the one file the plugin ever reads, on demand, through the app's own cache — everything
else comes from the metadata cache. The note's text never enters the shelf data. In the
standalone export, where there is no Obsidian, the page falls back to its own small renderer
over the exported body.

Either way it **builds elements, never an HTML string.** The note body is your own text, and
assembling markup out of it is how a vault ends up executing itself.

`design/0010`, `decisions/0005`

---

## The magic

Three features that use a physical vocabulary — wear, a ribbon, books making room — to do
something no physical library can. Each had to pass two tests: *would somebody who has never
read the README understand what just happened*, and *could a real shelf do it?* No to the first
is a gimmick; yes to the second is decoration.

### Ribbons that hang out of the book

A bookmarked note leaves a ribbon hanging out of the bottom of the book, below the shelf board.
You can see every place you saved without opening anything. A book holding two or three marked
notes shows two or three ribbons side by side; beyond that the count is on the peek.

**And from inside the book.** Open one and its ribbons hang out of the top edge of the cover,
over the right-hand page, named with their notes: click one to turn to it, click the one in the
page you are on to take it out. At the end of the row is the edge of a ribbon you have not
pushed in yet — pushing it in leaves one in the page you are reading. Three at most, and always
the one you are on.

**What no real shelf does, twice over.** A ribbon marks a *note*, and a note is in six books at
once, so **one ribbon appears in six places** — leave one in a note in September 2026 and it is
also hanging out of Encyclopedia K, the 2026 yearbook and Mira's volume. And it **re-threads
itself**: hide a shelf, rename a note, delete a shelf outright, and the ribbon moves to the
named book if it still holds the note, otherwise to the first visible book that does. A real
ribbon falls out of a book that has been rebound.

The **Reading shelf** collects them at the head of the room — not a panel, not a list, just the
shelf of books with something hanging out of them. A row for a note that no longer exists at
all renders *disabled* rather than vanishing, because a row that disappears silently is a
person wondering whether they imagined saving it.

`design/0008`, `design/0004`

### Shelf wear

A book you open often looks handled: the boards darken, the head and tail soften, and it never
quite goes back flush with its neighbours. Four steps — new, used, worn, well-thumbed — at 2, 5
and 12 opens, drawn as a larger corner radius, a stronger light-to-dark fall, and a pixel or
two of proud position on the rail. A continuous scale would make the shelf a bar chart of your
own habits, which is a dashboard wearing a book's clothes.

**Wear adds luminance, never more colour** — a well-read book is a handled book, not a more
purple one.

**What no real shelf does:** the wear is on the *address*, not the object. The books are views,
so September 2026 gains notes every day and is re-made from different notes — and still
remembers it is the one you keep coming back to.

`design/0008`

### The shelf parts as you type

Searching does not empty the library. Every book stays exactly where it is: matches draw
forward, gain air on both sides and take an accent edge, and everything else thins to a ghost
and desaturates. Clear the box and the room is back exactly, because it was never taken apart.

This is the split that makes it work: **a filter narrows, the query marks.** A filter removes
notes *before* the books are built, so the shelf genuinely has less on it. The query runs
*after* the books exist and only scores them, so the shelf keeps its shape and every one of its
addresses while you type. Nothing is rebuilt and nothing is removed — which is what makes the
movement read as the room parting rather than as a new room arriving.

The reader's *find within this book* is a different thing in a different place: it filters that
book's contents list only.

`design/0008`

---

## Paint

### Two looks on offer, and none of them moves anything

A look is paint, and the selector for it is in the library's own top bar — where you are
standing when you want to change the room.

| | |
|---|---|
| **Leather** | what a fresh library opens in: bindings, gilt stamping, raised bands, walnut boards, brass plaques and an open book on ivory pages. It has its own colours, its own light and its own furniture, and it ignores the theme on purpose |
| **Modern** | the library belongs to your Obsidian: it reads the host's theme and repaints when the theme changes |
| **Cyberpunk** *(shelved until its redesign)* | a rain-lit archive at 3am — anodised spines with a tube of the folder's colour down the leading edge, one lit seam per board, the reader as two sheets of dark glass. It ships, every check still paints it, and the selector does not offer it yet |

A look **may repaint anything and move nothing**: not a shelf's order, not a book's address,
not a count. That is a check rather than an intention — it drives the switch the way a person
does and asserts that **every book address and every count is byte-identical** before and
after, on all three vault shapes, while the spine colours, the twelve slots and the ground all
change.

**And every control is the same size in every look.** A button, a box, a tab, a ribbon, a
swatch, a switch, a dropdown: the same height everywhere, measured — a look paints a control
and does not resize it.

**Every dropdown paints itself.** Obsidian styles every `select` in the app — its own height,
padding, field colour and a drawn arrow — and inside the plugin that landed on ours, so the
Manage and builder dropdowns came up dark on leather's paper sheet. Now every dropdown in
every look takes its box back: an explicit field, ink and border from the look's own tokens
and a chevron drawn as inline SVG, so one on the paper sheet reads as paper, one in the rail
as the rail's field, and one under the modern look as your theme's. The check puts Obsidian's
actual `select` rule into the page and measures.

The dyes are the ones a binder had, in slot order: oxblood, tan, dark green, ochre, forest,
plum, navy, vermilion, teal, aubergine, chestnut and near-black calf. Nothing is fetched to
draw any of it — the leather grain, the wood grain and the marbled endpaper are all CSS
gradients and inline SVG written out in the stylesheet, and no font is loaded.

`design/0016`

### The theme is your Obsidian's

Under the default look there are no skins: there is Obsidian's dark and Obsidian's light, and
Obsidian decides which. The plugin re-reads the palette on the app's own `css-change` event;
the standalone follows `prefers-color-scheme`.

The twelve colour slots a folder is dyed from are **Vault Graph's**, value for value in both
themes, so a folder that is `#2a78d6` on the disc is `#2a78d6` on a spine. The page keeps no
copy of them — it asks the cascade what they currently resolve to, because a copied palette
drifts and cannot follow a theme switch.

**Nothing here needs Vault Graph installed.** There is no runtime dependency of any kind:
nothing reads that plugin, imports from it, or checks whether it is there.

`design/0005`

---

## What it promises

### It never writes to your notes

Shelves are built from Obsidian's metadata cache alone. The only file it ever reads is the one
note you have open, to render it — and it writes none.

`decisions/0005`

### It makes no network requests

Not one, in either artifact. `scripts/check-network.mjs` scans every source file and every
built artifact for `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
`importScripts` and `requestUrl`, and for any remote `src`, stylesheet, `@import` or `url()`,
and refuses a push that adds one. The [live demo](demo/) on this site is an ordinary export, so
it is covered by the same guarantee.

`decisions/0006`

### It never guesses

A date comes from a property you named, then from the note's title, then — only if you leave
that on — from the earliest stamp the filesystem has. People come from the people properties (`people`, `attendees`, `person` by default), from a
link to any note that declares itself a person (`type: people`), and
never from a note's prose. **A missing value gets its own book** (`Undated`, `Unfiled`) rather
than an exclusion, so nothing a shelf admits can fall off it and you can see how much of your
vault has no date of its own. A confidently wrong shelf is worse than a visibly incomplete one.

`decisions/0003`

---

## Clips

`assets/demo.webp` on the [home page](index.html) is the full walkthrough, shot frame by frame
over CDP rather than off a screen, so it is reproducible, unattended and framed exactly.

Per-feature clips are not recorded yet. When they are, each gets a page under
[`docs/features/`](https://github.com/luke321/vault-shelf/tree/main/docs/features) carrying the
storyboard act it comes from and the command that regenerates it —
[`_template.md`](https://github.com/luke321/vault-shelf/blob/main/docs/features/_template.md)
is the scaffold. Those pages are contributor recipes and are excluded from this site.

**Films are shot in a mirror, never in a fixture and never in a real vault.**
`scripts/make-mirror-vault.mjs` rebuilds a real vault's *shape* — its tree, its dates, its
people and tag distributions — with invented words, and refuses to finish if any real string
reaches the output. A fixture is even where a real vault is lopsided, and lopsided is the
product.

`design/0007`, `design/0013`
