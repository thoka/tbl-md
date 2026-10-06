# History

Finished steps of `docs/PLAN.md`, moved word for word, newest first.

## Step 12: parse and render attributes

- Step 12: parse and render attributes. The parser keeps the attributes of the columns, the rows, and the cells, and the renderer writes them in the canonical form. Tests for each error. The plan of the step is in the section Plan of step 12. Done on 2026-10-06. Status: `src/attributes.ts` parses, checks, and renders one block. The parser keeps the attributes of columns, rows, and cells, with the 19 `attr-*` error codes, and `render` writes the canonical form. `Row.id` moved to `row.attributes.id` (breaking). A conversion to GFM of a table with attributes other than a row ID fails at the read-back check until step 13. Decisions in `docs/review-queue.md`. 452 tests pass.

### Plan of step 12

The rules are rules 4, 6, 7, 10, and 13 to 16 of `docs/format.md`, and its section Canonical form. Branch `feature/12-attributes`, worktree `.worktrees/12-attributes`.

#### Data model

```ts
export interface Pair { key: string; value: string }
export interface Attributes { id?: string; classes: string[]; pairs: Pair[] }
export interface Column { key: string; title: string; attributes?: Attributes }
export interface Row {
  attributes?: Attributes;
  cells: Record<string, string>;
  /** The attributes of the cells, by the full header key. A cell can have attributes and no text. */
  cellAttributes?: Record<string, Attributes>;
}
```

- The parser sets `attributes` and `cellAttributes` only if the block has an attribute line or block for them. Thus a 0.1 table without row IDs gives the same objects as before.
- `classes` and `pairs` are always arrays, in source order.
- The field `Row.id` of 0.1 goes away. The row ID is `row.attributes.id`. This is a breaking change of the API, and the merge commit is `feat!:` with a `BREAKING CHANGE:` footer. No other project uses the API yet (measured on 2026-10-06 with a search under `~/dv`).

#### Syntax (`src/syntax.ts`)

- The attribute form: `{` first, `}` as the last character other than a space or a tab.
- `separatorLine`: `--`, or `--`, spaces or tabs, and a rest in the attribute form. The rest is a group, also if it does not parse.
- The escaped forms of rule 10 get the attribute form and the new separator form. `escapeLine`, `unescapeLine`, and `isEscaped` cover all three forms.

#### Attribute blocks (new `src/attributes.ts`)

- `parseAttributes(block)` reads one block by the grammar of rule 14. On an error, it gives the code, the message, and the 0-based offset of the first bad character. It stops at the first error.
- A check of the known keys by place (`column`, `row`, `cell`): a bad value of `align`, and `align` at a row or a cell. The error is at the value or at the key.
- `renderAttributes(attributes)` writes the canonical form: ID, classes, pairs, one space between them, a bare value where it can be bare, else double quotes with `\"` and `\\`.

#### Error codes

One error per attribute line at most. A place error wins over a grammar error, because the parser does not read a block at a wrong place. An error of the block of a separator line has the code of the grammar error, at its column in the line.

