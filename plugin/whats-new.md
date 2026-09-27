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
# 1.3.0
- A Tags shelf can fold a busy tag family down to its roots: turn on Only parent tags and every child joins its parent, without dropping a single note.
- A packed search row no longer overflows the room it was given.
- The builder's checkbox row no longer overflows a narrow Obsidian pane.
- Changing a date, people or file-stamp setting now updates the open library right away.
> vs-bparenttags
