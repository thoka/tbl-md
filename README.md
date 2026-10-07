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

tbl-md has one goal: humans change tables in Markdown with no frustration. A machine reads any form, so each rule of the format serves the human who edits the text.

The switch is reversible. `tbl-md convert --to gfm` converts each `tbl` block back to a GFM table, and the file then renders the same. A corpus of real tables from other projects tests the round trip.

The format comes from a survey of readable table formats. No established format had a header record with short keys and a maintained TypeScript parser. A `tbl` block is unrelated to the troff preprocessor `tbl` and to the `tbl-` cell options of Quarto.

## Install

```sh
npm install tbl-md
```

Or run the CLI with no install:

```sh
npx tbl-md lint README.md
bunx tbl-md lint README.md
```

The package is ESM only. It needs Node 22 or later, or Bun. It has type declarations for TypeScript.

## Use

### CLI

`tbl-md lint` fails on a GFM pipe table and on an invalid `tbl` block. It names the file and the line of each problem:

```text
docs/a.md:12:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)
1 error and 0 warnings.
```

`tbl-md convert` converts the GFM tables of each file to `tbl` blocks, in place. With `--to gfm`, it converts back:

```sh
tbl-md convert docs/*.md
tbl-md convert --to gfm docs/*.md
```

The options, the configuration file `.tbl-md.json`, and a pre-commit hook are in [docs/cli.md](docs/cli.md).

### Library

```ts
import { convert, lint, parse, render } from "tbl-md";

const result = convert("| A |\n| --- |\n| x |\n", { to: "tbl" });
if (result.ok) console.log(result.output);
```

The library can also parse a `tbl` block, render its canonical form, and lint a Markdown text. Each export is in [docs/api.md](docs/api.md).

### markdown-it plugin

The plugin renders each `tbl` block as an HTML table, in each host that uses markdown-it, such as Discourse:

```ts
import markdownit from "markdown-it";
import tblPlugin from "tbl-md/markdown-it";

const md = markdownit().use(tblPlugin);
```

The attribute mapping, the hook `attributes`, and the single script file for hosts with no ES modules are in [docs/markdown-it.md](docs/markdown-it.md).

## How to write a table

- The first record is the header. Each line is `key: Title`. A key has lower-case letters, digits, `_`, and `-`. The order of the lines is the column order.
- A line `--` starts the next row.
- In a row, a line `key: text` starts a cell. A key can be any unique prefix of a header key, so `m:` is enough for `model:`. A missing key is an empty cell.
- Each other line continues the cell above, so a cell can have many lines.
- Cell text is inline Markdown, as in a GFM cell. A pipe needs no escape. If a text line looks like a key line or like `--`, add one backslash: `hint\: text`.
- An attribute block on its own line describes a column, a row, or a cell, for example `{align=right}` after a header key line. The syntax is the one of Pandoc and djot: `#id`, `.class`, and `key=value`.

`tbl-md lint` names the line of each error. [docs/format.md](docs/format.md) has the full rules.

## Documentation

- [docs/format.md](docs/format.md): the `tbl` format. It is the contract of the package.
- [docs/cli.md](docs/cli.md): the CLI, its configuration file, and the pre-commit hook.
- [docs/api.md](docs/api.md): the library API and the problem codes of the lint.
- [docs/markdown-it.md](docs/markdown-it.md): the markdown-it plugin.
- [docs/known-gaps.md](docs/known-gaps.md): the known gaps.
- [docs/spec.md](docs/spec.md): the goal, the principles, and the decisions of each version.
- [skills/tbl-md/SKILL.md](skills/tbl-md/SKILL.md): an Agent Skill that tells a coding agent to write each table as a `tbl` block. Copy or link the folder `skills/tbl-md` into the skills folder of your agent, for example `~/.claude/skills/`.
- [CHANGELOG.md](CHANGELOG.md): the changes of each release.
- [CONTRIBUTING.md](CONTRIBUTING.md): development, the corpus test, and the release.

The package holds the user docs and the skill too, in `node_modules/tbl-md/docs/` and `node_modules/tbl-md/skills/`.

## Status and license

Work in progress. The library, the markdown-it plugin, and the CLI exist. The package is on npm as `tbl-md`, with provenance. Before 1.0.0, a breaking change of the format gives a new minor version. [docs/known-gaps.md](docs/known-gaps.md) lists what does not work yet.

The license is MIT, see [LICENSE](LICENSE).
