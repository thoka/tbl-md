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

## Why

A GFM pipe table is hard to read and to change as plain text. One long cell pushes all columns apart, and a pipe or a line break in a cell needs an escape. Humans and agents read Markdown mostly as text, so they suffer from it in each edit.

tbl-md has one goal: humans change tables in Markdown with no frustration. A machine reads any form, so each rule of the format serves the human who edits the text (`docs/spec.md`, principle 0).

The switch is reversible. `tbl-md convert --to gfm` converts each `tbl` block back to a GFM table, and the file then renders the same. Only the layout of the GFM text, such as padding, can change. Version 0.1 drops the column alignment of GFM, and version 0.2.0 keeps it as the attribute `align`. A corpus of real tables from other projects tests the round trip (section The corpus test).

## How to write a table

- The first record is the header. Each line is `key: Title`. A key has lower-case letters, digits, `_`, and `-`. The order of the lines is the column order.
- A line `--` starts the next row. To give a row an ID, write it on that line: `-- {#a1b2c3d4}`. The ID goes to the end of the first cell in GFM.
- In a row, a line `key: text` starts a cell. A key can be any unique prefix of a header key, so `m:` is enough for `model:`. Keys can come in any order, and a missing key is an empty cell.
- Each other line continues the cell above, so a cell can have many lines, also empty lines in the middle.
- Cell text is inline Markdown, as in a GFM cell. A pipe needs no escape.
- If a text line looks like a key line or like `--`, add one backslash: `hint\: text` is the text `hint: text`, and `\--` is the text `--`.
- From version 0.2.0, attributes describe a column, a row, or a cell. Write the attribute block on its own line after the thing that it describes: `{align=right}` directly after a header key line for the column, `{.cheap}` as the last line of a cell for the cell, and `-- {#a1 .new}` on the `--` line for the row. The syntax is the attribute block of Pandoc and djot: `#id`, `.class`, and `key=value`. Put a value in double quotes if it has a character other than letters, digits, `_`, `:`, and `-`: `{note="a b"}`. `align` with `left`, `center`, or `right` is the GFM column alignment.
- A line that starts with `{` and ends with `}` is always an attribute line, and an attribute line at a wrong place is an error. If such a line is text, add one backslash: `\{.x}` is the text `{.x}`.

`tbl-md lint` names the line of each error. `docs/format.md` has the full rules.

## Version 0.3.0

Version 0.3.0 makes markdown-it the only Markdown parser, in place of micromark and mdast. A GFM table has no single meaning, because each renderer splits a row in its own way. So version 0.3.0 adds flavors: a flavor names the target renderer of GFM. The flavor `discourse` (the default) is Discourse with its default site settings, and the flavor `markdown-it` is `markdownit()`. Pick the flavor with `--flavor` or with the key `flavor` of `.tbl-md.json` (section CLI). `docs/format.md`, section Flavors, has the exact settings of each flavor.

Version 0.3.0 also changes the conversion:

- Each pipe in a cell gets one backslash more in GFM, so each text with pipes converts, also a pipe after a backslash (section "Conversion to and from GFM" of `docs/format.md`).
- The flavor `discourse` does not split a cell at a pipe inside a complete link or image, as Discourse does (the link pipe rule).
- After each conversion, the HTML check renders each converted title and cell with the flavor, before and after. If the HTML differs, the conversion fails at that cell.

Version 0.2.0 added attributes (section How to write a table). A conversion to GFM keeps `align` and the row ID, and fails for each other attribute unless you give `--drop-attributes`. The decisions of each version are in `docs/spec.md`. Version 0.3.0 also adds the markdown-it plugin, which renders a `tbl` block as an HTML table (section The markdown-it plugin).

A `tbl` block is unrelated to the troff preprocessor `tbl` and to the `tbl-` cell options of Quarto.

## Status

Work in progress. The library (section Library), the markdown-it plugin (section The markdown-it plugin), and the CLI `tbl-md` with `lint` and `convert` (section CLI) exist. The build makes a package for Node 22 or later and for Bun. The package is on npm as `tbl-md`, with provenance. Before 1.0.0, a breaking change of the format gives a new minor version. The goal and the scope of each version are in `docs/spec.md`.

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

## What it gives

```tbl
part: Part
what: What it does
--
part: library
what: Parse a `tbl` block, render its canonical form, and convert it to and from a GFM pipe table with no loss of content.
--
part: markdown-it plugin
what: Renders each `tbl` block as an HTML table in a host that uses markdown-it, such as Discourse. It comes as an ES module and as one script file.
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

parse("model: Model\nprice: Price\n{align=right}\n-- {#r1 .new}\nm: Opus\n{.top}");
// { ok: true, table: {
//   columns: [{ key: "model", title: "Model" },
//     { key: "price", title: "Price", attributes: { classes: [], pairs: [{ key: "align", value: "right" }] } }],
//   rows: [{ attributes: { id: "r1", classes: ["new"], pairs: [] }, cells: { model: "Opus" },
//     cellAttributes: { model: { classes: ["top"], pairs: [] } } }] } }
```

The result has `ok: true` and a `table`, or `ok: false` and a list of `errors`:

