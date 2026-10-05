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

1. Lossless. A round trip from `tbl` to GFM and back gives the same titles, cells, and row IDs. A GFM table has no keys, so the keys come back from the titles. A round trip from GFM to `tbl` and back gives the same canonical GFM text. A conversion never drops content silently.
2. Canonical. Each table has one canonical `tbl` text. The parse accepts more forms (prefix keys, any key order), and the render writes one.
3. Precise errors. Each error names the file, the line, and, where it helps, the column and the possible keys.
4. Small surface. The library has no runtime dependency outside the mdast and micromark family. The library and the CLI run on Node and on Bun.
5. Established parsers for Markdown. `mdast-util-from-markdown` with the GFM table extension finds the code blocks and the GFM tables. tbl-md parses only the text inside a `tbl` block.

## Out of scope for 0.1.0

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- A command that rewrites each `tbl` block in its canonical form.
- GFM column alignment.

## Name

The name `tbl-md` was free on npm and on GitHub on 2026-10-05. A `tbl` block is unrelated to the troff preprocessor `tbl` and to the `tbl-` cell options of Quarto.
