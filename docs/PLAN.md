# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

Next step: none. Steps 0 to 15 are done. The next work is in the section Later, and the user picks it.
Waits for: user (the choice of the next step from the section Later)
New context: yes. The release ends the goal of 0.2.0, and the next step has a new topic.

2026-10-06, interactive session in `~/dv/tbl-md`, after step 15.

State: tbl-md 0.2.0 is on npm (tag `v0.2.0`, release workflow run 37429065614 passed). The outbox task `docs/outbox/2026-10-06-task-markgraf-tbl-md-0-2-0.md` asks the supervisor to tell the markgraf session that 0.2.0 exists and that its hook can run `tbl-md lint --max-warnings 0`. `.handover.toml` is removed, so `handover check` checks the push again (`docs/review-queue.md`).

No step is planned. The user picks one item of the section Later, for example `tbl-md fmt` or the preview plugins, and the session then plans it as step 16.

Open tasks of the user: pick the next step from the section Later.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

None. The goal of 0.2.0 is reached.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
