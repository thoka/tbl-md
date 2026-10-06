# tbl-md: the specification

## Goal

The recurring problem: a Markdown table is hard to read and to edit as plain text, and agents and humans read Markdown mostly as plain text. The user said: "i hate markdown tables". The first case is the table views of Markgraf (`~/dv/markgraf`), and the global rule of the user now says that all projects write tables as `tbl` blocks.

tbl-md gives a table format that is easy to read as text, with tools that make it safe to use everywhere:

- a format specification, `docs/format.md`,
- a TypeScript library that parses a `tbl` block, renders its canonical form, and converts it to and from a GFM pipe table with no loss of content,
- a CLI with `tbl-md convert` and `tbl-md lint`, for the pre-commit hooks of all projects.

tbl-md is a public open source project: an npm package and a GitHub repository with the MIT license. The user decided this on 2026-10-05.

## Users

- Agents and humans that write and read Markdown files as text.
- Markgraf, which renders and parses its table views with the library.
- The pre-commit hooks of the projects of the user, which run `tbl-md lint`.

## Scope of version 0.1.0

```tbl
part: Part
what: What it does
--
part: parse
what: A `tbl` block to a table, or a list of errors, each with its line.
--
part: render
what: A table to its canonical `tbl` block. A parse followed by a render gives the same text.
--
part: convert
what: A GFM pipe table to a `tbl` block and back, with no loss of content. A conversion that would lose content fails with an error at the line.
--
part: tbl-md convert
what: Converts the GFM tables in files in place, or with `--to gfm` the `tbl` blocks to GFM tables. Each other byte of the file stays the same.
--
part: tbl-md lint
what: Fails on a GFM pipe table and on an invalid `tbl` block. Each error names the file and the line.
```

## Principles

0. Human editing first. The goal of the project is that humans change tables in Markdown with no frustration. For a machine, the form of a table does not matter. If a rule makes the text easier for a human to read or change, it wins over a rule that only makes parsing easier. The user stated this on 2026-10-06.
1. Lossless. A round trip from `tbl` to GFM and back gives the same titles, cells, and row IDs. A GFM table has no keys, so the keys come back from the titles. A round trip from GFM to `tbl` and back gives the same canonical GFM text. A conversion never drops content silently. Reversible: a switch to tbl-md must be reversible. A conversion of a file to `tbl` and back to GFM gives a file that renders the same, so its mdast is the same, with no positions. Layout of the GFM text, such as padding and column widths, can change. A corpus of real tables from other projects tests this (section Scope of version 0.2.0). The user decided this on 2026-10-06.
2. Canonical. Each table has one canonical `tbl` text. The parse accepts more forms (prefix keys, any key order), and the render writes one.
3. Precise errors. Each error names the file, the line, and, where it helps, the column and the possible keys.
4. Small surface. The library has no runtime dependency outside the mdast and micromark family. The library and the CLI run on Node and on Bun.
5. Established parsers for Markdown. `mdast-util-from-markdown` with the GFM table extension finds the code blocks and the GFM tables. tbl-md parses only the text inside a `tbl` block.

## Scope of version 0.2.0

The user decided this scope on 2026-10-06.

- Attributes. An attribute follows the thing that it describes. An attribute line `{...}` directly after a header key line describes the column. An attribute line directly after the last line of a cell describes the cell. The `--` line that starts a row takes the attribute block of the row, and the row ID marker `{#id}` becomes a special case of it. One attribute line per column or cell at most. The syntax is the attribute block of Pandoc, djot, and kramdown: `#id`, `.class`, and `key=value`.
- An open vocabulary. The parser keeps each attribute. It checks only the values of the known keys. The first known key is `align` with `left`, `center`, or `right`, and it maps to the GFM column alignment. The lint warns on an unknown key, unless the configuration of the project lists that key.
- Escape. A text line that reads as an attribute line gets one backslash more, by the rule of the other escapes: `\{.x}` is the text `{.x}`.
- Conversion to GFM. An attribute that GFM cannot express makes the conversion fail, unless the user gives `--drop-attributes`.
- A round trip from GFM to `tbl` and back keeps the column alignment. A GFM cell that ends with `<br>` and a space before an ID marker stay errors. Escapes for them are a later option, for example when Markgraf shows highlighted cells.
- A corpus test for the reversibility of principle 1. A downloader fetches real Markdown files with tables, and the test fixtures of established Markdown parsers, from a configuration file. The configuration pins each source to a commit and names each file, and the downloader fetches only these files, with a size cap, into a cache outside the repository. It needs no token. The corpus is not part of the repository. `mise run corpus` runs the test, and the pre-push hook does not.

A cell attribute changes the content of a valid 0.1 block, because a line `{...}` after a cell was text. Thus 0.2.0 is a breaking version. On 2026-10-06, no `tbl` block in the 20 files with `tbl` blocks under `~/dv` had such a line.

## Out of scope

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- A command that rewrites each `tbl` block in its canonical form.
- Merged cells. A record maps keys to cells, so a cell that spans columns does not fit the model.

## Name

The name `tbl-md` was free on npm and on GitHub on 2026-10-05. A `tbl` block is unrelated to the troff preprocessor `tbl` and to the `tbl-` cell options of Quarto.
