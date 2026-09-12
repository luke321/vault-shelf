<!--
  The update note the plugin shows ONCE, on the first open after a MINOR or MAJOR update
  (github#33, design/0023). Three line kinds, in any order after the heading:

    # 0.1.0          the release this note is for -- one per file, and it must be the one
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

  0.1.0 carries no "> " line on purpose: that line names what a release ADDED, and on the
  first release that is the whole page. See design/0023.
-->
# 0.1.0
- Your vault is a library: seven shelves of books built from titles, dates, people, tags and folders, and not one note moved to make them.
- One note sits on six shelves at once. Each shelf is another useful address into the same vault, not another copy of it.
- Open a book and read it as a two-page spread, with a contents list on the left and Obsidian's own renderer on the right.
- Leave a ribbon in a book and it is still there after you rearrange the shelf, because a book's address survives a rebuild.
- Drag a book onto Favourites, build a shelf of your own from two questions, and pick the look the room is bound in.
