# Library API

This file describes each export of the library `tbl-md`. The README has a short example.

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
c: `no-header`
w: The block is empty, or it starts with `--`.
--
c: `header-not-key`
w: A header line is no key line. This includes an empty line and an escaped line inside the header.
--
c: `header-duplicate-key`
w: The header has the same key two times.
--
c: `unknown-key`
w: A key in a data record matches no header key. The message lists the header keys.
--
c: `ambiguous-key`
w: A key is a prefix of more than one header key. The message lists these keys.
--
c: `duplicate-key`
w: A record has the same key two times, also as two different prefixes of one key.
--
c: `orphan-line`
w: A line comes before the first key line of a data record.
--
c: `attr-unexpected-char`
w: An attribute block has an unexpected character, for example `{.hl !}`.
--
c: `attr-no-space`
w: Two parts of an attribute block have no space between them, for example `{#a.b}`.
--
c: `attr-empty`
w: An attribute block is empty: `{}` or `{ }`.
--
c: `attr-bad-id`
w: An ID is empty or has a bad character, for example `{#}` or `{#a:b}`.
--
c: `attr-bad-class`
w: A class is empty, has no letter first, or has a bad character, for example `{.}` or `{.1a}`.
--
c: `attr-bad-key`
w: A key has no letter first or has a bad character, for example `{1k=v}`.
--
c: `attr-duplicate-id`
w: A block has more than one ID.
--
c: `attr-duplicate-class`
w: A block has the same class two times.
--
c: `attr-duplicate-key`
w: A block has the same key two times.
--
c: `attr-reserved-key`
w: A block has the key `id` or `class`. The message names `#x` or `.x`.
--
c: `attr-no-value`
w: A key has no value, for example `{k}` or `{k=}`.
--
c: `attr-bad-bare-value`
w: A value with no quotes has a character other than `[A-Za-z0-9_:-]`. The message shows the value in quotes.
--
c: `attr-single-quotes`
w: A value has single quotes. The message names double quotes.
--
c: `attr-unclosed-quote`
w: A quoted value has no closing quote.
--
c: `attr-bad-escape`
w: A quoted value has a backslash before a character other than `"` or `\`.
--
c: `attr-bad-value`
w: A known key has a bad value, for example `{align=middle}`. The message lists the values.
--
c: `attr-key-place`
w: A known key is at a place that does not allow it: `align` on a row or a cell.
--
c: `attr-second-line`
w: A column or a cell has a second attribute line.
--
c: `attr-misplaced`
w: A line in the attribute form is at a place that takes no attributes: before the first header key, after an empty line or a text line in the header, before the first key of a record (also directly after `--`), or in the middle of a cell.
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

`render(table)` writes the canonical text of a table, by the section Canonical form of `docs/format.md`. The header has the full keys, and the data records have the short keys. The text has the lines joined with `\n` and no final newline. `renderBlock(table)` writes the whole block: the opening fence with the info string `tbl`, the text, and the closing fence, also with no final newline. The fence has three backticks, or more if a line of the text would close it.

`shortKeys(columns)` maps each header key to its short key: the shortest prefix of the key that is the key itself, or that is a prefix of no other header key. For example, the keys `model` and `note` give `m` and `n`, and the keys `price` and `price-2` give `price` and `price-`.

```ts
import { parse, render, renderBlock, shortKeys } from "tbl-md";

render({ columns: [{ key: "model", title: "Model" }], rows: [{ cells: { model: "Opus\nb: y" } }] });
// "model: Model\n--\nm: Opus\nb\\: y"
renderBlock({ columns: [{ key: "a", title: "A" }], rows: [] });
// "```tbl\na: A\n```"
shortKeys([{ key: "error", title: "Error" }, { key: "example", title: "Example" }]);
// { error: "er", example: "ex" }
```

Two laws hold for each valid table `T`, and the property test `test/laws.test.ts` checks them on random tables:

- `parse(render(T))` gives `T` back.
- `render(parse(render(T)).table)` is `render(T)`.

`validate(table)` lists the problems that stop a render with no loss, as plain English messages. An empty list means that the table is valid. `render` and `renderBlock` throw an `Error` with the first problem. Columns and rows count from 1. These are the problems:

```tbl
problem: Problem
--
p: The table has no columns.
--
p: A column key does not have the form `[a-z0-9_-]+`.
--
p: Two columns have the same key.
--
p: A title has a line break or a CR.
--
p: A cell key is no column key.
--
p: An attribute block of a column, a row, or a cell is empty: no ID, no class, and no pair.
--
p: An ID does not have the form `[A-Za-z0-9_-]+`.
--
p: A class does not have the form `[A-Za-z][A-Za-z0-9_-]*`, or a block has the same class two times.
--
p: An attribute key does not have the form `[A-Za-z][A-Za-z0-9_-]*`, is `id` or `class`, or comes two times in a block.
--
p: An attribute value has a line break or a CR.
--
p: The value of `align` is not `left`, `center`, or `right`, or `align` is on a row or a cell.
--
p: `cellAttributes` has a key that is no column key.
--
p: A cell text ends with a line break.
--
p: A cell text has a CR.
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

