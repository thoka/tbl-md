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
