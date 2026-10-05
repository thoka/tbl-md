# Rules for tbl-md

The global rules of the user apply. This file adds the rules of this project. This project has no `CLAUDE.md`.

## What to read first

- `docs/spec.md`: the goal and the principles.
- `docs/format.md`: the `tbl` format. It is the contract of the package.
- `docs/PLAN.md`: the open steps and the hand-off.
- `README.md`: how to use what exists, and the known gaps.

## Stack

- TypeScript on Bun. `mise.toml` pins Bun and lefthook. Run tools with `mise exec -- <command>`, for example `mise exec -- bun add <package>`.
- `mise run test` runs the type check and all tests. The pre-push hook runs it. If it fails, the step is not complete.
- Tests live in `test/` and use `bun:test`. Source lives in `src/`.
- Run `mise run hooks-install` once in each new checkout, so that the hooks of `lefthook.yml` run. `mise run tbl-md <command>` runs the CLI.
- Add a library only with a one-line reason in the section Libraries of `README.md`. A runtime library must come from the mdast or micromark family (spec principle 4).

## Rules for the code

- The code in `src/` uses only `node:` modules and its libraries, no Bun API, so that the package runs on Node and on Bun.
- An error names the line, and in a file also the file. A test covers each error.
- A change of `docs/format.md` gets an entry in `docs/review-queue.md`. After the first release, a change that makes a valid block invalid, or that changes its content, needs a new major version. Below 1.0.0, a minor version takes the role of the major version (`bump-minor-pre-major` of release-please).
- Write each table in the docs as a `tbl` block, never as a GFM pipe table. Check: `tbl-md lint` in the pre-commit hook on the staged Markdown files, and `test/docs.test.ts` on all docs.
- Do not change `docs/spec.md` without the user.