- `table.columns` lists each column in header order, with its `key`, its `title`, and optional `attributes` from the attribute line after its header key line.
- `table.rows` lists each data record in order. A row has optional `attributes` from its `--` line, `cells`, and optional `cellAttributes`. The row ID is `row.attributes.id`. `cells` maps the full header key to the cell text. The lines of a cell join with `\n`. An empty cell has no entry. `cellAttributes` maps the full header key to the attributes of the cell. A cell can have attributes and no text.
- `attributes` has an optional `id`, a list `classes`, and a list `pairs` of `{ key, value }`, all in source order. A value has no quotes and no escapes. The parser sets `attributes` and `cellAttributes` only if the block has attributes for them, so a table with no attributes gives the same objects as in version 0.1.
- An error has a `line` and a `column`, both from 1. Line 1 is the first line after the opening fence. The column of an attribute error is the column of its first bad character. The parser collects all errors, sorted by line and then by column. It does not stop at the first one, but it gives one error per attribute line at most.

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
--
code: `attr-unexpected-char`
when: An attribute block has an unexpected character, for example `{.hl !}`.
--
code: `attr-no-space`
when: Two parts of an attribute block have no space between them, for example `{#a.b}`.
--
code: `attr-empty`
when: An attribute block is empty: `{}` or `{ }`.
--
code: `attr-bad-id`
when: An ID is empty or has a bad character, for example `{#}` or `{#a:b}`.
--
code: `attr-bad-class`
when: A class is empty, has no letter first, or has a bad character, for example `{.}` or `{.1a}`.
--
code: `attr-bad-key`
when: A key has no letter first or has a bad character, for example `{1k=v}`.
--
code: `attr-duplicate-id`
when: A block has more than one ID.
--
code: `attr-duplicate-class`
when: A block has the same class two times.
--
code: `attr-duplicate-key`
when: A block has the same key two times.
--
code: `attr-reserved-key`
when: A block has the key `id` or `class`. The message names `#x` or `.x`.
--
code: `attr-no-value`
when: A key has no value, for example `{k}` or `{k=}`.
--
code: `attr-bad-bare-value`
when: A value with no quotes has a character other than `[A-Za-z0-9_:-]`. The message shows the value in quotes.
--
code: `attr-single-quotes`
when: A value has single quotes. The message names double quotes.
--
code: `attr-unclosed-quote`
when: A quoted value has no closing quote.
--
code: `attr-bad-escape`
when: A quoted value has a backslash before a character other than `"` or `\`.
--
code: `attr-bad-value`
when: A known key has a bad value, for example `{align=middle}`. The message lists the values.
--
code: `attr-key-place`
when: A known key is at a place that does not allow it: `align` on a row or a cell.
--
code: `attr-second-line`
when: A column or a cell has a second attribute line.
--
code: `attr-misplaced`
when: A line in the attribute form is at a place that takes no attributes: before the first header key, after an empty line or a text line in the header, before the first key of a record (also directly after `--`), or in the middle of a cell.
```

An error in the attribute block of a `--` line has the code of the grammar error, at its column in the line. A place error wins over a grammar error, because the parser does not read a block at a wrong place.

`parseAttributes(block, place?)` reads one attribute block, such as `{#a1 .new align=right}`, by the grammar of rule 14 of `docs/format.md`. With a place (`"column"`, `"row"`, or `"cell"`), it also checks the known key `align`. The result has `ok: true` and the `attributes`, or `ok: false` and one `error` with a `code`, a `message`, and the 0-based `offset` of the first bad character in the block. `renderAttributes(attributes)` writes the canonical form: the ID, then the classes, then the pairs. A value is bare if it has the form `[A-Za-z0-9_:-]+`, and else it gets double quotes. `validateAttributes(attributes, place, where)` lists the problems of one attributes object, as `validate` does.

```ts
import { parseAttributes, renderAttributes } from "tbl-md";

parseAttributes('{ note="a b" .x #r1 }');
// { ok: true, attributes: { id: "r1", classes: ["x"], pairs: [{ key: "note", value: "a b" }] } }
renderAttributes({ id: "r1", classes: ["x"], pairs: [{ key: "note", value: "a b" }] });
// '{#r1 .x note="a b"}'
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
problem: An attribute block of a column, a row, or a cell is empty: no ID, no class, and no pair.
--
problem: An ID does not have the form `[A-Za-z0-9_-]+`.
--
problem: A class does not have the form `[A-Za-z][A-Za-z0-9_-]*`, or a block has the same class two times.
--
problem: An attribute key does not have the form `[A-Za-z][A-Za-z0-9_-]*`, is `id` or `class`, or comes two times in a block.
--
problem: An attribute value has a line break or a CR.
--
problem: The value of `align` is not `left`, `center`, or `right`, or `align` is on a row or a cell.
--
problem: `cellAttributes` has a key that is no column key.
--
problem: A cell text ends with a line break.
--
problem: A cell text has a CR.
```

An empty cell text gives no line, as a missing cell does. Thus `parse(render(T))` has no entry for it. A cell with attributes and no text gives the key line `key:` and the attribute line.

The renderer writes the attribute line of a column directly after its header key line, the block of a row on its `--` line, and the attribute line of a cell as the last line of the cell.

`locate(text)` gives the lines of the key lines and of the attribute lines of a valid `tbl` block, so that an error about a cell, a title, or an attribute can name its line. All lines are block lines from 1, as in the errors of `parse`. `headerLines` maps each header key to its line, and `headerAttributeLines` maps the key of each column with an attribute line to that line. `rows` has one entry for each data record: `line` is the line of its `--`, which also holds the block of the row. `cells` maps the full header key of each key line to its line, also for a prefix key, and `cellAttributeLines` maps the full header key of each cell with an attribute line to that line. For a block with parse errors, `locate` gives `null`.

