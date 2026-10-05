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

Work in progress. The library (section Library) and the CLI `tbl-md` with `lint` and `convert` (section CLI) exist. The build makes a package for Node 22 or later and for Bun. The package is not published yet, so the install lines below work only after the first release. The plan is in `docs/PLAN.md`.

## Install

```sh
npm install tbl-md
```

Run the CLI with no install:

```sh
npx tbl-md lint README.md
bunx tbl-md lint README.md
```

The package is ESM only. It needs Node 22 or later, or Bun. Import the library by its package name:

```ts
import { convert, lint, parse, render } from "tbl-md";

const result = convert("| A |\n| --- |\n| x |\n", { to: "tbl" });
if (result.ok) console.log(result.output);
```

The package has type declarations for TypeScript. The format specification is in the package too, at `docs/format.md`.

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
import { parse } from "tbl-md";

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
import { parse, render, renderBlock } from "tbl-md";

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

`locate(text)` gives the lines of the key lines of a valid `tbl` block, so that an error about a cell or a title can name its line. All lines are block lines from 1, as in the errors of `parse`. `headerLines` maps each header key to its line. `rows` has one entry for each data record: `line` is the line of its `--`, and `cells` maps the full header key of each key line to its line, also for a prefix key. For a block with parse errors, `locate` gives `null`.

```ts
import { locate } from "tbl-md";

locate("model: Model\nnote: Note\n--\nn: a\nm: Opus");
// { headerLines: { model: 1, note: 2 }, rows: [{ line: 3, cells: { note: 4, model: 5 } }] }
```

`src/syntax.ts` holds the line forms that the parser and the renderer share: the key line, the separator, their escaped forms, `escapeLine`, and `unescapeLine`.

`findTables(source)` reads a Markdown text and lists its `tbl` blocks and its GFM tables in document order. It parses CommonMark with only the GFM table extension, and it walks the whole tree, also into list items and block quotes. A `tbl` block is a fenced code block with the language `tbl`, with backticks or tildes. An indented code block, a code block with another language (also `tbl-x` or `TBL`), and the text inside another code block or an HTML block are not `tbl` blocks.

Each entry has a `kind` (`"tbl"` or `"gfm"`), the mdast `node`, the source offsets `start` and `end` of the node, and the `line` and `column` of its start, both from 1. Thus `source.slice(start, end)` is the exact source of the node. A `tbl` entry also has `contentLine`, the file line of the first line inside the fence, `text`, the text inside the fence, and `meta`, the text after `tbl` in the info string, or `null`.

`lint(source)` lists the problems of a Markdown text, sorted by line and then by column. A problem has a `line` and a `column` in the file, a `code`, and a `message`. An error of a `tbl` block has its line in the file, and the column of the fence, because the block content starts there in a list item or a block quote.

```ts
import { lint } from "tbl-md";

lint("> ```tbl\n> a: A\n> --\n> b: x\n> ```\n");
// [{ line: 4, column: 3, code: "unknown-key", message: 'The key "b" matches no header key. ...' }]
```

These are the problem codes:

```tbl
code: Code
when: When
--
code: `gfm-table`
when: The text has a GFM pipe table. The message tells the reader to write it as a `tbl` block.
--
code: `info-text`
when: The info string has text after `tbl` (rule 1 of `docs/format.md`). The problem is at the fence line.
--
code: each error code of `parse`
when: A `tbl` block has this error. The problem is at the line of the error in the file.
```

`toGfm(table)` writes one table as a GFM pipe table, by the section "Conversion to and from GFM" of `docs/format.md`. `fromGfm(source, found)` reads one GFM table of a Markdown source back as a table. `found` is a `"gfm"` entry of `findTables(source)`. `fromGfm` reads each cell text from the source by the offsets of its mdast cell, so the inline Markdown stays byte for byte. The keys come from the titles by `keysFromTitles(titles)`.

