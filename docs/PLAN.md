# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session `tbl-md-2f` in `~/dv/tbl-md`.

State: steps 0 to 8 are done. `tbl-md@0.1.0` is on npm with provenance (SLSA v1), published by the release workflow through trusted publishing. The tag `v0.1.0` exists, and `stable` points to it. The placeholder `0.0.0` stays without a deprecation (`docs/review-queue.md`). After the release, the package test failed, because it expected the version `0.0.0`. It now reads the version from `package.json`. The README of the 0.1.0 tarball still says that the package is not published (found by `markgraf-02`). `main` has the fix, and the next release ships it. The markgraf session `markgraf-02` got the notice that Markgraf steps 6a and 6b can start.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. Remove the line when the user allows it, so that `handover check` checks the push again.

Next step: none is open in this plan. Pick one item of the section Later, plan it, and review it before you write code. The first candidate is `tbl-md fmt <files>`, because Markgraf can use it in its hook.

Open tasks of the user: none.

New context: yes. The release topic is finished, and the next step has a new topic.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

- None. Pick the next step from the section Later.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