```ts
import { locate } from "tbl-md";

locate("model: Model\nnote: Note\n{align=right}\n--\nn: a\n{.c}\nm: Opus");
// { headerLines: { model: 1, note: 2 }, headerAttributeLines: { note: 3 },
//   rows: [{ line: 4, cells: { note: 5, model: 7 }, cellAttributeLines: { note: 6 } }] }
```

`src/syntax.ts` holds the line forms that the parser and the renderer share: the key line, the separator, the attribute line, their escaped forms, `escapeLine`, and `unescapeLine`.

`findTables(source, options?)` reads a Markdown text with markdown-it and lists its `tbl` blocks and its GFM tables in document order, also in list items and block quotes. The option `flavor` (`"discourse"` or `"markdown-it"`, the type `Flavor`) picks the markdown-it settings (section Flavors of `docs/format.md`). The default is `"discourse"`. A `tbl` block is a fenced code block whose info string starts with the word `tbl`, with backticks or tildes. An indented code block, a code block with another language (also `tbl-x` or `TBL`), and the text inside another code block or an HTML block are not `tbl` blocks. With the flavor `"markdown-it"`, HTML is off, so `<div>` starts no HTML block.

Each entry has a `kind` (`"tbl"` or `"gfm"`), the source offsets `start` and `end`, and the `line` and `column` of its start, both from 1. `start` is the first character of the fence or of the header row, and `end` is the end of the last line of the block, before its line end. Thus `source.slice(start, end)` is the exact source of the block. The offsets, lines, and columns refer to the original text, also with CRLF or CR line ends. A `tbl` entry also has `contentLine`, the file line of the first line inside the fence, `text`, the text inside the fence (with LF line ends and no final line end), and `meta`, the text after `tbl` in the info string, or `null`. A `gfm` entry (the type `FoundGfm`) also has `align`, the alignment of each column (`"left"`, `"center"`, `"right"`, or `null`), `header`, the header row, and `rows`, the body rows. A row (`GfmRow`) has its `line` and its `cells`: each cell of the source as the table rule of markdown-it splits it, also an excess cell. A cell (`GfmCell`) has its `text` with no pipe and no character of the trim at its edges, but with its escapes, and the `line` and `column` of the first character of that text.

`lint(source, options?)` lists the problems of a Markdown text, sorted by line and then by column. A problem has a `line` and a `column` in the file, a `severity` (`"error"` or `"warning"`), a `code`, and a `message`. An error of a `tbl` block has its line in the file, and the column of the fence, because the block content starts there in a list item or a block quote.

The option `flavor` picks the markdown-it settings that find the tables, as in `findTables`. The default is `"discourse"`.

The option `attributeKeys` is the list of the attribute keys of the project. A pair with a key that is not `align` and not in the list gives the warning `unknown-attribute-key`, in a column, a row, and a cell. With no list, each key other than `align` is unknown. The warning is at the key in the file. A block with an error gives only its errors and no warning. The library does not read a configuration file. The CLI reads `.tbl-md.json` (section Configuration) and gives its list and its flavor to `lint`.

```ts
import { lint } from "tbl-md";

lint("> ```tbl\n> a: A\n> --\n> b: x\n> ```\n");
// [{ line: 4, column: 3, severity: "error", code: "unknown-key", message: 'The key "b" matches no header key. ...' }]
lint("```tbl\na: A\n{status=open owner=me}\n```\n", { attributeKeys: ["status"] });
// [{ line: 3, column: 14, severity: "warning", code: "unknown-attribute-key", message: 'The attribute key "owner" is unknown. ...' }]
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
--
code: `unknown-attribute-key`
when: A warning. A pair of a valid `tbl` block has a key that is not `align` and not in `attributeKeys` (rule 15 of `docs/format.md`). The problem is at the key.
```

Each code other than `unknown-attribute-key` is an error.

`findConfig(folder)`, `readConfig(file)`, and `parseConfig(text, file)` are the loader of the configuration file that the CLI uses (section Configuration). `findConfig` gives the absolute path of the configuration file for a folder, or `null`. `readConfig` and `parseConfig` give `{ ok: true, config: { attributeKeys, flavor? } }`, where `flavor` is absent if the file has none, or `{ ok: false, error: { file, line?, message } }`. `CONFIG_FILE` is the name `.tbl-md.json`.

`toGfm(table, options?)` writes one table as a GFM pipe table, by the section "Conversion to and from GFM" of `docs/format.md`. `fromGfm(source, found)` reads one GFM table of a Markdown source back as a table. `found` is a `"gfm"` entry of `findTables(source)`. `fromGfm` takes each cell text from the cells of `found`, so the inline Markdown stays byte for byte. The keys come from the titles by `keysFromTitles(titles)`.

