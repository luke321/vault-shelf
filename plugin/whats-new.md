<!--
  The update note the plugin shows ONCE, on the first open after a MINOR or MAJOR update
  (github#33, design/0023). Three line kinds, in any order after the heading:

    # 1.0.0          the release this note is for -- one per file, and it must be the one
                     being cut, or the strip stays silent rather than showing a stale note
    - <text>         up to five bullets, plain text: what you can now do, not how it was
                     built. No markup, no images, no links -- the strip builds its own
    > vs-order       up to four control ids from src/page.html: what this release ADDED.
                     They pulse while the note is up and stop when it is dismissed. Leave
                     the line out when a release adds no control of its own

  The strip links out on its own: one link per release between the version last seen and
  this one, oldest first, plus the feature gallery. The release branch rewrites this file
  beside the CHANGELOG entry; a PATCH leaves it as it is, and shows nothing.
  scripts/build-plugin.mjs refuses a file that breaks any of that.

  1.0.0 carries no "> " line on purpose: that line names what a release ADDED, and on the
  first release that is the whole page. See design/0023.
-->
# 1.1.0
- Order a book or a shelf by Number as well as A-Z and Date, so 2, 10 and 100 read in the order you would say them.
- A volume of digits opens into its months and days in the edge index, instead of overflowing the rail.
- Shelves you rearrange by hand stay rearranged after a reload, in the plugin and in an exported library.
- Notes that share a date now read A-Z within that date, in both directions, instead of running the alphabet backwards.
- A spine that lifts on hover is painted in full, and every binding has room to paint into at the edge of its book.
