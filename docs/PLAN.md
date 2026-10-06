# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 14.

State: steps 0 to 14 are done and merged into `main`. release-please opened the release PR #3 (`chore(main): release 0.2.0`). Its changelog names the breaking change of `Row.id` and the three kinds of 0.1 text that change their meaning, so step 15 needs no more work from an agent. The old user step `tbl-md-publish` is closed (`docs/review-queue.md`).

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. If the user allows it, remove the line, so that `handover check` checks the push again.

Next step: step 15. The user merges the release PR #3 (https://github.com/thoka/tbl-md/pull/3). After the release, tell the markgraf session by an outbox task that 0.2.0 exists, and that its hook can run `tbl-md lint --max-warnings 0`.

Open tasks of the user: merge the release PR #3.

New context: yes. Steps 12 to 14 are in this context, and the next step after the release has a new topic.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
