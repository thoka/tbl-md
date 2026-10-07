---
name: tbl-md
description: Write each Markdown table as a tbl block, never as a GFM pipe table. Use when you write or edit a table in a Markdown file, when a file has a pipe table, or when `tbl-md lint` reports a problem.
---

# tbl blocks

A `tbl` block is a table in a fenced code block with the info string `tbl`. Each record is one row, and each line names its column by a key. A cell can hold many lines, and no column needs padding. The full format is `docs/format.md` of the npm package `tbl-md` (https://github.com/thoka/tbl-md/blob/main/docs/format.md).

## Write a block

````
```tbl
model: Model
price: Price
{align=right}
note: Note
--
m: Opus
p: $15
n: Good for research.
A second line of the same cell.
--
m: Haiku
p: $1
```
````

1. The first record is the header: one line `key: Title` per column, in column order. A key has the form `[a-z0-9_-]+`.
2. A line `--` starts each row.
3. In a row, `key: text` starts a cell. Each later line that is not a key line continues the cell. The cell text is inline Markdown.
4. A row can leave out a key (an empty cell) and use any order. In a row, write the shortest unique prefix of the header key, mostly one letter, from the first row on. Then the cell texts start at the same column. The full key is valid, but it is not the canonical form.
5. Write a pipe `|` in a cell as it is. It needs no escape.

## Escapes and attributes

Only the start of a line can need an escape. If the text of a line looks like syntax, add one backslash at its start:

- a text line that starts with a lowercase key and a colon: `hint\: text`,
- a text line that is `--`: `\--`,
- a text line that starts with `{` and ends with `}`: `\{text}`.

A line `{...}` is an attribute block. After a header key line, it describes the column. As the last line of a cell, it describes the cell. On the `--` line, it describes the row: `-- {#id .class}`. The only key that tbl-md checks is `align` on a column, with `left`, `center`, or `right`.

## Convert and check

A pipe table in a file you edit becomes a `tbl` block. Convert it with the CLI, not by hand, because the CLI keeps each cell exactly:

```sh
tbl-md convert <file>       # each GFM table becomes a tbl block, in place
tbl-md lint <files>         # each problem with its file, line, and column
```

If the project has no `tbl-md` command, run `npx --yes tbl-md` instead. After each edit of a block, run `tbl-md lint` on the file, and fix each problem until it prints nothing.
