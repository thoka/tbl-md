# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-05, background session `tbl-md` in `~/dv/tbl-md`.

State: steps 0 to 4 are done and merged into `main` (176 tests, green). `parse`, `render`, `findTables`, `lint`, `toGfm`, `fromGfm`, and `keysFromTitles` exist. No file conversion or CLI exists yet. The repository has no remote, so `.handover.toml` has `local_only = true`.

Next step: step 5, convert a file. Plan and review it first, then a subagent implements it in `.worktrees/5-convert` on `feature/5-convert`.

Open tasks of the user: none. The outward step (GitHub repository and npm) goes to the user as one brief after step 8.

New context: no. The context is short, and step 5 has the same topic.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

- Step 5: convert a file. `convert(source, { to: "tbl" | "gfm" })` in `src/convert.ts` replaces only the byte ranges of the tables. Each other byte stays the same. A table in a list item or a block quote keeps the line prefix of its first line, and the line end of the file stays. If one table fails, the file does not change, and the result lists the errors. Tests cover each case of step 3.
- Step 6: CLI. `src/cli.ts` with `tbl-md convert [--to gfm] <files>` and `tbl-md lint <files>`. A message has the form `file:line:column: message`. Exit code 0 means no problem, 1 means a problem, and 2 means a usage error. The CLI uses only `node:` modules, no Bun API. The pre-commit hook of this project runs `tbl-md lint` on the staged Markdown files, and the setup test `test/docs.test.ts` goes, because the lint replaces it. The README gets a section CLI.
- Step 7: package. A build writes ESM JavaScript and type declarations to `dist/`, and `package.json` gets `exports`, `bin`, `files`, `engines`, and `repository`. Node joins `mise.toml`. A test packs the package with `npm pack`, installs the tarball in a temp folder, and runs the CLI and an import with Node. The README gets the install line and the public usage.
- Step 8: release research and the brief. The research agent finds the current best practice for release-please with an npm publish from GitHub Actions (trusted publishing with OIDC, provenance), and writes `docs/research/npm-release.md`. Then the session writes the workflow files and one brief for the user: create the GitHub repository `tbl-md`, add the remote, connect npm trusted publishing, and merge the first release PR. This is the outward step, and the user does it.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
