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
# 1.2.0
- The search box suggests the people, tags, folders, book covers and note titles your vault actually has, sized so you can read every suggestion in full.
- A small clear button empties the search box in one press, without touching an active filter.
- A matching book now lifts and opens air by how much of it answers, so the book that is the actual answer stands out from the ones that merely mention it.
- Open a tag, person or property book and flags on the page's edge mark exactly where the subject is written; press one and the note scrolls there.
> vs-clearquery
