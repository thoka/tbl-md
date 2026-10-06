# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

Next step: 17b. `docs/format.md` follows the spec of 0.3.0.
Waits for: nothing
New context: no. Step 17b builds directly on the report of step 16 and the spec text of step 17.

2026-10-06, interactive session in `~/dv/tbl-md`, after step 17.

State: the spec has the new principles 1, 4, and 5 with flavors (default `discourse`) and the section "Scope of version 0.3.0", approved by the user in a grilling round. The product docs name no local path and no private project, and `test/public.test.ts` checks the paths. The outbox holds the rule and the task for private planning repositories. Step 17c waits for meta.

Open tasks of the user: none.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Goal of the Discourse work

The user decided this in the grilling interview of 2026-10-06. The far goal: the own Discourse forums of the user use `tbl` as if it were native, also in the new rich text editor. The decisions:

1. The plugin is first for the own self-hosted forums of the user. A publication on meta.discourse.org can come later.
2. In a post, a reader sees a `tbl` block as a table. This comes first. Help in the composer comes later.
3. Old posts keep their GFM tables. A writer can use `tbl` in new posts. The composer can offer a conversion of GFM tables.
4. markdown-it is the root of tbl-md (user: "it should be root. i stated the need to be discourse compatible from the beginning"). markdown-it replaces micromark as the only parser in tbl-md. The reference for "renders the same" is markdown-it with the settings of Discourse, pinned to a Discourse version.
5. The generic markdown-it plugin lives in `tbl-md`. The Discourse plugin gets its own repository, for example `discourse-tbl`, which the supervisor creates. It bundles `tbl-md`.
6. It is a Discourse plugin, not a theme component, because only a plugin changes the rendering on the server (emails, search, excerpts). The forums are self-hosted, so a plugin is possible.
7. The rich text editor saves each table as `tbl` when someone saves a post from it, also an untouched GFM table. The plugin uses `registerRichEditorExtension`, although Discourse marks it as EXPERIMENTAL. An automatic test edits a table in the rich text editor and makes sure that the saved Markdown is `tbl`.
8. The tests run automatically against a new Discourse development instance (`discourse/discourse_dev`), not against a real forum. The user joins the group `docker` for this (outbox task to arch-helper). The base is the development container of `~/dv/discourse/discourse-provide-full-name-in-mentions/.devcontainer/devcontainer.json`. w2d has only manual steps (`~/dv/w2d.new/w2d/.skills/discourse-plugin/SKILL.md:88-131`), with lessons at lines 116-131 and 161-170.

## Open steps

- Step 17b: `docs/format.md` follows the spec of 0.3.0. It defines the flavors `discourse` and `markdown-it`: the markdown-it version, the settings, and the pinned Discourse commit, with no local path. It gives the new pipe rule, the trim of each Unicode space at the edges of a cell, the read-back check after each conversion, and the link pipe rule of `discourse`. It replaces the section "How micromark splits a GFM row" with the measurement of markdown-it, and measures the section "Where a new GFM table can stand" again with markdown-it. An entry in `docs/review-queue.md`. The rules apply from 0.3.0; the code follows in step 18. No change of `src/`.
- Step 17c: the planning files leave the public repository. `docs/PLAN.md`, `docs/HISTORY.md`, `docs/review-queue.md`, `docs/research/`, and `docs/outbox/` move to the private repository `thoka/tbl-md-plan`, cloned into the git-ignored folder `.plan/`. Waits for the outbox task `2026-10-06-task-plan-path-for-public-repos.md` in meta (plan path setting of `handover`, the outbox scan, and the creation of the repository). Then `AGENTS.md` and `test/public.test.ts` drop the exception for these files.
- Step 18: markdown-it as the only parser. `findTables`, `lint`, `fromGfm`, and the corpus test use markdown-it with the settings of Discourse. The mdast and micromark dependencies go.
- Step 19: the markdown-it plugin. A separate entry point, for example `tbl-md/markdown-it`, renders a `tbl` block as a table, with the attributes. It has its own tests and bundles to one file with no `node:` module.
- Step 20 and later, in the repository `discourse-tbl` (the supervisor creates it on an outbox task when step 19 is done): an automatic Discourse development instance in Docker; the server plugin with `discourse-markdown/*.js`, the allow list, and an email fallback; a composer item that converts a GFM table to `tbl`; the rich editor extension that saves each table as `tbl`.

## Later

- A remark plugin that shows a `tbl` block as a table in a preview.
- Remember the original form of an untouched GFM table in the rich text editor, if the user misses it (decision 7).
- A publication of the Discourse plugin on meta.discourse.org.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
