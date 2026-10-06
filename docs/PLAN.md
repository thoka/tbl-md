# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 12.

State: steps 0 to 12 are done. Step 12 is merged into `main` as `feat!:`. The parser and the renderer follow version 0.2.0 of `docs/format.md`. The conversion keeps only the row ID, and a conversion to GFM of a table with other attributes fails at the read-back check. `docs/HISTORY.md` holds the plan of step 12.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. If the user allows it, remove the line, so that `handover check` checks the push again.

Next step: step 13, attributes in the conversion. Plan it first from the section Conversion to and from GFM of `docs/format.md`: `align` to the GFM alignment and back in `toGfm` and `fromGfm`, the `--drop-attributes` option of `convert` and the CLI, an error at the line of each attribute with no GFM form (`locate` then needs the lines of the attribute lines), and a new corpus baseline with `mise run corpus`. Then a subagent implements it in `.worktrees/13-conversion` on `feature/13-conversion`.

Open tasks of the user: none.

New context: yes. Step 13 has a new topic, and this context holds the review of step 12.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.

## Plan of step 13

The rules are the section Conversion to and from GFM of `docs/format.md`, the two items on `align` and `--drop-attributes`. Branch `feature/13-conversion`, worktree `.worktrees/13-conversion`.

### Library (`src/gfm.ts`)

- `toGfm(table, options?)` takes `{ dropAttributes?: boolean }`. The delimiter row gets the mark of the `align` of each column: `:---`, `:---:`, `---:`, or `---` with no `align`.
- Without `dropAttributes`, `toGfm` gives one error for each attribute block that has a part with no GFM form: a column block with a part other than `align`, a row block with a class or a pair, and each cell block. The error names the part and the two fixes: remove it, or convert with `--drop-attributes`. `ConvertError` gets a field `attribute?: "column" | "row" | "cell"`, so that `convert` can find the line.
- With `dropAttributes`, `toGfm` keeps the `align` of the columns and the ID of the rows, and drops the rest with no error.
- `fromGfm` reads the alignment of the mdast table. A column with an alignment gets `attributes: { classes: [], pairs: [{ key: "align", value }] }`. A column with no alignment gets no `attributes`.

### Places of the errors (`src/parse.ts`, `src/convert.ts`)

- `locate` gives the line of each attribute line too: `headerAttributeLines` by column key, and `cellAttributeLines` by full header key in each row. The block of a row is on its `--` line, which `rows[i].line` gives already.
- `convert` maps an error with `attribute` to that line, at the column of the fence. A row error goes to the `--` line of the row.
- `ConvertOptions` gets `dropAttributes?: boolean`. The read-back check compares with the table that GFM can hold: the `align` of the columns, the ID of the rows, and no cell attributes.

### Command line (`src/cli.ts`)

- `tbl-md convert --to gfm --drop-attributes <files...>`. The option is a usage error with `lint` and with `--to tbl`. The usage text names it.

### Corpus (`corpus/`)

- The count `alignment` goes away, because the alignment now converts. A table that differs only in its alignment counts as `different`, so the run fails on it. Run `mise run corpus` and write the new baseline into the history of step 13. Expected: 0 different and 0 alignment.

### Tests and documentation

- Tests for each alignment in both directions, for each kind of attribute with no GFM form (with its file line through `convert` and the CLI), for `--drop-attributes`, and for the usage errors.
- The laws of the GFM conversion in `test/laws.test.ts` hold with a random `align`. A new law: with `dropAttributes`, a table with random attributes converts, and it reads back as its GFM view.
- `README.md`: `toGfm` options, `fromGfm` alignment, `ConvertError.attribute`, `locate`, `ConvertOptions`, and the CLI option. `docs/format.md`: the status line says that the conversion follows 0.2.0 too.