```ts
import { findTables, fromGfm, keysFromTitles, toGfm, type FoundGfm } from "tbl-md";

toGfm({ columns: [{ key: "a", title: "A" }], rows: [{ attributes: { id: "r1", classes: [], pairs: [] }, cells: { a: "x|y\nz" } }] });
// { ok: true, text: "| A |\n| --- |\n| x\\|y<br>z {#r1} |" }

const source = "| Price ($) | Note |\n| --: | --- |\n| 1 | a<br>b |\n";
fromGfm(source, findTables(source)[0] as FoundGfm);
// { ok: true, table: { columns: [
//     { key: "price", title: "Price ($)", attributes: { classes: [], pairs: [{ key: "align", value: "right" }] } },
//     { key: "note", title: "Note" }],
//   rows: [{ cells: { price: "1", note: "a\nb" } }] } }

const wide = { columns: [{ key: "a", title: "A", attributes: { classes: ["wide"], pairs: [{ key: "align", value: "center" }] } }], rows: [] };
toGfm(wide);
// { ok: false, errors: [{ key: "a", attribute: "column",
//   message: 'Column "a": the attribute `.wide` has no GFM form, because GFM keeps only the align of a column. ...' }] }
toGfm(wide, { dropAttributes: true });
// { ok: true, text: "| A |\n| :---: |" }

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
tbl: `|`, also after backslashes
gfm: one backslash more: `|` becomes `\|`, and `\|` becomes `\\|`
--
tbl: the row ID `r1`
gfm: ` {#r1}` at the end of the first cell, or `{#r1}` in an empty first cell
--
tbl: a first cell with no ID that ends with `{#x}`, at the start or after a space
gfm: one backslash more before the `{`: `\{#x}`
--
tbl: `{align=left}`, `{align=center}`, or `{align=right}` of a column
gfm: `:---`, `:---:`, or `---:` in the delimiter row. A column with no `align` is `---`.
```

A title keeps `<br>` as it is. `fromGfm` gives a column with an alignment the attributes `{ classes: [], pairs: [{ key: "align", value }] }`, and a column with no alignment gets no `attributes`. It gives a row with an ID the attributes `{ id, classes: [], pairs: [] }`. Each other attribute has no GFM form: a class or a pair of a row, any attribute of a cell, and any attribute of a column other than `align`. `toGfm` gives one error for each attribute block with such a part, unless `options.dropAttributes` is true. With `dropAttributes`, it keeps the `align` of the columns and the ID of the rows, and drops the rest with no error.

Both functions collect all errors. An error of `toGfm` has an optional `row` (from 1), an optional `key`, an optional `attribute`, and a `message`. An error of a title has no `row`. An error of an attribute block has `attribute`: `"column"` with the `key` of the column, `"row"` with the `row`, or `"cell"` with the `row` and the `key`. An error of `fromGfm` has the `line` and the `column` of the cell in the source, and a `message`. These are the errors:

```tbl
fn: Function
when: When
--
fn: `toGfm`
when: `validate` finds a problem. The error has only the message of `validate`.
--
fn: `toGfm`
when: A title or a cell starts or ends with a space, a tab, or another character that markdown-it trims, such as a no-break space (U+00A0). GFM removes it.
--
fn: `toGfm`
when: A cell line ends with a backslash and has a next line. The backslash would escape the `<br>` of the line break.
--
fn: `toGfm`
when: An attribute block has a part with no GFM form, and `dropAttributes` is not true. The message names the parts and the two fixes: remove them, or convert with `--drop-attributes`.
--
fn: `fromGfm`
when: A cell ends with `<br>`. A tbl cell never ends with a line break.
--
fn: `fromGfm`
when: A row has an excess cell with text, after the last column of the header. GFM drops it. The error names the first such cell of the row. An excess cell with no text, or with only spaces and tabs, is dropped with no error.
--
fn: `fromGfm`
when: The text before the ID marker of a first cell ends with a space or a tab. The cell could not convert back.
```

Three laws hold for each valid table `T` whose keys are `keysFromTitles` of its titles and that `toGfm` accepts. The property test `test/laws.test.ts` checks them on random tables:

- `fromGfm(toGfm(T))` gives `T` back.
- `toGfm` of that table gives the same GFM text again.
- The GFM text is one GFM table with the width of the header and the rows of `T`.

The tables of these laws have a random `align`. One more law holds for each valid table `T` with random attributes, whose keys are `keysFromTitles` of its titles and whose text `toGfm` accepts: `toGfm(T, { dropAttributes: true })` converts, and it reads back as the table that GFM can hold, that is `T` with only the `align` of the columns and the ID of the rows. The same holds for `convert` with `dropAttributes`.

A fourth property test checks the meaning, once for each flavor: the HTML of each GFM cell, as the flavor renders the whole GFM table, equals the HTML that the flavor gives for the tbl cell text as inline Markdown, with each line break written as `<br>`. It skips a literal `<br>` and a first cell with an ID or with the marker form, because their text changes on purpose.

`convert(source, { to, dropAttributes?, flavor? })` converts all tables of a Markdown text, in memory, by the section "Conversion of a file" of `docs/format.md`. With `to: "tbl"`, each GFM table becomes a `tbl` block (`fromGfm`, then `renderBlock`). With `to: "gfm"`, each `tbl` block becomes a GFM table (`parse`, then `toGfm`). Tables of the target kind stay as they are, also an invalid `tbl` block. `dropAttributes: true` is only for `to: "gfm"`, and `convert` passes it to `toGfm`. With `to: "tbl"`, it has no effect. `flavor` picks the markdown-it settings that find and read the tables and that render them in the HTML check. The default is `"discourse"`.

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
- An error of a `tbl` block is at its line in the file, as in `lint`. An error of a cell from `toGfm` is at the key line of the cell, and an error of a title is at its header key line. An attribute with no GFM form is at its attribute line, or for a row at its `--` line. `convert` finds these lines with `locate`. The column of these errors is the column of the fence.

After the conversion, `convert` reads the new text again with `findTables`. This is the self-check. Each new table must be at the same place in the list of tables, with the new kind, and it must read back as the same table, with the same attributes. A new GFM table reads back with the keys of its titles, and as the table that GFM can hold: the `align` of the columns, the ID of the rows, and no other attributes. If the check fails, the conversion fails with an error at the first line of the table. The main case is a `tbl` block with a text line directly after it: GFM would read that line as a row of the table, so the error tells the writer to add an empty line. A `tbl` block directly after a paragraph line converts, because a GFM table can interrupt a paragraph.

Then comes the HTML check of `docs/format.md`. The flavor renders each title and each cell of a converted table in its GFM form and in its tbl form, and the two must give the same HTML. If they differ, the conversion fails with an error at that title or cell, with both HTML texts. With the flavor `discourse`, the check finds a pipe in a link that Discourse shows with its backslash. A cell whose two forms are the same text needs no render, because markdown-it parses the inline content of each cell alone.

Two laws hold, and the property test `test/laws.test.ts` checks them on random tables in random Markdown with paragraphs, list items, and block quotes, and with each line end. The tables have the keys of their titles:

- A conversion to GFM and back to tbl gives the same text. The frame outside the tables stays byte for byte.
- A conversion to tbl and back to GFM gives the same text, if the GFM tables are canonical.

## The markdown-it plugin

The plugin renders each `tbl` block of a Markdown text as an HTML table, in each host that renders Markdown with markdown-it. Import it from `tbl-md/markdown-it` and give it to `md.use`:

```ts
import markdownit from "markdown-it";
import tblPlugin from "tbl-md/markdown-it";

const md = markdownit().use(tblPlugin);
md.render("```tbl\nmodel: Model\nprice: Price\n{align=right}\n--\nm: *Opus*\np: $15\n```\n");
// <table>
// <thead>
// <tr>
// <th>Model</th>
// <th style="text-align:right">Price</th>
// </tr>
// </thead>
// <tbody>
// <tr>
// <td><em>Opus</em></td>
// <td style="text-align:right">$15</td>
// </tr>
// </tbody>
// </table>
```

The plugin works on the engine that the host gives it, with the options and the rules of that engine. It does not load markdown-it itself. It does these steps:

- A core rule before the core rule `inline` replaces each valid `tbl` block with the token `tbl_open`, the table tokens of markdown-it (`table_open` to `table_close`, with `thead`, `tbody`, `tr`, `th`, and `td`), and the token `tbl_close`. A `tbl` block is a fenced code block whose info string is exactly `tbl`, with backticks or tildes, also in a list item or a block quote (rule 1 of `docs/format.md`). A table with no rows has no `tbody`, as in markdown-it.
- Each title and each cell is an `inline` token, so the inline rules of the host apply to it, for example emphasis, links, and the emoji of Discourse. A missing cell is an empty `td`.
- A second core rule after `inline` turns each soft line break in a cell into a hard line break. Thus each line break of a cell is a `<br>`, also with the option `breaks: false`.
- Each new token gets the `map` of the fence, so a preview can scroll to the block. `tbl_open.meta` has `source` (the text inside the fence), `table` (the result of `parse`), `info`, and `markup`.
- The renderer rules of `tbl_open` and `tbl_close` write nothing. A host can set them, for example to write a wrapper element. The plugin keeps a rule that the host set before.

The attributes go into the HTML by this mapping. The markdown-it renderer escapes each value:

```tbl
attr: Attribute
html: HTML
--
attr: `align` of a column
html: `style="text-align:left"`, `center`, or `right` on the `th` and on each `td` of the column, as in a GFM table of markdown-it.
--
attr: `#id`
html: `id`. The ID of a column goes only to its `th`. The ID of a row goes to its `tr`, and the ID of a cell to its `td`.
--
attr: `.class`
html: `class`. A class of a column goes to its `th` and to each `td` of the column, before the classes of the cell. A class comes once.
--
attr: `key=value`
html: `data-<key>="value"`, with the key in lower case. The key never becomes a plain attribute, so `onclick=x` gives `data-onclick="x"`. A pair of a column goes only to its `th`.
```

Two keys that differ only in case, such as `Note=a note=b` in one block, give the same data attribute. The later pair wins.

The plugin has one option, `attributes`. It is a hook that changes or drops the attributes of a column, a row, or a cell before they go into the HTML. The plugin calls it once for each column, each row, and each cell, also for a place with no attributes. The hook gets a copy of the attributes with no `align` pair, and the place: `{ kind: "column", key }`, `{ kind: "row", row }`, or `{ kind: "cell", key, row }`, where `row` counts the data rows from 1. It returns the attributes to use, or `null` to drop all of them. The `align` of a column never goes through the hook. A key from the hook must have the key form of rule 14, or the render throws an `Error`. For example, a host that keeps only the alignment and the IDs, with a prefix:

```ts
md.use(tblPlugin, {
  attributes: (attributes) => (attributes.id === undefined ? null : { id: `tbl-${attributes.id}`, classes: [], pairs: [] }),
});
```

An invalid `tbl` block stays the `fence` token, so the host shows it as its normal code block, with all its text. A fence with text after `tbl` in its info string is invalid too. The HTML has no error text. The plugin puts the errors into `token.meta.tblErrors` of the fence token, so that an editor preview can show them. Each error has a `line`, a `column`, a `code`, and a `message`, as the errors of `parse`: line 1 is the first line after the opening fence. The error `info-text` is at line 0, the opening fence. A fence with the info `TBL` or `tbl-x` is no `tbl` block, and the plugin does not touch it.

A host that loads a plain script and no ES module, such as a Discourse plugin, uses the file `dist/tbl-md-markdown-it.iife.js` of the package (the export `tbl-md/markdown-it.iife.js`). It is one minified file with no import and no `node:` module, about 13 KB (5 KB with gzip). It defines the global name `tblMdMarkdownIt`, and the plugin function is `tblMdMarkdownIt.default`:

```js
md.use(window.tblMdMarkdownIt.default);
```

The plugin types are `TblPluginOptions`, `TblPlace`, `TblOpenMeta`, `TblPluginError`, and `TblPluginErrorCode`. The type declarations of `tbl-md/markdown-it` use the types of markdown-it, which markdown-it ships.

Two small differences from the GFM form of a table remain. A line break inside a code span is a space in the plugin HTML, and the GFM form shows the text `<br>` in the code. The spaces at the start of a continuation line of a cell are not in the HTML.

## CLI

The package installs the CLI as `tbl-md`. Its source is `src/cli.ts`. In this checkout, run it with `mise run tbl-md <command> ...` or `bun src/cli.ts <command> ...`.

```sh
tbl-md lint [--flavor discourse|markdown-it] [--config <file>] [--max-warnings <n>] <files...>
tbl-md convert [--to tbl|gfm] [--drop-attributes] [--flavor discourse|markdown-it] [--config <file>] <files...>
```

`tbl-md lint` reads each file and prints each problem of `lint`, in the order of the files and then by line. It gives `lint` the `attributeKeys` of the configuration file of each file (section Configuration), and the flavor of the file. Each problem is one line, and a summary line counts the errors and the warnings:

```text
docs/a.md:12:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)
docs/a.md:20:2: warning: The attribute key "owner" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. The configuration file is .tbl-md.json. (unknown-attribute-key)
1 error and 1 warning.
```

The form of an error is `<file>:<line>:<column>: <message> (<code>)`, and the form of a warning is `<file>:<line>:<column>: warning: <message> (<code>)`. The message of an unknown key also names the configuration file that the CLI used, or says that it found none. The codes are the problem codes of `lint` (section Library). With no problem, the CLI prints nothing. If the warnings are more than `--max-warnings`, the summary line says so. The lint does not change a file.

`tbl-md convert` converts the tables of each file in place with `convert`. `--to tbl` is the default: each GFM table becomes a `tbl` block. `--to gfm` converts each `tbl` block to a GFM table. An attribute with no GFM form is an error at its line. With `--drop-attributes`, `--to gfm` drops these attributes and keeps the `align` of the columns and the IDs of the rows. `convert` reads the configuration file of each file as `lint` does, but it uses only its `flavor`. For each file, the CLI does one of three things:

- The file has tables to convert. The CLI writes the file and prints `<file>: converted <n> table` (or `tables`).
- The file has no table to convert. The CLI prints nothing and does not write the file.
- The conversion fails. The CLI prints each error as `<file>:<line>:<column>: <message>` and does not write the file. It goes on with the next file.

The file name `-` reads stdin. `lint -` names the file `-` in its messages. `convert -` writes the text to stdout, also when it has no table to convert, and it prints its messages to stderr. If the conversion fails, it writes nothing to stdout. The name `-` can come only once.

A file that starts with a UTF-8 BOM keeps its BOM. The lines and the columns do not count it. A conversion keeps the line ends of the file.

The CLI reads all files before it changes one. If a file cannot be read, the run stops with a usage error, and no file changes.

Each file has one flavor. `--flavor` gives it for all files. Without `--flavor`, the flavor is the `flavor` of the configuration file of the file. If that file has no `flavor`, or the file has no configuration file, the flavor is `discourse`. The CLI reads the configuration files also with `--flavor`, so that `lint` gets the attribute keys, and so that an error in a configuration file always stops the run.

These are the other options:

- `-h`, `--help`: print the usage to stdout.
- `--version`: print the version of the package.
- `--drop-attributes`: only for `convert --to gfm`. Drop each attribute that GFM cannot hold, with no error.
- `--flavor <flavor>`: `discourse` or `markdown-it`. The target renderer of GFM for all files. It wins over the `flavor` of the configuration file. The default is `discourse`.
- `--config <file>`: use this configuration file for all files, and do not search for `.tbl-md.json`. `convert` uses only its `flavor`.
- `--max-warnings <n>`: only for `lint`. If there are more than `n` warnings in all files, the exit code is 1. `n` is a whole number, 0 or more. With no option, there is no limit, as in ESLint.
- `--`: each argument after it is a file name, also if it starts with `-`.

These are the exit codes:

```tbl
code: Exit code
when: When
--
code: 0
when: For `lint`: no file has an error, and the warnings are not more than `--max-warnings`. For `convert`: each file converted, or it had no table to convert. Also `--help` and `--version`.
--
code: 1
when: For `lint`: a file has an error, or the warnings are more than `--max-warnings`. For `convert`: the conversion of a file failed.
--
code: 2
when: A usage error: no command, an unknown command, an unknown option, a bad value of `--to`, `--flavor`, or `--max-warnings`, `--to` or `--drop-attributes` for the wrong command, `--max-warnings` for `convert`, no files, `-` more than once, or a file that cannot be read. Or a configuration error (section Configuration). The CLI prints one line to stderr that names the problem.
```

### Configuration

`tbl-md lint` reads the attribute keys of the project from the file `.tbl-md.json`. Rule 15 of `docs/format.md` says that the lint warns on an unknown attribute key. The file lists the keys that the project knows. It can also give the flavor of the project, for `lint` and `convert`:

```json
{
  "$schema": "https://raw.githubusercontent.com/thoka/tbl-md/v0.3.0/schema/tbl-md.schema.json",
  "attributeKeys": ["status", "owner"],
  "flavor": "discourse"
}
```

- `attributeKeys` is a list of keys in the key form of rule 14: a letter, then letters, digits, `_`, and `-`. Keys are case-sensitive. `align` is always known and needs no entry. With no `attributeKeys`, each key other than `align` is unknown.
- `flavor` is optional: `"discourse"` or `"markdown-it"` (section Flavors of `docs/format.md`). `--flavor` wins over it. With no `flavor`, the flavor is `discourse`. The key needs version 0.3.0 or later, also in the URL of `$schema`, because the schema of version 0.2.0 does not know it.
- `$schema` is optional. It names the JSON Schema of the file, so that an editor can check the file and complete the keys. The loader ignores its value, but the value must be a string. The package has the schema as `schema/tbl-md.schema.json`.
- The file is plain JSON, with no comments. `JSON.parse` reads it, so the package needs no other parser.

For each file, the CLI searches the configuration file. The search starts in the folder of the file and goes up. It stops at the first folder with `.tbl-md.json`, and uses that file. It also stops at the first folder with a `.git` entry (a folder, or a file as in a git worktree), and at the root of the file system. Then the file has no configuration. For stdin (`-`), the search starts in the current folder. The nearest file wins, and the CLI does not merge files. Thus a subfolder with its own `.tbl-md.json` has its own full list. `--config <file>` gives one file for all files of the run, and the CLI does not search. There is no configuration in the home folder, so that the lint gives the same result on each computer.

These are configuration errors: invalid JSON, a value that is not an object, a key other than `$schema`, `attributeKeys`, and `flavor`, a value of a wrong type, a key that does not have the key form, a `flavor` other than `"discourse"` and `"markdown-it"`, and a file that cannot be read. A configuration error stops the run before any output and before any file changes, with exit code 2. The CLI prints one line to stderr that names the file, for example:

```text
tbl-md: docs/.tbl-md.json: attributeKeys[2] "Owner name" is not a key. A key starts with a letter, then letters, digits, "_", and "-".
```

For invalid JSON, the line has the message of `JSON.parse`. It names the line of the file (`tbl-md: .tbl-md.json:3: ...`) only if `JSON.parse` gives a position. Node gives it for most errors, and Bun gives none.

### The pre-commit hook

The pre-commit hook of this project runs `tbl-md lint --max-warnings 0` on the staged Markdown files (`lefthook.yml`), so that an unknown attribute key fails the commit too. `mise run pre-commit` runs the hook on the staged files, as git does. The lint reads the file in the working tree, not the staged text.

When the package is on npm, another project can run the lint in its hook. This is an example for lefthook:

```yaml
pre-commit:
  jobs:
    - name: tbl-md lint
      glob: "*.md"
      run: npx tbl-md lint --max-warnings 0 {staged_files}
