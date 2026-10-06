# History

Finished steps of `docs/PLAN.md`, moved word for word, newest first.

## Step 9b: the last pipe of a row

- Step 9b: fix the last pipe of a row. If a GFM row has spaces or tabs after its last pipe, the conversion to tbl keeps that pipe in the last cell: `| x | y | ` gives the cell `y |`. This changes content with no error and breaks principle 1. Fix it with a hand-written regression test. A `fix:` commit, so that release-please makes 0.1.1 with it. Done on 2026-10-06. Status: root cause: micromark ends the last cell at the end of the line, so the spaces and tabs after the closing pipe belong to it, and `cellSource` looked for the pipe only at the very end. The fix removes them first. `docs/format.md` did not change, because the code now follows its rule.

## Step 9: corpus research

- Step 9: corpus research. The research agent finds existing corpora of Markdown tables, the test fixtures of established parsers (GFM spec, micromark, markdown-it, commonmark.js), sources of real files with tables, and the established ways to fetch single files from a pinned commit with no token. It writes `docs/research/table-corpus.md`. Done on 2026-10-06. Status: no ready-made corpus fits. The report recommends 30 sources with an open license, pinned by commit and SHA-256, and found the bug of step 9b and the excess cells of step 9c.

## Step 8: release

- Step 8: release research and the brief. The research agent finds the current best practice for release-please with an npm publish from GitHub Actions (trusted publishing with OIDC, provenance), and writes `docs/research/npm-release.md`. Then the session writes the workflow files and one brief for the user: create the GitHub repository `tbl-md`, add the remote, connect npm trusted publishing, and merge the first release PR. This is the outward step, and the user does it. Done on 2026-10-06. Status: the publish script `~/inbox/tbl-md-publish.sh` ran twice, and the second run created the repository, the placeholder `0.0.0`, the trusted publisher, and `mfa=publish`. Only `npm deprecate` failed. The user merged PR #1, and the workflow published `0.1.0` with provenance and moved `stable`.

## Step 7: package

- Step 7: package. A build writes ESM JavaScript and type declarations to `dist/`, and `package.json` gets `exports`, `bin`, `files`, `engines`, and `repository`. Node joins `mise.toml`. A test packs the package with `npm pack`, installs the tarball in a temp folder, and runs the CLI and an import with Node. The README gets the install line and the public usage. Done on 2026-10-05. Status: `tsconfig.build.json` (NodeNext, `rewriteRelativeImportExtensions`), a tarball of 25 kB with 22 files. The package test takes about 2.6 seconds, so `mise run test` includes it, and it needs the npm registry. `@types/mdast` is a runtime dependency, because the type declarations import it. ESM only.

## Step 6: CLI

- Step 6: CLI. `src/cli.ts` with `tbl-md convert [--to gfm] <files>` and `tbl-md lint <files>`. A message has the form `file:line:column: message`. Exit code 0 means no problem, 1 means a problem, and 2 means a usage error. The CLI uses only `node:` modules, no Bun API. The pre-commit hook of this project runs `tbl-md lint` on the staged Markdown files, and the setup test `test/docs.test.ts` goes, because the lint replaces it. The README gets a section CLI. Done on 2026-10-05. Status: `src/cli.ts` with `main(argv, io)`, `-` for stdin, BOM kept, all files read before any write. The pre-commit hook installs the dependencies and runs the lint. `test/docs.test.ts` now runs the library lint over the docs. Known gaps: the hook lints the working tree, not the staged text.

## Step 5: convert a file

- Step 5: convert a file. `convert(source, { to: "tbl" | "gfm" })` in `src/convert.ts` replaces only the byte ranges of the tables. Each other byte stays the same. A table in a list item or a block quote keeps the line prefix of its first line, and the line end of the file stays. If one table fails, the file does not change, and the result lists the errors. Tests cover each case of step 3. Done on 2026-10-05. Status: `convert` in `src/convert.ts` and `locate` in `src/parse.ts`. A self-check parses the output again, and a tbl block with a text line directly after it fails in the conversion to GFM, because GFM would read the line as a row. The property test embeds random tables in random frames. Four safety-net messages have no test (`docs/review-queue.md`).

## Step 4: convert one table

- Step 4: convert one table. `toGfm(table)` and `fromGfm(source, node)` in `src/gfm.ts`, by the section "Conversion to and from GFM" of `docs/format.md`: the keys from the titles, `<br>`, pipes, the ID marker, the escape rule, and the errors for content that would get lost. The cell text in GFM comes from the source by position, not from the mdast nodes, so that the inline Markdown stays byte for byte. Tests: a round trip from tbl to GFM and back gives the same table, also in the property test. A second test parses the GFM cell and the tbl cell as inline Markdown and compares the mdast, so the meaning stays the same, except for the listed cases. A first measurement finds how micromark splits `\\|` in a cell, before the code fixes the pipe rule. Done on 2026-10-05. Status: `src/gfm.ts`. The measurement of micromark is in `docs/format.md` ("How micromark splits a GFM row"). A pipe after an odd number of backslashes and a cell line that ends with a backslash before a line break fail in `toGfm` with an error, by one rule: one backslash more. The README section Known gaps lists the rest.

## Step 3: find blocks and lint

- Step 3: find blocks and lint. `src/markdown.ts` reads a Markdown file with `mdast-util-from-markdown` and the GFM table extension, and lists the `tbl` blocks and the GFM tables with their positions. `lint(source)` gives the problems: each GFM table, and each error of a `tbl` block at its line in the file. Tests cover a block in a list item, in a block quote, a tilde fence, a table in another code block (no problem), and CRLF. Done on 2026-10-05. Status: `findTables` in `src/markdown.ts` and `lint` in `src/lint.ts`, with the problem codes `gfm-table`, `info-text`, and the parse codes. Known gaps: an unclosed fence at the end of a file can give `no-header` one line after the last line, and tabs in a list indent are not tested.

## Step 2: render

- Step 2: render. `render(table)` in `src/render.ts` writes the canonical form, with the escapes and the fence length. Tests: a parse followed by a render gives the same text for each canonical example, and a render followed by a parse gives the same table. A property test with `fast-check` (a new dev library, with its line in README Libraries) checks both laws on random tables, also with lines of the escape forms. Done on 2026-10-05. Status: `render`, `renderBlock`, and `validate` in `src/render.ts`, `escapeLine` in `src/syntax.ts`. The property test runs 1000 random tables per law and found no counterexample. A lone CR is a line end, as in CommonMark, and a title or a cell holds no CR (`docs/review-queue.md`).

## Step 1: parse

- Step 1: parse. `parse(text)` in `src/parse.ts` reads the lines inside a `tbl` fence and gives a table (`columns` with key and title, `rows` with an optional ID and the cells by key) or a list of errors, each with its line in the block. It covers rules 2 to 10 and 12 of `docs/format.md`. A test covers each rule and each error. The README gets a section Library with `parse`. Done on 2026-10-05. Status: `parse` collects all errors with their line, and each rule and each error code has a test (41 tests). The README section Library lists `parse` and its error codes. Rule 7 now also drops empty lines before a key line (`docs/review-queue.md`).

## Step 0: setup

- Step 0: setup. The project rules (`AGENTS.md`), the README, the goal (`docs/spec.md`), the format specification (`docs/format.md`, copied from Markgraf and reviewed), the plan, the license, and the stack: Bun, mise, bun:test, lefthook with a pre-push hook that runs `mise run test`. A test checks that the docs have no GFM pipe table until the lint of step 6 exists. Done on 2026-10-05. The decisions of the format review are in `docs/review-queue.md`.
