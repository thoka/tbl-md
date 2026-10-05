# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-05, background session `tbl-md` in `~/dv/tbl-md`.

State: steps 0 to 7 are done, and step 8 is done up to the user step. `main` has the library, the CLI, the package (259 tests, green), the research `docs/research/npm-release.md`, and the release workflow `.github/workflows/release.yml` with `release-please-config.json`. The repository has no remote yet, so `.handover.toml` has `local_only = true`. Nothing is published.

Waiting for the user: the script `~/inbox/tbl-md-publish.sh` creates the public repository `thoka/tbl-md`, pushes `main`, allows Actions to open PRs, publishes the npm placeholder `0.0.0`, and connects the trusted publisher. Its log is `~/.local/state/user-steps/tbl-md-publish.log`, and it notifies this session when it ends.

Next step: read the log. If it ended with exit 0, remove `local_only` from `.handover.toml`, push, and check with `gh pr list -R thoka/tbl-md` that release-please opened the release PR for 0.1.0. Then give the user one brief: merge that PR. After the release, check `npm view tbl-md version` and the provenance, and tell the markgraf session (Markgraf steps 6a and 6b wait for the release). If the log shows a failure, fix it with a new script file, not by a change of the old one.

Open tasks of the user: the script `~/inbox/tbl-md-publish.sh`.

New context: no. The next step needs the context of step 8.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

- Step 8: release research and the brief. The research agent finds the current best practice for release-please with an npm publish from GitHub Actions (trusted publishing with OIDC, provenance), and writes `docs/research/npm-release.md`. Then the session writes the workflow files and one brief for the user: create the GitHub repository `tbl-md`, add the remote, connect npm trusted publishing, and merge the first release PR. This is the outward step, and the user does it.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
