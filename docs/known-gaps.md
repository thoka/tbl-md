# Known gaps

- A line break inside a code span becomes `<br>` in GFM, and in a code span `<br>` is text, not a line break. The round trip keeps the text, but a GFM viewer shows `<br>` in the code.
- A literal `<br>` in a tbl cell is an HTML line break in a Markdown view. In GFM, it becomes `\<br>`, which shows the text `<br>`. A `\<br>` in a tbl cell shows the text `<br>`. In GFM, it becomes `\\<br>`, which shows `\` and a line break. The round trip keeps the text, but the view changes.
- GitHub splits a GFM cell at a pipe after two backslashes, and markdown-it does not. The conversion writes `\\|` for the tbl text `\|`, so such a GFM table does not show the same on GitHub. tbl-md has no flavor `github` yet.
- With the flavor `discourse`, a pipe in a code span in a link does not convert in either direction, because Discourse keeps the backslash before it (the link pipe rule of `docs/format.md`). For example, the GFM cell ``[`x\|y`](u)`` shows `x\|y`, and no tbl text gives the same HTML. The HTML check of the conversion reports it at the cell.
- `<br/>` and `<BR>` in a GFM cell stay text and do not become line breaks.
- A `tbl` block with a text line directly after it does not convert to GFM. Add an empty line after the block.
- GFM holds only the `align` of a column and the ID of a row. A conversion to GFM fails for each other attribute, or drops it with `--drop-attributes`.
- The keys of a GFM table come from its titles. The keys of a tbl block do not survive a round trip through GFM if they differ from `keysFromTitles` of the titles.
- The package test needs the npm registry, because npm installs markdown-it, the dependency of the tarball. With no network, `mise run test` fails.
- The package has no CommonJS entry. Its `exports` has only the condition `import`, so `require("tbl-md")` fails. A CommonJS module loads it with `import("tbl-md")`.
- The pre-commit hook lints the file in the working tree. If a file has unstaged changes, the lint can differ from the staged text.
- The CLI reads each file as UTF-8. It does not report a file with bytes that are not UTF-8.
- `.tbl-md.json` has no comments. A syntax error in it names its line only where `JSON.parse` gives a position, so on Node but not on Bun.
- A `tbl` block with an error gives no warning for an unknown attribute key. The warnings come after the errors are fixed.