The option `attributeKeys` is the list of the attribute keys of the project. A pair with a key that is not `align` and not in the list gives the warning `unknown-attribute-key`, in a column, a row, and a cell. With no list, each key other than `align` is unknown. The warning is at the key in the file. A block with an error gives only its errors and no warning. The library does not read a configuration file. The CLI reads `.tbl-md.json` (section Configuration of `docs/cli.md`) and gives its list and its flavor to `lint`.

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
c: `gfm-table`
w: The text has a GFM pipe table. The message tells the reader to write it as a `tbl` block.
--
c: `info-text`
w: The info string has text after `tbl` (rule 1 of `docs/format.md`). The problem is at the fence line.
--
c: each error code of `parse`
w: A `tbl` block has this error. The problem is at the line of the error in the file.
--
c: `unknown-attribute-key`
w: A warning. A pair of a valid `tbl` block has a key that is not `align` and not in `attributeKeys` (rule 15 of `docs/format.md`). The problem is at the key.
```

Each code other than `unknown-attribute-key` is an error.

`findConfig(folder)`, `readConfig(file)`, and `parseConfig(text, file)` are the loader of the configuration file that the CLI uses (section Configuration of `docs/cli.md`). `findConfig` gives the absolute path of the configuration file for a folder, or `null`. `readConfig` and `parseConfig` give `{ ok: true, config: { attributeKeys, flavor? } }`, where `flavor` is absent if the file has none, or `{ ok: false, error: { file, line?, message } }`. `CONFIG_FILE` is the name `.tbl-md.json`.

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
t: a line break
g: `<br>`
--
t: `<br>`, or `<br>` after backslashes
g: one backslash more: `\<br>`, `\\<br>`
--
t: `|`, also after backslashes
g: one backslash more: `|` becomes `\|`, and `\|` becomes `\\|`
--
t: the row ID `r1`
g: ` {#r1}` at the end of the first cell, or `{#r1}` in an empty first cell
--
t: a first cell with no ID that ends with `{#x}`, at the start or after a space
g: one backslash more before the `{`: `\{#x}`
--
t: `{align=left}`, `{align=center}`, or `{align=right}` of a column
g: `:---`, `:---:`, or `---:` in the delimiter row. A column with no `align` is `---`.
```

A title keeps `<br>` as it is. `fromGfm` gives a column with an alignment the attributes `{ classes: [], pairs: [{ key: "align", value }] }`, and a column with no alignment gets no `attributes`. It gives a row with an ID the attributes `{ id, classes: [], pairs: [] }`. Each other attribute has no GFM form: a class or a pair of a row, any attribute of a cell, and any attribute of a column other than `align`. `toGfm` gives one error for each attribute block with such a part, unless `options.dropAttributes` is true. With `dropAttributes`, it keeps the `align` of the columns and the ID of the rows, and drops the rest with no error.

Both functions collect all errors. An error of `toGfm` has an optional `row` (from 1), an optional `key`, an optional `attribute`, and a `message`. An error of a title has no `row`. An error of an attribute block has `attribute`: `"column"` with the `key` of the column, `"row"` with the `row`, or `"cell"` with the `row` and the `key`. An error of `fromGfm` has the `line` and the `column` of the cell in the source, and a `message`. These are the errors:

```tbl
fn: Function
when: When
--
f: `toGfm`
w: `validate` finds a problem. The error has only the message of `validate`.
--
f: `toGfm`
w: A title or a cell starts or ends with a space, a tab, or another character that markdown-it trims, such as a no-break space (U+00A0). GFM removes it.
--
f: `toGfm`
w: A cell line ends with a backslash and has a next line. The backslash would escape the `<br>` of the line break.
--
f: `toGfm`
w: An attribute block has a part with no GFM form, and `dropAttributes` is not true. The message names the parts and the two fixes: remove them, or convert with `--drop-attributes`.
--
f: `fromGfm`
w: A cell ends with `<br>`. A tbl cell never ends with a line break.
--
f: `fromGfm`
w: A row has an excess cell with text, after the last column of the header. GFM drops it. The error names the first such cell of the row. An excess cell with no text, or with only spaces and tabs, is dropped with no error.
--
f: `fromGfm`
w: The text before the ID marker of a first cell ends with a space or a tab. The cell could not convert back.
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

