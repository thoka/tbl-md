# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session `tbl-md-2f` in `~/dv/tbl-md`.

State: steps 0 to 8 are done. `tbl-md@0.1.0` is on npm with provenance (SLSA v1), published by the release workflow through trusted publishing. The tag `v0.1.0` exists, and `stable` points to it. The placeholder `0.0.0` stays without a deprecation (`docs/review-queue.md`). After the release, the package test failed, because it expected the version `0.0.0`. It now reads the version from `package.json`. The README of the 0.1.0 tarball still says that the package is not published (found by `markgraf-02`). `main` has the fix, and the next release ships it. The markgraf session `markgraf-02` got the notice that Markgraf steps 6a and 6b can start.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. Remove the line when the user allows it, so that `handover check` checks the push again.

Next step: step 11, the format rules for attributes. Steps 9 to 10b are done. `mise run corpus` now counts each table: 586 tables in 142 documents from 17 sources, 445 same, 22 errors by the format (19 excess cells with text, 3 cells that end with `<br>`), 119 alignment only, 0 different. With the old code of step 9b, it reports more than 6 differences, so the test can fail. Step 11 writes the rules of the spec section Scope of version 0.2.0 into `docs/format.md` and the README section How to write a table, with an entry in `docs/review-queue.md`. It is plan and review only, no code. Open details for step 11: the exact grammar of the attribute block (quoted values, allowed key characters), the canonical order of `#id`, `.class`, and `key=value`, and the errors.

Release PR #2 (0.1.1) holds the fixes of steps 9b and 9c. The user merges it when they want.

Open tasks of the user: none.

New context: yes. The context is long, and step 11 has a new topic: the grammar of the attribute block. The decisions of the user are in the spec, so a new session can start from the files.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 11: format rules for attributes. `docs/format.md` gets the rules of the spec section Scope of version 0.2.0: the attribute block, its three places, the escape, the canonical form, and the errors. The README sections Why, How to write a table, and Next exist since 2026-10-06. The step adds the attributes to How to write a table. Plan and review only, no code.
- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error.
- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the change of the cell attributes. The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