```

## Known gaps

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
what: Builds the package: ESM JavaScript and type declarations from `src/` to `dist/`, by `tsconfig.build.json`. Then `scripts/bundle.ts` builds the single file `dist/tbl-md-markdown-it.iife.js` of the markdown-it plugin with esbuild.
--
task: `mise run test-package`
what: Runs only the package test, `test/package.test.ts`. It packs the package with `npm pack`, installs the tarball in a temp project, and runs the CLI and the library with Node 24, Node 22, and Bun. It also checks the files of the tarball and type checks a consumer file against the type declarations.
--
task: `mise run tbl-md <command>`
what: Runs the CLI from the source with Bun.
--
task: `mise run corpus`
what: Runs the corpus test (section The corpus test). It needs the network for the files that are not in the cache yet. With `--verbose`, it also lists each conversion error.
--
task: `mise run corpus-pin <owner/repo> <commit> <path>...`
what: Gets each file and writes its size and SHA-256 into `corpus/sources.json`. A new source needs `--license <SPDX id>`. `--kind <kind>` sets the kind of the files (default `markdown`).
--
task: `mise run corpus-discourse`
what: Downloads the table feature of Discourse (`features/table.js`, GPL-2.0-only) at the pinned commit into the corpus cache, with a hash check, once. With it, `mise run test` also compares the link pipe rule of the flavor `discourse` with Discourse. Without it, these tests skip. The file never goes into the repository or the package.
```