```ts
import { findTables, fromGfm, keysFromTitles, toGfm, type FoundGfm } from "tbl-md";

toGfm({ columns: [{ key: "a", title: "A" }], rows: [{ id: "r1", cells: { a: "x|y\nz" } }] });
// { ok: true, text: "| A |\n| --- |\n| x\\|y<br>z {#r1} |" }

const source = "| Price ($) | Note |\n| :-- | --- |\n| 1 | a<br>b |\n";
fromGfm(source, findTables(source)[0] as FoundGfm);
// { ok: true, table: { columns: [{ key: "price", title: "Price ($)" }, { key: "note", title: "Note" }],
//   rows: [{ cells: { price: "1", note: "a\nb" } }] } }

keysFromTitles(["a", "a", "a-2", ""]);
// ["a", "a-3", "a-2", "c4"]
```

The GFM text has the lines joined with `\n` and no final newline. Each row has a cell for each column, and an empty cell is `|  |`. These are the mappings:

```tbl
tbl: In the tbl cell
gfm: In the GFM cell
--
tbl: a line break
gfm: `<br>`
--
tbl: `<br>`, or `<br>` after backslashes
gfm: one backslash more: `\<br>`, `\\<br>`
--
tbl: `|`, or `|` after an even number of backslashes
gfm: one backslash more: `\|`, `\\\|`
--
tbl: the row ID `r1`
gfm: ` {#r1}` at the end of the first cell, or `{#r1}` in an empty first cell
--
tbl: a first cell with no ID that ends with `{#x}`, at the start or after a space
gfm: one backslash more before the `{`: `\{#x}`
```

A title keeps `<br>` as it is. GFM column alignment is dropped. Both functions collect all errors. An error of `toGfm` has an optional `row` (from 1), an optional `key`, and a `message`. An error of a title has no `row`. An error of `fromGfm` has the `line` and the `column` of the cell in the source, and a `message`. These are the errors:

```tbl
fn: Function
when: When
--
fn: `toGfm`
when: `validate` finds a problem. The error has only the message of `validate`.
--
fn: `toGfm`
when: A title or a cell starts or ends with a space or a tab. GFM removes it.
--
fn: `toGfm`
when: A title or a cell has a pipe after an odd number of backslashes. One backslash more would give an even number, and GFM would split the cell there.
--
fn: `toGfm`
when: A cell line ends with a backslash and has a next line. The backslash would escape the `<br>` of the line break.
--
fn: `fromGfm`
when: A cell ends with `<br>`. A tbl cell never ends with a line break.
--
fn: `fromGfm`
when: A row has more cells than the header. GFM drops the extra cells.
--
fn: `fromGfm`
when: The text before the ID marker of a first cell ends with a space or a tab. The cell could not convert back.
```

Three laws hold for each valid table `T` whose keys are `keysFromTitles` of its titles and that `toGfm` accepts. The property test `test/laws.test.ts` checks them on random tables:

- `fromGfm(toGfm(T))` gives `T` back.
- `toGfm` of that table gives the same GFM text again.
- The GFM text is one GFM table with the width of the header and the rows of `T`.

A fourth property test checks the meaning: the mdast of each GFM cell, with no positions, equals the mdast of the paragraph that the tbl cell text gives when each line break is `<br>`. It skips a literal `<br>` and a first cell with an ID or with the marker form, because their text changes on purpose.

`convert(source, { to })` converts all tables of a Markdown text, in memory, by the section "Conversion of a file" of `docs/format.md`. With `to: "tbl"`, each GFM table becomes a `tbl` block (`fromGfm`, then `renderBlock`). With `to: "gfm"`, each `tbl` block becomes a GFM table (`parse`, then `toGfm`). Tables of the target kind stay as they are, also an invalid `tbl` block.

```ts
import { convert } from "tbl-md";

convert("Intro\n\n> | A |\n> | --- |\n> | x<br>y |\n", { to: "tbl" });
// { ok: true, count: 1, output: "Intro\n\n> ```tbl\n> a: A\n> --\n> a: x\n> y\n> ```\n" }

convert("```tbl\na: A\n--\nb: x\n```\n", { to: "gfm" });
// { ok: false, errors: [{ line: 4, column: 1, message: 'The key "b" matches no header key. ...' }] }
```

The result has `ok: true`, the new text `output`, and `count`, the number of converted tables. Or it has `ok: false` and `errors`, sorted by line and then by column. Each error has the `line` and the `column` in the file, both from 1, and a `message`. With an error, the result has no output, so the caller writes nothing. These rules keep the file:

- Only the source of each converted table changes. Each other byte stays the same.
- The first line of the new text starts where the table started. Each other line gets the continuation prefix: the text before the table on its first line, with each character other than `>`, a space, or a tab replaced by a space. Thus `- ` gives two spaces, `> ` gives `> `, and `> 1. ` gives `>    `. An empty line gets this prefix with no spaces at its end.
- The new text uses the first line end of the file: CRLF, LF, or CR.
- An error of a `tbl` block is at its line in the file, as in `lint`. An error of a cell from `toGfm` is at the key line of the cell, and an error of a title is at its header key line. `convert` finds these lines with `locate`.

After the conversion, `convert` reads the new text again with `findTables`. This is the self-check. Each new table must be at the same place in the list of tables, with the new kind, and it must read back as the same table. A new GFM table reads back with the keys of its titles. If the check fails, the conversion fails with an error at the first line of the table. The main case is a `tbl` block with a text line directly after it: GFM would read that line as a row of the table, so the error tells the writer to add an empty line. A `tbl` block directly after a paragraph line converts, because a GFM table can interrupt a paragraph.

Two laws hold, and the property test `test/laws.test.ts` checks them on random tables in random Markdown with paragraphs, list items, and block quotes, and with each line end. The tables have the keys of their titles:

- A conversion to GFM and back to tbl gives the same text. The frame outside the tables stays byte for byte.
- A conversion to tbl and back to GFM gives the same text, if the GFM tables are canonical.

## CLI

The package installs the CLI as `tbl-md`. Its source is `src/cli.ts`. In this checkout, run it with `mise run tbl-md <command> ...` or `bun src/cli.ts <command> ...`.

```sh
tbl-md lint <files...>
tbl-md convert [--to tbl|gfm] <files...>
```

`tbl-md lint` reads each file and prints each problem of `lint`, in the order of the files and then by line. Each problem is one line:

```text
docs/a.md:12:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)
```

The form is `<file>:<line>:<column>: <message> (<code>)`. The codes are the problem codes of `lint` (section Library). The lint does not change a file.

`tbl-md convert` converts the tables of each file in place with `convert`. `--to tbl` is the default: each GFM table becomes a `tbl` block. `--to gfm` converts each `tbl` block to a GFM table. For each file, the CLI does one of three things:

- The file has tables to convert. The CLI writes the file and prints `<file>: converted <n> table` (or `tables`).
- The file has no table to convert. The CLI prints nothing and does not write the file.
- The conversion fails. The CLI prints each error as `<file>:<line>:<column>: <message>` and does not write the file. It goes on with the next file.

The file name `-` reads stdin. `lint -` names the file `-` in its messages. `convert -` writes the text to stdout, also when it has no table to convert, and it prints its messages to stderr. If the conversion fails, it writes nothing to stdout. The name `-` can come only once.

A file that starts with a UTF-8 BOM keeps its BOM. The lines and the columns do not count it. A conversion keeps the line ends of the file.

The CLI reads all files before it changes one. If a file cannot be read, the run stops with a usage error, and no file changes.

These are the other options:

- `-h`, `--help`: print the usage to stdout.
- `--version`: print the version of the package.
- `--`: each argument after it is a file name, also if it starts with `-`.

These are the exit codes:

```tbl
code: Exit code
when: When
--
code: 0
when: No file has a problem. For `convert`: each file converted, or it had no table to convert. Also `--help` and `--version`.
--
code: 1
when: For `lint`: a file has a problem. For `convert`: the conversion of a file failed.
--
code: 2
when: A usage error: no command, an unknown command, an unknown option, a bad value of `--to`, `--to` for `lint`, no files, `-` more than once, or a file that cannot be read. The CLI prints one line to stderr that names the problem.
```

### The pre-commit hook

The pre-commit hook of this project runs `tbl-md lint` on the staged Markdown files (`lefthook.yml`). `mise run pre-commit` runs the hook on the staged files, as git does. The lint reads the file in the working tree, not the staged text.

When the package is on npm, another project can run the lint in its hook. This is an example for lefthook:

```yaml
pre-commit:
  jobs:
    - name: tbl-md lint
      glob: "*.md"
      run: npx tbl-md lint {staged_files}
