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

Work in progress. No code exists yet, and the package is not on npm. The plan is in `docs/PLAN.md`.

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

## Research

The format comes from the research `~/dv/markgraf/docs/research/readable-table-syntax.md` in the Markgraf project. No established format had a header record with short keys and a maintained TypeScript parser.

## License

MIT, see `LICENSE`.
