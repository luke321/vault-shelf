# 0030 — Contents order

The reader's contents and its cut index must use the same ordering. The classifier supplies
an initial choice, rather than locking the reader into it: Encyclopedia and Tags use A–Z;
other classifiers use dates. Date ordering respects saved direction settings; fresh settings use oldest first.

As amended by [0035](0035-a-volume-of-numbers.md), there is a third mode: `number`, which reads
a title's leading digit run as a number and is offered **in place of** `az`, and only for a book
whose every note opens with a digit. It replaces the automatic `az`, never a saved mode and
never `date`, and like `az` it ignores the reading order.

`Shelf.indexMode` stores an explicit shelf default (`az`, `date` or `number`). Optional
`Shelf.bookIndexes` stores overrides by stable book key, including made books and plaque
aggregates. Missing values inherit. Migration discards unknown modes. Favourites resolve
their source's choice, just as they resolve its contents and binding.

The control directly below the search tab shows the current mode. Activating it saves the
other mode for this book, rebuilds contents and tabs together, and keeps the selected note
and right-page scroll position. Reopening an existing spine resolves the rebuilt book;
its old event-handler object must never restore the previous sorting.

Every book/plaque/shelf colour and binding menu includes Default contents order. A shelf
choice clears its book overrides and applies to future books too. A plaque choice sets its
run and aggregate. As amended by [0031](0031-picker-and-reader-controls.md), two buttons
replace the dropdown; untouched drafts inherit, pressing either saves that explicit mode. Shelf creation and
editing expose the same choice; book creation and editing offer shelf inheritance or an
explicit mode.

Book creation also offers the fourteen existing colour swatches and six spine samples,
including Automatic colour and binding. All three choices remain draft state until Save.
Cancelling writes nothing. Editing restores the saved choices, renaming preserves the key,
and deletion removes colour, binding and contents overrides together.

The targeted browser checks are `contents defaults and the reader switch preserve the note
and survive migration` and `new books save colour binding and contents defaults while
cancelled drafts save nothing`. Index checks exclude both control tabs from section counts.
`--shot-open book` opens the creation form for visual inspection.
