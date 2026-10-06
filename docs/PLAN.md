# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 11.

State: steps 0 to 11 are done. The user merged release PR #2, so `tbl-md@0.1.1` is the latest release. Step 11 wrote the attribute rules into `docs/format.md` (rules 13 to 16), the canonical form and the conversion rules for `align` and `--drop-attributes`, and the README section How to write a table. The research is `docs/research/attribute-block.md`. The review-queue entry of step 11 decides the five open points of the research and the findings of a review subagent. The code still follows 0.1, and `docs/format.md` says so in its status line.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. If the user allows it, remove the line, so that `handover check` checks the push again.

Next step: step 12, parse and render attributes. The section Plan of step 12 has the plan. A subagent implements it in `.worktrees/12-attributes` on `feature/12-attributes`. The conversion (step 13) is not part of step 12.

Open tasks of the user: none.

New context: yes. Step 12 is code with a new topic, and this context holds the research and the review of step 11.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error. The plan of the step is in the section Plan of step 12.
- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.

## Plan of step 12

The rules are rules 4, 6, 7, 10, and 13 to 16 of `docs/format.md`, and its section Canonical form. Branch `feature/12-attributes`, worktree `.worktrees/12-attributes`.

### Data model

```ts
export interface Pair { key: string; value: string }
export interface Attributes { id?: string; classes: string[]; pairs: Pair[] }
export interface Column { key: string; title: string; attributes?: Attributes }
export interface Row {
  attributes?: Attributes;
  cells: Record<string, string>;
  /** The attributes of the cells, by the full header key. A cell can have attributes and no text. */
  cellAttributes?: Record<string, Attributes>;
}
```

- The parser sets `attributes` and `cellAttributes` only if the block has an attribute line or block for them. Thus a 0.1 table without row IDs gives the same objects as before.
- `classes` and `pairs` are always arrays, in source order.
- The field `Row.id` of 0.1 goes away. The row ID is `row.attributes.id`. This is a breaking change of the API, and the merge commit is `feat!:` with a `BREAKING CHANGE:` footer. No other project uses the API yet (measured on 2026-10-06 with a search under `~/dv`).

### Syntax (`src/syntax.ts`)

- The attribute form: `{` first, `}` as the last character other than a space or a tab.
- `separatorLine`: `--`, or `--`, spaces or tabs, and a rest in the attribute form. The rest is a group, also if it does not parse.
- The escaped forms of rule 10 get the attribute form and the new separator form. `escapeLine`, `unescapeLine`, and `isEscaped` cover all three forms.

### Attribute blocks (new `src/attributes.ts`)

- `parseAttributes(block)` reads one block by the grammar of rule 14. On an error, it gives the code, the message, and the 0-based offset of the first bad character. It stops at the first error.
- A check of the known keys by place (`column`, `row`, `cell`): a bad value of `align`, and `align` at a row or a cell. The error is at the value or at the key.
- `renderAttributes(attributes)` writes the canonical form: ID, classes, pairs, one space between them, a bare value where it can be bare, else double quotes with `\"` and `\\`.

### Error codes

One error per attribute line at most. A place error wins over a grammar error, because the parser does not read a block at a wrong place. An error of the block of a separator line has the code of the grammar error, at its column in the line.

```tbl
code: Code
error: Error of rule 16
--
code: `attr-unexpected-char`
error: an unexpected character
--
code: `attr-no-space`
error: no space between two parts
--
code: `attr-empty`
error: an empty block
--
code: `attr-bad-id`
error: an empty ID, or a bad character in an ID
--
code: `attr-bad-class`
error: an empty class, a class with no letter first, or a bad character
--
code: `attr-bad-key`
error: a key with no letter first, or with a bad character
--
code: `attr-duplicate-id`
error: more than one ID
--
code: `attr-duplicate-class`
error: a repeated class
--
code: `attr-duplicate-key`
error: a repeated key
--
code: `attr-reserved-key`
error: the key `id` or `class`
--
code: `attr-no-value`
error: a key with no value
--
code: `attr-bad-bare-value`
error: a bare value with a character outside `[A-Za-z0-9_:-]`
--
code: `attr-single-quotes`
error: single quotes
--
code: `attr-unclosed-quote`
error: a quoted value with no closing quote
--
code: `attr-bad-escape`
error: a backslash before a character other than `"` or `\`
--
code: `attr-bad-value`
error: a bad value of a known key
--
code: `attr-key-place`
error: a known key at a place that does not allow it
--
code: `attr-second-line`
error: a second attribute line for the same column or cell
--
code: `attr-misplaced`
error: a line in the attribute form at a place that takes no attributes
```

### Places in the parser (`src/parse.ts`)

- Header: a line in the attribute form directly after a key line describes that column. Directly after the attribute line of a column, it is `attr-second-line`. Each other attribute line in the header is `attr-misplaced`, also one before the first key or after an empty line. It is never `header-not-key`.
- Data record, before the first key line: an attribute line is `attr-misplaced`, not `orphan-line`.
- In a cell: the first attribute line that only empty lines and attribute lines follow describes the cell. Each later attribute line of the cell is `attr-second-line`. An attribute line that a text line follows is `attr-misplaced` (the middle of a cell). The cell text ends at its last text line before the attribute line, with the empty lines trimmed (rule 7).
- The block on a `--` line describes the row.
- `locate` must skip the attribute lines of the header. The lines of the attribute lines in `locate` come with step 13, which needs them for its errors.

### Renderer (`src/render.ts`)

- `validate` reports each attribute problem: an empty block (no ID, no class, no pair), a bad ID, class, or key, a repeated class or key, the key `id` or `class`, a value with a CR or an LF, a bad value or place of `align`, and `cellAttributes` with a key that no column has.
- `render` writes the canonical form: the column attribute line after its key line, the row block on `--`, the cell attribute line as the last line of the cell, and `key:` for a cell with attributes and no text.
- The two laws of `test/laws.test.ts` hold with random attributes too.

### GFM and conversion until step 13

- `gfm.ts` and `convert.ts` move from `row.id` to `row.attributes.id`, with no change of behavior.
- `sameTable` in `convert.ts` compares all attributes. Thus a conversion to GFM of a table with attributes other than a row ID fails at the read-back check and changes nothing, until step 13 maps them. A test shows it.
- The laws of the GFM conversion keep tables with no attributes other than a row ID.

### Tests and documentation

- A test for each error code above, with its line and its column, also in a separator line and in a file through `lint`.
- Tests for each place of rule 13, for empty lines before a cell attribute line, for a cell with attributes and no text, for an attribute block on a key line (it is text), and for each escape form of rule 10.
- The example of `docs/format.md` parses to the expected table.
- `README.md`: the data model, the error codes, the problems of `validate`, and the API example of `toGfm`. `docs/format.md`: the status line says that the parser and the renderer follow 0.2.0, and the conversion follows with step 13.
