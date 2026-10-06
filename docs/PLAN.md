# Plan

tbl-md gives the readable `tbl` table format and its tools. `docs/spec.md` has the goal, and `docs/format.md` has the format. This plan lists the open steps. Finished steps are in `docs/HISTORY.md`.

## Hand-off

2026-10-06, interactive session in `~/dv/tbl-md`, after step 13.

State: steps 0 to 13 are done and merged into `main`. The parser, the renderer, and the conversion follow version 0.2.0 of `docs/format.md`. The corpus baseline is 586 tables, 564 same, 22 errors, 0 different. `docs/HISTORY.md` holds the plans of steps 12 and 13.

Known gap: `.handover.toml` still has `local_only = true`, although the remote exists. If the user allows it, remove the line, so that `handover check` checks the push again.

Next step: step 14, lint of unknown attribute keys. First give the research agent the question where a Markdown lint keeps the configuration of a project (for example `package.json`, a dotfile, or the configuration of markdownlint or remark-lint), and write the report into `docs/research/`. Then decide the place by the canon, write it into `docs/review-queue.md`, plan the step, and let a subagent implement it in `.worktrees/14-lint-keys`.

Open tasks of the user: none.

New context: yes. Step 14 has a new topic, and this context holds the reviews of steps 12 and 13.

## Rules for each step

Each step plans and reviews first, then implements in its own branch `feature/<step>-<name>`, with tests and documentation. If `mise run test` passes, it merges into `main`. A detail of the format that a step decides goes into `docs/format.md` and gets an entry in `docs/review-queue.md`.

## Open steps

The goal of these steps is version 0.2.0. `docs/spec.md`, section Scope of version 0.2.0, has the decisions of the user from 2026-10-06.

- Step 14: lint of unknown attribute keys. The lint warns on an unknown key, unless the configuration of the project lists it. The step decides where that configuration lives.
- Step 15: release 0.2.0. A breaking version, so the changelog names the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker (`docs/review-queue.md`, step 11). The user merges the release PR.

## Later

- Plugins for remark and markdown-it that show a `tbl` block as a table in a preview.
- `tbl-md fmt <files>`: rewrites each `tbl` block in its canonical form.
- Markgraf step 6a uses the package for its table views, and its step 6b runs the lint in its hook. The markgraf session does both after the first release.

## Plan of step 14

The design is in `docs/research/lint-configuration.md`, and the decision is in `docs/review-queue.md` (step 14). Branch `feature/14-lint-keys`, worktree `.worktrees/14-lint-keys`.

### Library (`src/lint.ts`, new `src/config.ts`)

- A problem gets `severity: "error" | "warning"`. Each existing problem is an error. A new warning code `unknown-attribute-key` covers a pair whose key is not `align` and not in the list. Its line and column are those of the key in the block. A column, a row, and a cell count the same.
- `lint(source, options?)` takes `{ attributeKeys?: string[] }`. Without the option, each key other than `align` is unknown.
- `src/config.ts` finds and reads `.tbl-md.json`. The file has `$schema` (the loader ignores it) and `attributeKeys`, a list of strings in the key form of rule 14. Each other top-level key, a value of a wrong type, a key that does not have the key form, and invalid JSON are configuration errors. A configuration error names the file, and the line where `JSON.parse` gives a position.
- The search starts in the folder of the linted file and goes up. It stops at the first folder with `.tbl-md.json`, at the first folder with a `.git` entry (a folder or a file), or at the root. The nearest file wins, with no merge. For stdin, the search starts in the current folder.

### Command line (`src/cli.ts`)

- The output marks each warning as a warning. The summary counts errors and warnings apart.
- Exit code 0 if no file has an error and the warnings are not more than `--max-warnings <n>` (no limit by default). Exit code 1 for an error, or for more warnings than the limit. Exit code 2 for a usage error and for a configuration error.
- `--config <file>` replaces the search. `--config` and `--max-warnings` are usage errors with `convert`.
- The pre-commit hook of tbl-md in `lefthook.yml` gets `--max-warnings 0`.

### Schema

- `schema/tbl-md.schema.json`: a JSON Schema (draft 2020-12) of the file, in the package (`files` of `package.json`). A test makes sure that the schema and the loader accept and refuse the same example files.

### Tests and documentation

- Tests for the warning in each place, for the list, for each configuration error, for the search (nearest file, the stop at `.git`, stdin, `--config`), and for each exit code.
- `README.md`: the configuration file, the warning, the two options, and the exit codes. `docs/format.md` rule 15 already says that the lint warns. Its words "step 14 of `docs/PLAN.md` decides where that configuration lives" become a pointer to the README.
