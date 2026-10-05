# tbl-md

A readable table format for Markdown. A `tbl` block is a table in a fenced code block with short keys, one cell per line:

````markdown
```tbl
model: Model
price: Price
note: Note
--
model: Opus
price: $15
note: Good for research.
Second line of the same cell.
--
m: Haiku
p: $1
```
````

The first record is the header. It maps each key to a column title. A line `--` starts the next row. In a row, a key can be any unique prefix of a header key, and a missing key is an empty cell. The full format is in `docs/format.md`.

A `tbl` block is unrelated to the troff preprocessor `tbl` and to the `tbl-` cell options of Quarto.

## Status

Work in progress. The parser and the renderer exist (section Library). The GFM conversion and the CLI do not exist yet, and the package is not on npm. The plan is in `docs/PLAN.md`.

## What it will give

```tbl
part: Part
what: What it does
--
part: library
what: Parse a `tbl` block, render its canonical form, and convert it to and from a GFM pipe table with no loss of content.
--
part: tbl-md convert
what: Converts the GFM tables in Markdown files to `tbl` blocks in place. With `--to gfm`, it converts back.
--
part: tbl-md lint
what: Fails on a GFM pipe table and on an invalid `tbl` block, with the file and the line of each error.
```

## Library

`parse(text)` reads the text inside a `tbl` fence. The text starts at the first line after the opening fence and ends before the closing fence. The fence and its info string are not part of the text.

```ts
import { parse } from "./src/index.ts";

const result = parse("model: Model\nprice: Price\n--\nm: Opus\np: $15");
if (result.ok) {
  // result.table.columns: [{ key: "model", title: "Model" }, { key: "price", title: "Price" }]
  // result.table.rows: [{ cells: { model: "Opus", price: "$15" } }]
} else {
  // result.errors: [{ line, column, code, message }, ...]
}
```

The result has `ok: true` and a `table`, or `ok: false` and a list of `errors`:

- `table.columns` lists each column in header order, with its `key` and its `title`.
- `table.rows` lists each data record in order. A row has an optional `id` from its ID marker, and `cells`. `cells` maps the full header key to the cell text. The lines of a cell join with `\n`. An empty cell has no entry.
- An error has a `line` and a `column`, both from 1. Line 1 is the first line after the opening fence. The parser collects all errors. It does not stop at the first one.

These are the error codes:

```tbl
code: Code
when: When
--
code: `no-header`
when: The block is empty, or it starts with `--`.
--
code: `header-not-key`
when: A header line is no key line. This includes an empty line and an escaped line inside the header.
--
code: `header-duplicate-key`
when: The header has the same key two times.
--
code: `unknown-key`
when: A key in a data record matches no header key. The message lists the header keys.
--
code: `ambiguous-key`
when: A key is a prefix of more than one header key. The message lists these keys.
--
code: `duplicate-key`
when: A record has the same key two times, also as two different prefixes of one key.
--
code: `orphan-line`
when: A line comes before the first key line of a data record.
```

`render(table)` writes the canonical text of a table, by the section Canonical form of `docs/format.md`. The text has the lines joined with `\n` and no final newline. `renderBlock(table)` writes the whole block: the opening fence with the info string `tbl`, the text, and the closing fence, also with no final newline. The fence has three backticks, or more if a line of the text would close it.

```ts
import { parse, render, renderBlock } from "./src/index.ts";

render({ columns: [{ key: "a", title: "A" }], rows: [{ cells: { a: "x\nb: y" } }] });
// "a: A\n--\na: x\nb\\: y"
renderBlock({ columns: [{ key: "a", title: "A" }], rows: [] });
// "```tbl\na: A\n```"
```

Two laws hold for each valid table `T`, and the property test `test/laws.test.ts` checks them on random tables:

- `parse(render(T))` gives `T` back.
- `render(parse(render(T)).table)` is `render(T)`.

`validate(table)` lists the problems that stop a render with no loss, as plain English messages. An empty list means that the table is valid. `render` and `renderBlock` throw an `Error` with the first problem. Columns and rows count from 1. These are the problems:

```tbl
problem: Problem
--
problem: The table has no columns.
--
problem: A column key does not have the form `[a-z0-9_-]+`.
--
problem: Two columns have the same key.
--
problem: A title has a line break or a CR.
--
problem: A cell key is no column key.
--
problem: A row ID does not have the form `[A-Za-z0-9_-]+`.
--
problem: A cell text ends with a line break.
--
problem: A cell text has a CR.
```

An empty cell text gives no line, as a missing cell does. Thus `parse(render(T))` has no entry for it.

`src/syntax.ts` holds the line forms that the parser and the renderer share: the key line, the separator, their escaped forms, `escapeLine`, and `unescapeLine`.

## Development

The tools come from `mise.toml`.

```sh
mise install
mise run hooks-install
mise run test
```

## Libraries

- `typescript`: the type check.
- `@types/bun`: the types of `bun:test`.
- `fast-check`: the property test of the round-trip laws on random tables. It is the established property test library for TypeScript.

## Research

The format comes from the research `~/dv/markgraf/docs/research/readable-table-syntax.md` in the Markgraf project. No established format had a header record with short keys and a maintained TypeScript parser.

## License

MIT, see `LICENSE`.
