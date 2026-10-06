# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session `tbl-md-2f` in `~/dv/tbl-md`.

State: steps 0 to 8 are done. `tbl-md@0.1.0` is on npm with provenance (SLSA v1), published by the release workflow through trusted publishing. The tag `v0.1.0` exists, and `stable` points to it. The placeholder `0.0.0` stays without a deprecation (`docs/review-queue.md`). After the release, the package test failed, because it expected the version `0.0.0`. It now reads the version from `package.json`. The README of the 0.1.0 tarball still says that the package is not published (found by `markgraf-02`). `main` has the fix, and the next release ships it. The markgraf session `markgraf-02` got the notice that Markgraf steps 6a and 6b can start.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. The auto mode classifier blocked its removal on 2026-10-06. Remove the line when the user allows it, so that `handover check` checks the push again.

Next step: step 9b. Step 9 is done: `docs/research/table-corpus.md` recommends 30 pinned sources (about 1.6 MB) from raw.githubusercontent.com with SHA-256 pins, and a small own downloader, because no tool fits. A coding subagent runs step 9b in `.worktrees/9b-last-pipe`. Review and merge it, then step 9c, then step 10.

Open tasks of the user: none.

New context: no. The design talk of 0.2.0 is in this context, and step 9 runs.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 9b: fix the last pipe of a row. If a GFM row has spaces or tabs after its last pipe, the conversion to tbl keeps that pipe in the last cell: `| x | y | ` gives the cell `y |`. This changes content with no error and breaks principle 1. Fix it with a hand-written regression test. A `fix:` commit, so that release-please makes 0.1.1 with it.
- Step 9c: an excess GFM cell with no text. The conversion to tbl drops it and does not fail (`docs/review-queue.md`, 2026-10-06, step 9). An excess cell with text stays an error. `docs/format.md` gets the rule.
- Step 10: corpus downloader and baseline. Follow the recommendation of `docs/research/table-corpus.md`. A configuration file lists each source with its repository, a pinned commit, and its files. The downloader fetches only these files, with a size cap per file and in total, into `~/.cache/tbl-md/corpus/`, and it never fetches a file twice. `mise run corpus` converts each file to `tbl` and back to GFM and compares the mdast with no positions, with short rows padded and excess cells removed. The first run measures the baseline of 0.1, so the known loss of the column alignment shows up. Not in the pre-push hook.
- Step 11: format rules for attributes. `docs/format.md` gets the rules of the spec section Scope of version 0.2.0: the attribute block, its three places, the escape, the canonical form, and the errors. The README sections Why, How to write a table, and Next exist since 2026-10-06. The step adds the attributes to How to write a table. Plan and review only, no code.
- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error.
- Step 13: attributes in the conversion. `align` maps to the GFM alignment in both directions. Any other attribute makes the conversion to GFM fail, unless `--drop-attributes` is given. The corpus test of step 10 then passes for the alignment.
- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the change of the cell attributes. The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