```tbl
code: Code
error: Error of rule 16
--
code: `attr-unexpected-char`
error: an unexpected character
--
code: `attr-no-space`
error: no space between two parts
--
code: `attr-empty`
error: an empty block
--
code: `attr-bad-id`
error: an empty ID, or a bad character in an ID
--
code: `attr-bad-class`
error: an empty class, a class with no letter first, or a bad character
--
code: `attr-bad-key`
error: a key with no letter first, or with a bad character
--
code: `attr-duplicate-id`
error: more than one ID
--
code: `attr-duplicate-class`
error: a repeated class
--
code: `attr-duplicate-key`
error: a repeated key
--
code: `attr-reserved-key`
error: the key `id` or `class`
--
code: `attr-no-value`
error: a key with no value
--
code: `attr-bad-bare-value`
error: a bare value with a character outside `[A-Za-z0-9_:-]`
--
code: `attr-single-quotes`
error: single quotes
--
code: `attr-unclosed-quote`
error: a quoted value with no closing quote
--
code: `attr-bad-escape`
error: a backslash before a character other than `"` or `\`
--
code: `attr-bad-value`
error: a bad value of a known key
--
code: `attr-key-place`
error: a known key at a place that does not allow it
--
code: `attr-second-line`
error: a second attribute line for the same column or cell
--
code: `attr-misplaced`
error: a line in the attribute form at a place that takes no attributes
```

#### Places in the parser (`src/parse.ts`)

- Header: a line in the attribute form directly after a key line describes that column. Directly after the attribute line of a column, it is `attr-second-line`. Each other attribute line in the header is `attr-misplaced`, also one before the first key or after an empty line. It is never `header-not-key`.
- Data record, before the first key line: an attribute line is `attr-misplaced`, not `orphan-line`.
- In a cell: the first attribute line that only empty lines and attribute lines follow describes the cell. Each later attribute line of the cell is `attr-second-line`. An attribute line that a text line follows is `attr-misplaced` (the middle of a cell). The cell text ends at its last text line before the attribute line, with the empty lines trimmed (rule 7).
- The block on a `--` line describes the row.
- `locate` must skip the attribute lines of the header. The lines of the attribute lines in `locate` come with step 13, which needs them for its errors.

#### Renderer (`src/render.ts`)

- `validate` reports each attribute problem: an empty block (no ID, no class, no pair), a bad ID, class, or key, a repeated class or key, the key `id` or `class`, a value with a CR or an LF, a bad value or place of `align`, and `cellAttributes` with a key that no column has.
- `render` writes the canonical form: the column attribute line after its key line, the row block on `--`, the cell attribute line as the last line of the cell, and `key:` for a cell with attributes and no text.
- The two laws of `test/laws.test.ts` hold with random attributes too.

#### GFM and conversion until step 13

- `gfm.ts` and `convert.ts` move from `row.id` to `row.attributes.id`, with no change of behavior.
- `sameTable` in `convert.ts` compares all attributes. Thus a conversion to GFM of a table with attributes other than a row ID fails at the read-back check and changes nothing, until step 13 maps them. A test shows it.
- The laws of the GFM conversion keep tables with no attributes other than a row ID.

#### Tests and documentation

- A test for each error code above, with its line and its column, also in a separator line and in a file through `lint`.
- Tests for each place of rule 13, for empty lines before a cell attribute line, for a cell with attributes and no text, for an attribute block on a key line (it is text), and for each escape form of rule 10.
- The example of `docs/format.md` parses to the expected table.
- `README.md`: the data model, the error codes, the problems of `validate`, and the API example of `toGfm`. `docs/format.md`: the status line says that the parser and the renderer follow 0.2.0, and the conversion follows with step 13.

## Step 11: format rules for attributes

- Step 11: format rules for attributes. `docs/format.md` gets the rules of the spec section Scope of version 0.2.0: the attribute block, its three places, the escape, the canonical form, and the errors. The README sections Why, How to write a table, and Next exist since 2026-10-06. The step adds the attributes to How to write a table. Plan and review only, no code. Done on 2026-10-06. Status: rules 13 to 16 of `docs/format.md`, research `docs/research/attribute-block.md`, decisions in `docs/review-queue.md`.

## Step 10b: count each table in the corpus

- Step 10b: count each table in the corpus. A conversion error in one table must not hide the other tables of the same document (`docs/review-queue.md`, 2026-10-06, step 10). The corpus run counts same, error, alignment, and different for each table. No change of the library API, unless the main thread agrees. Done on 2026-10-06. Status: a failing table counts as one error, and the run removes it, keeps the line count and the container prefix, and converts again. Baseline on 0.1: 586 tables, 445 same, 22 errors, 119 alignment only, 0 different.

## Step 10: corpus downloader and baseline

- Step 10: corpus downloader and baseline. Follow the recommendation of `docs/research/table-corpus.md`. A configuration file lists each source with its repository, a pinned commit, and its files. The downloader fetches only these files, with a size cap per file and in total, into `~/.cache/tbl-md/corpus/`, and it never fetches a file twice. `mise run corpus` converts each file to `tbl` and back to GFM and compares the mdast with no positions, with short rows padded and excess cells removed. The first run measures the baseline of 0.1, so the known loss of the column alignment shows up. Not in the pre-push hook. Done on 2026-10-06. Status: `corpus/` has the sources, the downloader, `corpus-pin`, and the run, and it is not in the package. Baseline on 0.1: 142 documents, 106 same, 15 errors (12 excess cells with text, 3 cells that end with `<br>`), 21 alignment only, 0 different.

## Step 9c: excess cells with no text

- Step 9c: an excess GFM cell with no text. The conversion to tbl drops it and does not fail (`docs/review-queue.md`, 2026-10-06, step 9). An excess cell with text stays an error. `docs/format.md` gets the rule. Done on 2026-10-06. Status: `fromGfm` drops an excess cell whose text is empty or only spaces and tabs. The first excess cell with text of a row is the error, and the row gives only one error.

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