`npm pack` runs the build first (the script `prepack`), so a tarball always has a new build.

### The corpus test

Principle 1 of `docs/spec.md` says that a switch to tbl-md must be reversible. The corpus test checks this on tables that other people wrote. The corpus is a list of real Markdown files and of the table fixtures of established Markdown parsers, in `corpus/sources.json`. The list holds the table fixtures of cmark-gfm, micromark, markdown-it, pulldown-cmark, goldmark, and remark-gfm, and real Markdown files from large open source projects, such as Node.js, Kubernetes, and Rust. Each source is pinned to a commit. The files are not part of the repository, and the code in `corpus/` is not part of the package.

`mise run corpus` does these steps:

1. It gets each file of `corpus/sources.json` from `https://raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>`, with no token and no extra header.
2. It makes sure that the SHA-256 of each file is the SHA-256 in `corpus/sources.json`. On a wrong hash, it stops with an error that names the file. Only `mise run corpus-pin` writes a hash, so a changed file always gives an error.
3. It splits each fixture file into one Markdown document for each example. A plain Markdown file is one document.
4. It converts each document with a GFM table to `tbl` and back to GFM with the library, with the flavor `discourse`. It compares the HTML of markdown-it with the settings of that flavor before and after, table by table. It also compares the HTML of the blocks outside the tables.
5. If a table of a document fails the conversion, that table counts as `error`. The check then removes that table from the document and converts the document again. On each line of the removed table, it keeps the characters before the column of the table, for example the `>` of a block quote or the indent of a list item, and it removes the rest. So the other tables keep their lines and their containers, and one error does not hide them.
6. It prints the file and the line of each difference, never the content, and a summary of counts for each source.

