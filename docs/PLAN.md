# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 13.

State: steps 0 to 13 are done and merged into `main`. The parser, the renderer, and the conversion follow version 0.2.0 of `docs/format.md`. The corpus baseline is 586 tables, 564 same, 22 errors, 0 different. `docs/HISTORY.md` holds the plans of steps 12 and 13.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. If the user allows it, remove the line, so that `handover check` checks the push again.

Next step: step 14, lint of unknown attribute keys. First give the research agent the question where a Markdown lint keeps the configuration of a project (for example `package.json`, a dotfile, or the configuration of markdownlint or remark-lint), and write the report into `docs/research/`. Then decide the place by the canon, write it into `docs/review-queue.md`, plan the step, and let a subagent implement it in `.worktrees/14-lint-keys`.

Open tasks of the user: none.

New context: yes. Step 14 has a new topic, and this context holds the reviews of steps 12 and 13.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
