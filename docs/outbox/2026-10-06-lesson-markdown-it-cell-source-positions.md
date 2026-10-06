---
kind: lesson
from: tbl-md
date: 2026-10-06
---

# To get the source of each table cell from markdown-it, wrap its table rule and split each line again, with a check against the token content.

markdown-it gives a token only a line map, not the offsets of a cell. A text search for the cell content fails on escapes and on repeated text, and a fork of the table rule drifts from upstream.
Wrap the `table` rule: record `bMarks + tShift` and the text of each table line, then split each line with a copy of `escapedSplit` that also returns offsets.
Compare each cell with the token content, so that a change of markdown-it gives an error and not a wrong position. On the tbl-md corpus: 0 mismatches in 17,207 cells.
The wrapper reads the private field `md.block.ruler.__rules__`. A new major version of markdown-it can break it.
Also: the table feature of Discourse (`features/table.js`) is GPL-2.0-only, so MIT code must load it at run time or reimplement its behavior.

Source: tbl-md, docs/research/markdown-it-reference.md, section 4 (2026-10-06).
