# History

Finished steps of `docs/PLAN.md`, moved word for word, newest first.

## Step 2: render

- Step 2: render. `render(table)` in `src/render.ts` writes the canonical form, with the escapes and the fence length. Tests: a parse followed by a render gives the same text for each canonical example, and a render followed by a parse gives the same table. A property test with `fast-check` (a new dev library, with its line in README Libraries) checks both laws on random tables, also with lines of the escape forms. Done on 2026-10-05. Status: `render`, `renderBlock`, and `validate` in `src/render.ts`, `escapeLine` in `src/syntax.ts`. The property test runs 1000 random tables per law and found no counterexample. A lone CR is a line end, as in CommonMark, and a title or a cell holds no CR (`docs/review-queue.md`).

## Step 1: parse

- Step 1: parse. `parse(text)` in `src/parse.ts` reads the lines inside a `tbl` fence and gives a table (`columns` with key and title, `rows` with an optional ID and the cells by key) or a list of errors, each with its line in the block. It covers rules 2 to 10 and 12 of `docs/format.md`. A test covers each rule and each error. The README gets a section Library with `parse`. Done on 2026-10-05. Status: `parse` collects all errors with their line, and each rule and each error code has a test (41 tests). The README section Library lists `parse` and its error codes. Rule 7 now also drops empty lines before a key line (`docs/review-queue.md`).

## Step 0: setup

- Step 0: setup. The project rules (`AGENTS.md`), the README, the goal (`docs/spec.md`), the format specification (`docs/format.md`, copied from Markgraf and reviewed), the plan, the license, and the stack: Bun, mise, bun:test, lefthook with a pre-push hook that runs `mise run test`. A test checks that the docs have no GFM pipe table until the lint of step 6 exists. Done on 2026-10-05. The decisions of the format review are in `docs/review-queue.md`.
