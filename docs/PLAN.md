# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-05, background session `tbl-md` in `~/dv/tbl-md`.

State: steps 0 to 7 are done and merged into `main` (259 tests, green). The package builds to `dist/`, and a test packs it, installs it, and runs it on Node 24, Node 22, and Bun. The research of step 8 runs in `.worktrees/8-research` (`docs/research/npm-release.md`). Nothing is published. The repository has no remote, so `.handover.toml` has `local_only = true`.

Next step: step 8: review the research report, merge it, write the release workflow and the config files by its proposal, and send the user one brief for the outward step.

Open tasks of the user: none. The outward step (GitHub repository and npm) goes to the user as one brief after step 8.

New context: no. The context is short, and step 8 builds on it.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

- Step 8: release research and the brief. The research agent finds the current best practice for release-please with an npm publish from GitHub Actions (trusted publishing with OIDC, provenance), and writes `docs/research/npm-release.md`. Then the session writes the workflow files and one brief for the user: create the GitHub repository `tbl-md`, add the remote, connect npm trusted publishing, and merge the first release PR. This is the outward step, and the user does it.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
