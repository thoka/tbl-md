# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session `tbl-md-2f` in `~/dv/tbl-md`.

State: steps 0 to 8 are done. `tbl-md@0.1.0` is on npm with provenance (SLSA v1), published by the release workflow through trusted publishing. The tag `v0.1.0` exists, and `stable` points to it. The placeholder `0.0.0` stays without a deprecation (`docs/review-queue.md`). After the release, the package test failed, because it expected the version `0.0.0`. It now reads the version from `package.json`. The README of the 0.1.0 tarball still says that the package is not published (found by `markgraf-02`). `main` has the fix, and the next release ships it. The markgraf session `markgraf-02` got the notice that Markgraf steps 6a and 6b can start.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. Remove the line when the user allows it, so that `handover check` checks the push again.

Next step: step 10b. Steps 9, 9b, 9c, and 10 are done. Step 10: `mise run corpus` tests 142 documents with tables from 17 sources (69 files, 1.6 MB, cached): 106 same, 15 errors by the format, 21 alignment only, 0 different. A check with the old code of step 9b gave 3 differences, so the test can fail. Step 9c drops an excess GFM cell with no text (`fix:`, so it goes into 0.1.1). Step 9b fixed the last pipe of a row in `cellSource` of `src/gfm.ts`, with 12 regression tests, and release-please makes 0.1.1 with it. Step 9: `docs/research/table-corpus.md` recommends 30 pinned sources (about 1.6 MB) from raw.githubusercontent.com with SHA-256 pins, and a small own downloader, because no tool fits. Then step 11.

Open tasks of the user: none.

New context: no. The design talk of 0.2.0 is in this context, and step 9 runs.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 10b: count each table in the corpus. A conversion error in one table must not hide the other tables of the same document (`docs/review-queue.md`, 2026-10-06, step 10). The corpus run counts same, error, alignment, and different for each table. No change of the library API, unless the main thread agrees.
- Step 11: format rules for attributes. `docs/format.md` gets the rules of the spec section Scope of version 0.2.0: the attribute block, its three places, the escape, the canonical form, and the errors. The README sections Why, How to write a table, and Next exist since 2026-10-06. The step adds the attributes to How to write a table. Plan and review only, no code.
- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error.
- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the change of the cell attributes. The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
