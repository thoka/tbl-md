# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 11.

State: steps 0 to 11 are done. The user merged release PR #2, so `tbl-md@0.1.1` is the latest release. Step 11 wrote the attribute rules into `docs/format.md` (rules 13 to 16: the three places, the separator line, the escape, the grammar, the known key `align`, and the errors), the canonical form and the conversion rules for `align` and `--drop-attributes`, and the README section How to write a table. The research is `docs/research/attribute-block.md`. The review-queue entry of step 11 decides the five open points of the research and the findings of a review subagent. The code still follows 0.1, and `docs/format.md` says so in its status line.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. Remove the line when the user allows it, so that `handover check` checks the push again.

Next step: step 12, parse and render attributes. Plan it first from rules 4, 6, 7, 10, and 13 to 16 of `docs/format.md` and the canonical form: the data model of the attributes (a list of classes and a list of pairs, in source order), the API change of `parse` and `render` (the row `id` becomes part of the row attributes, so plan how the 0.1 field `id` stays or changes, and note it as breaking in the changelog), and a test for each error of rule 16. Then a subagent implements it in `.worktrees/12-attributes` on `feature/12-attributes`. The conversion (step 13) is not part of step 12.

Open tasks of the user: none.

New context: yes. Step 12 is code with a new topic, and this context holds the research and the review of step 11.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error.
- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
