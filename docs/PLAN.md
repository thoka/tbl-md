# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-05, background session `tbl-md` in `~/dv/tbl-md` (first session, started by the markgraf session).

State: step 0 is done. The project has its rules, its goal, the format specification with the review of its details (`docs/review-queue.md`), the plan, and the stack (Bun, mise, lefthook, `mise run test`). No code exists yet. The repository has no remote, so `.handover.toml` has `local_only = true`.

Next step: step 1, the parser. Plan and review it first, as the step text below says, then implement it in `feature/1-parse`.

Open tasks of the user: none. The outward step (GitHub repository and npm) goes to the user as one brief after step 8.

New context: no. The context is short, and step 1 has the same topic.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. It merges into `main` when `mise run test` passes. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

- Step 1: parse. `parse(text)` in `src/parse.ts` reads the lines inside a `tbl` fence and gives a table (`columns` with key and title, `rows` with an optional ID and the cells by key) or a list of errors, each with its line in the block. It covers rules 2 to 10 and 12 of `docs/format.md`. A test covers each rule and each error. The README gets a section Library with `parse`.
- Step 2: render. `render(table)` in `src/render.ts` writes the canonical form, with the escapes and the fence length. Tests: a parse followed by a render gives the same text for each canonical example, and a render followed by a parse gives the same table. A property test with `fast-check` (a new dev library, with its line in README Libraries) checks both laws on random tables, also with lines of the escape forms.
- Step 3: find blocks and lint. `src/markdown.ts` reads a Markdown file with `mdast-util-from-markdown` and the GFM table extension, and lists the `tbl` blocks and the GFM tables with their positions. `lint(source)` gives the problems: each GFM table, and each error of a `tbl` block at its line in the file. Tests cover a block in a list item, in a block quote, a tilde fence, a table in another code block (no problem), and CRLF.
- Step 4: convert one table. `toGfm(table)` and `fromGfm(source, node)` in `src/gfm.ts`, by the section "Conversion to and from GFM" of `docs/format.md`: the keys from the titles, `<br>`, pipes, the ID marker, the escape rule, and the errors for content that would get lost. The cell text in GFM comes from the source by position, not from the mdast nodes, so that the inline Markdown stays byte for byte. Tests: a round trip from tbl to GFM and back gives the same table, also in the property test. A second test parses the GFM cell and the tbl cell as inline Markdown and compares the mdast, so the meaning stays the same, except for the listed cases. A first measurement finds how micromark splits `\\|` in a cell, before the code fixes the pipe rule.
- Step 5: convert a file. `convert(source, { to: "tbl" | "gfm" })` in `src/convert.ts` replaces only the byte ranges of the tables. Each other byte stays the same. A table in a list item or a block quote keeps the line prefix of its first line, and the line end of the file stays. If one table fails, the file does not change, and the result lists the errors. Tests cover each case of step 3.
- Step 6: CLI. `src/cli.ts` with `tbl-md convert [--to gfm] <files>` and `tbl-md lint <files>`. A message has the form `file:line:column: message`. Exit code 0 means no problem, 1 means a problem, and 2 means a usage error. The CLI uses only `node:` modules, no Bun API. The pre-commit hook of this project runs `tbl-md lint` on the staged Markdown files, and the setup test `test/docs.test.ts` goes, because the lint replaces it. The README gets a section CLI.
- Step 7: package. A build writes ESM JavaScript and type declarations to `dist/`, and `package.json` gets `exports`, `bin`, `files`, `engines`, and `repository`. Node joins `mise.toml`. A test packs the package with `npm pack`, installs the tarball in a temp folder, and runs the CLI and an import with Node. The README gets the install line and the public usage.
- Step 8: release research and the brief. The research agent finds the current best practice for release-please with an npm publish from GitHub Actions (trusted publishing with OIDC, provenance), and writes `docs/research/npm-release.md`. Then the session writes the workflow files and one brief for the user: create the GitHub repository `tbl-md`, add the remote, connect npm trusted publishing, and merge the first release PR. This is the outward step, and the user does it.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.