The summary has the number of documents with a GFM table and the number of GFM tables in them. The other counts are per table, and they add up to the number of tables. A document that differs outside its tables adds one more `different`.

The counts:

```tbl
count: Count
meaning: Meaning
--
count: same
meaning: The HTML of the table after the round trip is the same.
--
count: error
meaning: The conversion of the table to `tbl` fails with an error by `docs/format.md`, for example for an excess cell with text. This is not a failure: tbl-md loses no content in silence. The check of the other tables of the document goes on.
--
count: different
meaning: The HTML of the table differs, also only in the column alignment, or the HTML of the text outside the tables differs. The run fails.
```

A crash also fails the run. Neither `mise run test` nor the pre-push hook runs the corpus test. `test/corpus.test.ts` tests the parts that need no network.

The kinds of a file:

```tbl
kind: Kind
documents: Documents
--
kind: `markdown`
documents: The whole file.
--
kind: `spec`
documents: The spec format of cmark-gfm and pulldown-cmark. Each example starts with a line of 32 backticks and the word `example`, and its Markdown ends at a line `.`. The character `→` stands for a tab.
--
kind: `markdown-it`
documents: The fixture format of markdown-it. The Markdown is between the first and the second line `.` of a case.
--
kind: `goldmark`
documents: The fixture format of goldmark. The Markdown is between the first and the second line `//- - - - - - - - -//` of a case.
```

The cache is `$XDG_CACHE_HOME/tbl-md/corpus/<owner>/<repo>/<commit>/<path>`, by default `~/.cache/tbl-md/corpus/`. A file that the cache has with the correct hash never downloads again. A commit never changes, so the cache never gets old. Delete the folder to get all files again.

The caps: 512 KiB for each file and 4 MiB for all files of one run. The download reads each file as a stream and stops as soon as a cap is passed. The corpus has about 1.6 MB.

If raw.githubusercontent.com is not available, jsDelivr is the fallback: `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/<path>` gives the same file. To use it, change `rawUrl` in `corpus/lib.ts`. The code has no automatic fallback.

Licenses: each source in `corpus/sources.json` has its license, and a file with another license has its own. Use only sources with an open license. A copy in the local cache shares nothing, so the conditions of the licenses for sharing do not apply. Do not copy a table from the corpus into `test/`. Some sources have a share-alike license, for example the GFM spec (CC-BY-SA-4.0). Write a regression test with a new table that shows the same case.

### The markdown-it measurement

`docs/format.md` holds the measurement of markdown-it 15.0.1 that the pipe rule, the trim, and the place of a new GFM table rest on (sections "How markdown-it splits a GFM row" and "Where a new GFM table can stand"). `test/markdown-it.test.ts` checks its statements. With the table feature of Discourse in the cache (`mise run corpus-discourse`), it also compares the link pipe rule of the flavor `discourse` with Discourse.

## Release

A merge of the release PR makes a release. release-please keeps one release PR open on GitHub, and it updates the PR after each push to `main`. When you merge the PR, the workflow `.github/workflows/release.yml` does these steps:

1. It tags the release `vX.Y.Z` and creates the GitHub Release with the changelog.
2. It builds the package and publishes it to npm with trusted publishing. No npm token is stored, and npm adds provenance.
3. It moves the branch `stable` to the release tag. The push cannot force, so `stable` only moves forward.

The workflow runs no tests, because the pre-push hook runs them before each push. Before 1.0.0, `feat:` gives a minor version and `fix:` gives a patch version.

## Libraries

- `typescript`: the type check and the build.
- `@types/node`: the types of the `node:` modules, at the oldest Node that the package supports (22).
- `@types/bun`: the types of `bun:test`.
- `fast-check`: the property test of the round-trip laws on random tables. It is the established property test library for TypeScript.
- `esbuild` (exact version): builds the single IIFE file of the markdown-it plugin. With the platform `neutral`, it fails on each `node:` import, so the build checks that the plugin runs with no Node.
- `markdown-it` (exactly 15.0.1, the version that Discourse pins): the only Markdown parser (spec principle 4). It finds the code blocks and the GFM tables and splits each GFM row, as the target renderer of each flavor does. It ships its own types. The type declarations of `tbl-md` do not use them. Only the declarations of `tbl-md/markdown-it` use them.

## Research

The format comes from a survey of readable table formats. No established format had a header record with short keys and a maintained TypeScript parser.

## License

MIT, see `LICENSE`.