```

## Known gaps

- A line break inside a code span becomes `<br>` in GFM, and in a code span `<br>` is text, not a line break. The round trip keeps the text, but a GFM viewer shows `<br>` in the code.
- A literal `<br>` in a tbl cell is an HTML line break in a Markdown view. In GFM, it becomes `\<br>`, which shows the text `<br>`. A `\<br>` in a tbl cell shows the text `<br>`. In GFM, it becomes `\\<br>`, which shows `\` and a line break. The round trip keeps the text, but the view changes.
- A tbl cell with a pipe after an odd number of backslashes, for example `a\|b`, does not convert to GFM. Write `a|b`.
- `<br/>` and `<BR>` in a GFM cell stay text and do not become line breaks.
- A `tbl` block with a text line directly after it does not convert to GFM. Add an empty line after the block.
- The keys of a GFM table come from its titles. The keys of a tbl block do not survive a round trip through GFM if they differ from `keysFromTitles` of the titles.
- The package is not published yet. `npm install tbl-md` and `npx tbl-md` work only after the first release.
- The package test needs the npm registry, because npm installs the mdast libraries of the tarball. With no network, `mise run test` fails.
- The package has no CommonJS entry. Its `exports` has only the condition `import`, so `require("tbl-md")` fails. A CommonJS module loads it with `import("tbl-md")`.
- The pre-commit hook lints the file in the working tree. If a file has unstaged changes, the lint can differ from the staged text.
- The CLI reads each file as UTF-8. It does not report a file with bytes that are not UTF-8.

## Development

The tools come from `mise.toml`.

```sh
mise install
mise run hooks-install
mise run test
```

These are the tasks of `mise.toml`:

```tbl
task: Task
what: What it does
--
task: `mise run test`
what: Runs the type check and all tests, also the package test.
--
task: `mise run build`
what: Builds the package: ESM JavaScript and type declarations from `src/` to `dist/`, by `tsconfig.build.json`.
--
task: `mise run test-package`
what: Runs only the package test, `test/package.test.ts`. It packs the package with `npm pack`, installs the tarball in a temp project, and runs the CLI and the library with Node 24, Node 22, and Bun. It also checks the files of the tarball and type checks a consumer file against the type declarations.
--
task: `mise run tbl-md <command>`
what: Runs the CLI from the source with Bun.
```

`npm pack` runs the build first (the script `prepack`), so a tarball always has a new build.

## Libraries

- `typescript`: the type check and the build.
- `@types/node`: the types of the `node:` modules, at the oldest Node that the package supports (22).
- `@types/bun`: the types of `bun:test`.
- `fast-check`: the property test of the round-trip laws on random tables. It is the established property test library for TypeScript.
- `mdast-util-from-markdown`: parses a Markdown text into an mdast tree with source positions, so that the lint finds each table at its line.
- `micromark-extension-gfm-table`: the GFM table syntax for the parser, so that the lint finds GFM pipe tables. It is the only GFM extension that the parse uses.
- `mdast-util-gfm-table`: turns the GFM table tokens into `table` nodes of the mdast tree.
- `@types/mdast`: the types of the mdast nodes. It is a runtime dependency, because the type declarations of the package use these types, for example the `node` of `findTables`.

## Research

The format comes from the research `~/dv/markgraf/docs/research/readable-table-syntax.md` in the Markgraf project. No established format had a header record with short keys and a maintained TypeScript parser.

## License

MIT, see `LICENSE`.
