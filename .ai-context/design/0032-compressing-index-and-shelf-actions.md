# 0032 - Compressing index and shelf actions

The right-edge index never scrolls. Its section tabs share the available height, reducing
their gaps, height and type size when necessary. Search and the A-Z/Date switch keep their
28px height and unchanged type size; the strip remains 56px wide. On narrow layouts the
existing horizontal index wraps below the pages.

Shelf metadata reads `books · notes · gear · eye`. Both icons are always visible, inherit
the count's colour and face, and use equal 12px SVGs. Accessible names identify the shelf:
Edit opens its builder, Hide preserves its definition and books. Manual shelves use their
plus spine to create books; the redundant New book header button is removed. The top-right
Manage control is a gear with an accessible name and tooltip. Header height stays stable
across looks.

The targeted regression measures a 25-tab book at 1180x1000 and 1180x480: all tabs remain
inside the strip, with no scroll overflow, while both fixed controls remain 28px high.
Switching to Date preserves those control dimensions. It also drives both shelf actions,
checks metadata styling and separators, and verifies hiding preserves the definition.
