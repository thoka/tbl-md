# History

Finished steps of `docs/PLAN.md`, moved word for word, newest first.

## Step 1: parse

- Step 1: parse. `parse(text)` in `src/parse.ts` reads the lines inside a `tbl` fence and gives a table (`columns` with key and title, `rows` with an optional ID and the cells by key) or a list of errors, each with its line in the block. It covers rules 2 to 10 and 12 of `docs/format.md`. A test covers each rule and each error. The README gets a section Library with `parse`. Done on 2026-10-05. Status: `parse` collects all errors with their line, and each rule and each error code has a test (41 tests). The README section Library lists `parse` and its error codes. Rule 7 now also drops empty lines before a key line (`docs/review-queue.md`).

## Step 0: setup

- Step 0: setup. The project rules (`AGENTS.md`), the README, the goal (`docs/spec.md`), the format specification (`docs/format.md`, copied from Markgraf and reviewed), the plan, the license, and the stack: Bun, mise, bun:test, lefthook with a pre-push hook that runs `mise run test`. A test checks that the docs have no GFM pipe table until the lint of step 6 exists. Done on 2026-10-05. The decisions of the format review are in `docs/review-queue.md`.
