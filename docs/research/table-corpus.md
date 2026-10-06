---
checked: 2026-10-06
recheck: "6m. If GitHub documents a limit for raw.githubusercontent.com, or if a pinned source moves or changes its license, recheck at that time"
decisions:
  - "tbl-md step 10 (proposal): no ready-made corpus fits. The corpus is a configuration file with about 30 sources: parser fixtures and 10 real files from 9 repositories, about 1.6 MB in total"
  - "tbl-md step 10 (proposal): the downloader gets each file from raw.githubusercontent.com at a commit URL, with no token. It makes sure that the SHA-256 of the file is the SHA-256 in the configuration file. It writes the file to ~/.cache/tbl-md/corpus/<owner>/<repo>/<commit>/<path>. It never gets a file again that the cache has with the correct hash"
  - "tbl-md step 10 (proposal): own downloader of about 80 lines on the built-in fetch and node:crypto. No established tool covers a pinned list of single files with a cache outside the repository"
  - "tbl-md step 10 (proposal): caps of 512 KiB for each file and 4 MiB for the corpus"
  - "tbl-md step 10 (proposal): the corpus test compares the mdast of each table after it pads short rows and removes excess cells, because GFM shows these rows so"
  - "tbl-md step 10 (proposal): use only sources with an open license. Do not use tc39/proposals and nodejs/Release, because they have no license"
---

# A corpus of real tables for the reversibility test

Research on 2026-10-06 for tbl-md, step 9. No paid API. No key file was read. Each source at the end is a page, a file, or an API response that this research opened on 2026-10-06. A statement without a source has the mark "[guess]". A fact that this research measured has the mark "[measured]".

This report uses ASD-STE100 Simplified Technical English as a guide. No tool can make sure that a text obeys ASD-STE100 fully. The full dictionary is a free download at asd-ste100.org.

## Question

Principle 1 of `docs/spec.md` says that a switch to tbl-md must be reversible. A file that tbl-md converts to `tbl` and back to GFM must show the same. Thus its mdast (the syntax tree of Markdown) must be the same, with no positions. A corpus of real tables tests this. The corpus does not go into the repository. A downloader gets it from a configuration file. The downloader must use little data:

- It pins each source to a commit.
- It gets only the named files, never a full repository.
- It has a size cap for each file and for the total.
- It keeps a cache outside the repository, `~/.cache/tbl-md/corpus/`.
- It never gets a file two times.
- It needs no token, and it sends no data other than the file requests.

The five questions:

1. Do ready-made corpora of Markdown tables or of real Markdown files exist? What are their license and size?
2. Which test fixtures of established parsers have GFM tables? What are the exact paths?
3. Which real Markdown files have many and different GFM tables?
4. What is the established method to get single files at a pinned commit with no token? Does a tool for a pinned list of files with checksums exist?
5. What does "get but not distribute" mean for the licenses?

## Method

1. Read `docs/spec.md`, `docs/format.md`, `README.md`, and `docs/research/npm-release.md`.
2. Searched the lessons in `~/dv/meta/agents/lessons/`, the research index `~/dv/meta/agents/research-index.md`, and the Gemini journal. No report or lesson covers a corpus of tables. The related reports are `~/dv/markgraf/docs/research/markdown-round-trip-toolchains.md` (round trips of Markdown parsers) and `~/dv/markgraf/docs/research/readable-table-syntax.md` (the origin of the `tbl` format). This report links to them and does not copy them. The "corpus" of Markgraf is a different thing: the logs of all projects on the machine.
3. Listed the file trees of 13 parser repositories at their current commit with `gh api` [measured].
4. Got 18 real files and 53 fixture files from raw.githubusercontent.com at commit URLs, with no token [measured].
5. Wrote a script in the scratchpad (not in the repository). For each file, it counts the tables and their properties. It converts the file with `convert` of tbl-md 0.1 to `tbl` and back to GFM, and it compares the two mdast trees [measured].
6. Measured the data volume of a git partial clone, and the headers of jsDelivr, the GitHub contents API, and Software Heritage [measured].
7. Read the documentation of the fetch methods, of vendir, peru, giget, and make-fetch-happen, and the license texts.
8. Searched skills.sh with its search API for `corpus`, `fixtures`, `vendir`, `download-files`, `test-fixtures`, and `pinned`.

## Findings

### 1. Ready-made corpora

No ready-made corpus of GFM tables exists that fits. The candidates:

```tbl
name: Corpus
size: Size
license: License
fit: Fit
--
name: The Stack, Markdown part (`bigcode/the-stack`)
size: 1.43 TB for all languages, Markdown is one of 358 languages
license: Other. Each file keeps its original license. The access is gated
fit: No. It needs an account, a token, and an agreement to terms. It is too large. Source: [The Stack card](https://huggingface.co/datasets/bigcode/the-stack)
--
name: `markdown-dataset` on npm
size: 24 MB unpacked, version 0.1.0 of 2024-02-04 [measured]
license: No license field. READMEs of MIT repositories, base64 in one package
fit: No. It is a vendored copy with no pin to a commit, and it is not about tables. Source: [npm registry](https://registry.npmjs.org/markdown-dataset)
--
name: `h1alexbel/github-readmes` on Hugging Face
size: fewer than 1000 rows
license: MIT tag
fit: No. READMEs as CSV, not about tables. Source: [HF API](https://huggingface.co/api/datasets/h1alexbel/github-readmes)
--
name: `codeparrot/github-code`
size: no size tag, last change 2022
license: Other
fit: No. Code files, old, and not pinned. Source: [HF API](https://huggingface.co/api/datasets/codeparrot/github-code)
--
name: cmark-gfm fuzzing input (`test/afl_test_cases/test.md`, `test/fuzzing_dictionary`)
size: 382 bytes and 1267 bytes [measured]
license: BSD-2-Clause
fit: No. One small seed file, not a corpus of tables
--
name: markdown-it benchmark samples (`benchmark/samples/`)
size: about 20 KB [measured]
license: MIT
fit: No. Short samples for speed, not for tables
```

Thus the corpus is a list that the project writes: the test fixtures of question 2 and the real files of question 3.

### 2. Test fixtures of parsers with GFM tables

All paths are at the commit in the column "commit" [measured with `gh api`]. A fixture of the "spec" kind has examples between lines of 32 backticks. The Markdown input comes before a line `.`, and the character `→` stands for a tab. A fixture of the "markdown" kind is plain Markdown.

```tbl
repo: Repository
commit: Commit
path: Path
kind: Kind
size: Size and content
license: License
--
repo: github/cmark-gfm
commit: `27d942c8b0a62d192f616e5bf3578f4b6a89e180`
path: `test/spec.txt`
kind: spec
size: 217 KB, 8 examples of the extension `table` [measured]
license: CC-BY-SA 4.0 (header of the file)
--
repo: github/cmark-gfm
commit: `27d942c8b0a62d192f616e5bf3578f4b6a89e180`
path: `test/extensions.txt`
kind: spec
size: 21 KB, 16 table examples in section "Tables" (escaped pipes, cell count mismatch, HTML, emphasis) [measured]
license: BSD-2-Clause (`COPYING`)
--
repo: github/cmark-gfm
commit: `27d942c8b0a62d192f616e5bf3578f4b6a89e180`
path: `test/extensions-table-prefer-style-attributes.txt`
kind: spec
size: 741 bytes
license: BSD-2-Clause
--
repo: micromark/micromark-extension-gfm-table
commit: `1511204dae5a01e81588cee417ecd4fb8d2c8aff` (tag 2.1.2, the version that tbl-md uses)
path: `test/fixtures/{align,basic,containers,double-delimiter-row,gfm,grave,indent-alt,indent,interrupt,loose,pierce,some-escapes}.md`
kind: markdown
size: 12 files, 3.3 KB, 57 tables. Has tables in lists and block quotes (`containers.md`). Do not use `large.offline.md` (1.4 MB)
license: MIT
--
repo: markdown-it/markdown-it
commit: `3c51991c32aaa2b002a52c009334ebe5752c84b3`
path: `test/fixtures/markdown-it/tables.txt`
kind: markdown-it fixture (input, `.`, output, `.`)
size: 9.5 KB, about 38 cases [measured]
license: MIT
--
repo: pulldown-cmark/pulldown-cmark
commit: `c61583e33f043e926a5cbd4423252c6cb97301d2`
path: `pulldown-cmark/specs/table.txt`
kind: spec
size: 24 KB
license: MIT
--
repo: yuin/goldmark
commit: `cbf81e953298b60401e32250ee96cff5ff8ca649`
path: `extension/testdata/table.txt`
kind: goldmark fixture
size: 3.8 KB
license: MIT
--
repo: remarkjs/remark-gfm
commit: `109972e8a773bf5dac1d6d2da0776557f36971aa`
path: `test/fixtures/table/input.md`, `test/fixtures/table-no-align/input.md`
kind: markdown
size: 112 bytes
license: MIT
--
repo: prettier/prettier
commit: `5927216227411bc2cdaf30d50559e0a475ab4832`
path: `tests/format/markdown/table/{align,cjk,emoji,empty,escape,html,issue-15572,simple,table}.md`, `tests/format/markdown/table/empty-table/empty-table.md`, `tests/format/markdown/long-table/long-table.md`
kind: markdown
size: 11 files, 2.6 KB. CJK and emoji widths, escapes, HTML
license: MIT
--
repo: DavidAnson/markdownlint
commit: `3f1f479322e863a53e56c94b01266b9785cd3bfd`
path: the 28 files `test/*table*.md`, for example `test/table-pipe-style.md`, `test/blanks-around-tables.md`, `test/table-column-style-trailing-spaces.md`
kind: markdown
size: 28 files, 32 KB, 210 tables. Pipe styles, trailing spaces, tables in lists and block quotes
license: MIT
```

Two parsers have no own table fixtures:

- commonmark.js implements only CommonMark. Its `test/spec.txt` has no table example [measured].
- `syntax-tree/mdast-util-gfm-table` has its tests in `test.js` as code, not as fixture files [measured].

`markdown-it-py` (`tests/test_port/fixtures/tables.md`) is a port of the markdown-it fixture. `executablebooks/mdformat-tables` (`tests/gfm_tables_spec.commit-85d895289c5ab67f988ca659493a64abb5fec7b4.json`) is a JSON copy of the GFM table examples. These two add little [guess].

### 3. Real files with many tables

The script measured each file at the given commit. "Tables" counts the GFM tables that `micromark-extension-gfm-table` finds. "Round trip" is the result of tbl-md 0.1: GFM to `tbl` and back to GFM, then a comparison of the mdast with no positions.

```tbl
file: Repository and path
commit: Commit
size: Size
tables: Tables (rows)
traits: Traits
license: License
result: Round trip with tbl-md 0.1
--
file: public-apis/public-apis `README.md`
commit: `874e5879d20843f7c2a5822cef4c0752127b3775`
size: 294 KB
tables: 53 (2111)
traits: alignment, inline code, links. 6 tables have 103 rows with excess cells
license: MIT
result: Fails. 104 errors "Row n has more cells than the header"
--
file: kubernetes/kubernetes `CHANGELOG/CHANGELOG-1.33.md`
commit: `e234a6f2036b550893eba6d4556b83ac5e7d2a3f`
size: 413 KB
tables: 100 (660)
traits: long hashes in cells, links, inline code. A test of the size cap
license: Apache-2.0
result: Same mdast
--
file: nodejs/node `doc/api/fs.md`
commit: `9a85290d86d815aca21c3fe113bbadfdf9d62b38`
size: 312 KB
tables: 4 (32)
traits: inline code, one table with an escaped pipe `\|`
license: MIT (Node.js license)
result: Same mdast
--
file: nodejs/node `BUILDING.md`
commit: `9a85290d86d815aca21c3fe113bbadfdf9d62b38`
size: 44 KB
tables: 4 (37)
traits: up to 5 columns, empty cells, a link
license: MIT (Node.js license)
result: Same mdast
--
file: donnemartin/system-design-primer `README.md`
commit: `ae9bbd7b02d90b9866215de185217d33f39ab733`
size: 110 KB
tables: 10 (122)
traits: `<br>` in cells, HTML, links, empty cells
license: CC-BY-4.0
result: Same mdast
--
file: rust-lang/rust `src/doc/rustc/src/platform-support.md`
commit: `db23a2d392783030c008a5fafbe6cb139d1f7707`
size: 41 KB
tables: 5 (339)
traits: alignment, inline code, links, short rows
license: Apache-2.0 or MIT
result: Different mdast. The cause is the alignment and the short rows (finding 6)
--
file: ossu/computer-science `README.md`
commit: `33d44a44e3526ede8e862bf1ad50ae5ae7a2f112`
size: 29 KB
tables: 16 (79)
traits: alignment on all tables, links, up to 6 columns
license: MIT
result: Different mdast. The only cause is the alignment
--
file: microsoft/vscode-docs `docs/reference/default-keybindings.md`
commit: `279a4a77ecb41a00420244616233490944f7e706`
size: 16 KB
tables: 12 (175)
traits: inline code in each table
license: CC-BY-3.0 US (documentation), MIT (code)
result: Same mdast
--
file: kubernetes/website `content/en/docs/reference/kubectl/quick-reference.md`
commit: `abc9ea495989b5660aae4bb7dafa1fb15cad0aad`
size: 25 KB
tables: 2 (23)
traits: inline code with commands
license: CC-BY-4.0
result: Same mdast
--
file: MicrosoftDocs/azure-docs `articles/azure-resource-manager/management/azure-subscription-service-limits.md`
commit: `935661c6afeecb6d50bff36bb0cf4942d57150c4`
size: 27 KB
tables: 1 (9)
traits: HTML and links in cells
license: CC-BY-4.0
result: Same mdast
--
file: tc39/proposals `README.md`, `finished-proposals.md`, `stage-1-proposals.md`
commit: `849adcde177533cd31c0803eef5844f9d9a50388`
size: 72 KB, 137 KB, 68 KB
tables: 5 (240)
traits: `<br>` and HTML in cells, wide tables
license: none
result: Same mdast. Do not use: no license (finding 9)
--
file: nodejs/Release `README.md`
commit: `72fdab20216c5f04e0a0fe72a225c2504e9f2b42`
size: 14 KB
tables: 2 (27)
traits: alignment, 7 columns, empty cells
license: none
result: Different mdast (alignment). Do not use: no license
```

Four more candidates had no GFM table [measured]:

- `electron/electron` `docs/tutorial/electron-timelines.md`.
- The table page of `github/docs`. Its tables are in code blocks.
- The regular expression cheat sheet of `mdn/content`. It has HTML tables.
- `DavidAnson/markdownlint` `doc/md056.md`.

The real files have no table in a list or in a block quote, and only one table with an escaped pipe. The fixtures of question 2 cover these cases: `containers.md` of micromark, `blanks-around-tables.md` of markdownlint, and `some-escapes.md` and `escape.md`.

### 4. Results of the first corpus run

The 18 real files hold 214 tables, and the 53 fixture files hold 288 tables [measured]. The run found three things that step 10 must know.

1. A bug of tbl-md 0.1. If a row has spaces after its last pipe, the conversion to `tbl` puts the last pipe into the cell text. The cell `y` becomes `y |`. The conversion back to GFM writes `y \|`. Thus the content changes with no error. This breaks principle 1. A minimal case is `| A | B |\n| --- | --- |\n| x | y | \n`. The fixtures `test/table-column-style-trailing-spaces.md` and line 149 of `test/table-pipe-style.md` of markdownlint show it [measured].
2. Excess cells. In 6 of the 53 tables of public-apis, 103 rows have excess cells [measured]. Most rows end with `| |`, an excess empty cell. In one row, the excess cell has text. GFM ignores excess cells (GFM spec, section Tables: "If there are greater, the excess is ignored"). tbl-md 0.1 stops with an error for each such row, so the full file does not convert. An excess cell with no text holds no content. The format can accept it. That is a decision for the format (open question 2). The cell with text is a correct error, because GFM does not show that text.
3. The comparison of mdast is too strict. `mdast-util-gfm-table` keeps a short row short and keeps excess cells in the tree [measured]. GFM shows a short row with empty cells and does not show excess cells (GFM spec). A conversion to `tbl` writes each row with all columns. Thus a correct round trip gives a different mdast for a short row. After the test pads each row to the width of the header and removes the excess cells, these files give the same mdast [measured]: `rust-lang/rust` platform-support, `blanks-around-tables.md`, and `empty.md` and `empty-table.md` of prettier. All other differences came from the alignment, which version 0.2.0 keeps.

Conversion errors that are correct by `docs/format.md` also occur. One example is a cell that ends with `<br>`, in prettier `long-table.md` and markdownlint `inline_html-*.md`. Another example is a row with more cells than the header, in micromark `gfm.md` and remark-gfm `table/input.md`. These errors are not test failures. They show that tbl-md does not lose content in silence.

### 5. Methods to get single files at a commit

```tbl
method: Method
data: Data for 2 files of nodejs/node (356 KB of text)
limit: Limit with no token
lockin: Lock-in and other notes
--
method: raw.githubusercontent.com, `https://raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>`
data: Only the files, about 356 KB (less with gzip) [measured]
limit: Not documented. GitHub put new limits on raw downloads with no token in 2025, with no number ([changelog](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)). The responses have no rate limit header. 71 requests in some minutes gave no error [measured]
lockin: GitHub only. A Fastly cache, `cache-control: max-age=300` [measured]
--
method: GitHub contents API, `GET /repos/<owner>/<repo>/contents/<path>?ref=<commit>` with `Accept: application/vnd.github.raw+json`
data: Only the files
limit: 60 requests per hour for each IP address ([rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)), header `x-ratelimit-limit: 60` [measured]. Files up to 100 MB with the raw media type ([contents API](https://docs.github.com/en/rest/repos/contents))
lockin: GitHub only. It also gives the size and the git blob SHA of a file
--
method: jsDelivr, `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/<path>`
data: Only the files [measured]
limit: No bandwidth limit. Single files of more than 20 MB are not supported ([jsDelivr README](https://github.com/jsdelivr/jsdelivr))
lockin: A third party between GitHub and the user. It keeps each file of a commit in permanent storage and gives `cache-control: immutable` for one year [measured]. It worked for kubernetes and azure-docs [measured]
--
method: git partial clone, `git fetch --depth=1 --filter=blob:none origin <commit>` and a sparse checkout of the paths
data: 1.9 MB of trees and 80 KB of blobs for nodejs/node, 2.6 MB of trees for azure-docs [measured]. `--filter=tree:0` gets the same trees at the checkout [measured]
limit: GitHub limits clones over HTTPS with no token (changelog), with no number
lockin: None. Each git host works. Missing objects come "one at a time" and slowly ([partial clone](https://git-scm.com/docs/partial-clone)). About 5 to 25 times the data of raw, and a git process
--
method: codeload tarball (`/tarball/<commit>`), giget, degit
data: The full repository at the commit, for example GBs for azure-docs (27 GB repository [measured])
limit: As GitHub
lockin: Breaks the rule "never a full repository"
--
method: Software Heritage API, `/api/1/revision/<commit>/directory/<path>/` and then the `data_url`
data: Only the files, two requests for each file
limit: 120 requests per hour, header `X-Ratelimit-Limit: 120` [measured]
lockin: A public archive with no company. But the commits of September 2026 were not in the archive. A commit of tag 2.0.0 of micromark-extension-gfm-table was there, with SHA-256 checksums [measured]
```

Tools for a pinned list of files:

- vendir (Carvel, Apache-2.0, v0.46.2 of 2026-09-08) reads a YAML configuration. Its `git` source clones with a `depth` and filters with `includePaths`. Its `http` source has a `url` and a `sha256`, which is optional. Source: [vendir spec](https://carvel.dev/vendir/docs/v0.46.x/vendir-spec/). vendir writes into a target folder and a lock file, as a tool for vendoring. It is a Go binary. mise can install it (`aqua:carvel-dev/vendir`) [measured].
- peru (MIT, 1.3.5 of 2025-10-22) has a `curl` module with a `sha1` and a `--cache-dir`. Source: [peru README](https://github.com/buildinspace/peru). It copies the files into the project. It is a Python tool.
- giget (MIT) downloads a tarball, or a sparse checkout with `--filter=blob:none` for a subfolder ([giget README](https://registry.npmjs.org/giget)). It gets folders, not a list of files.
- make-fetch-happen (ISC, 16.0.1 of 2026-05-26) is the fetch client of npm. It has the options `cachePath`, `cache: 'force-cache'`, `integrity`, and `size`. Source: [make-fetch-happen README](https://registry.npmjs.org/make-fetch-happen). Subresource Integrity is a hash in the form `sha256-<base64>`. It has 12 direct dependencies [measured]. It gives the cache and the hash, but not the list of sources.
- skills.sh has no skill for a corpus of files or for pinned downloads [measured, search API].

No tool covers all of the conditions: single files, a commit pin, a hash, a size cap, a cache outside the repository, and no token. The part that the tools add is small. The runtime has `fetch` and `node:crypto`. A downloader with these is about 80 lines [guess].

### 6. Licenses

- A test that gets a file and keeps it in a local cache makes a copy. It does not share the file. The open licenses give the right to copy for each purpose. If a person shares the material, their conditions start. CC-BY 4.0 says: "If You Share the Licensed Material ... You must retain ..." ([CC-BY 4.0, section 3(a)](https://creativecommons.org/licenses/by/4.0/legalcode.en)). MIT, BSD, and Apache-2.0 put their conditions on copies that a person distributes [guess: not opened in this research].
- A repository with no license gives no permission to use the files. A view and a fork on GitHub give no permission to use, change, or share the software ([choosealicense](https://choosealicense.com/no-permission/)). The GitHub terms give a license only "through the Service as permitted by GitHub's functionality" ([GitHub terms, D.5](https://github.com/github/docs/blob/45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3/content/site-policy/github-terms/github-terms-of-service.md)). A copy in a local cache is outside the service [guess]. Thus do not use tc39/proposals and nodejs/Release.
- Share-alike licenses need care. The GFM spec (CC-BY-SA 4.0) and MDN prose (CC-BY-SA 2.5) are examples. If a person copies a failed table from such a file into `test/` of tbl-md, the copy must have the same license. Thus a regression test for a corpus failure must use a table that the agent writes again, not a copy. A short quote in an error message or in an issue is a small part [guess: fair use and quotation rules differ by country].
- If a person does not share the files, CC-BY-3.0 US (vscode-docs) and CC-BY-4.0 need no attribution. The configuration file keeps the repository, the path, and the license of each source. Thus each failure report can name the source.
- The Stack requires that a user obeys the original licenses and accepts its terms. That is one more reason not to use it.

## Recommendation for step 10

1. Write the configuration file `test/corpus/sources.json`. JSON needs no parser library. Each source has `repo`, `commit`, `license`, and a list of files. Each file has `path`, `kind` (`markdown`, `spec`, `markdown-it`, or `goldmark`), `size`, and `sha256`. A file of the `spec` kind gives one Markdown document for each example. Use only sources with an open license.
2. Start with these sources (about 1.6 MB):
   - The fixtures of finding 2, about 315 KB. These are 2 files of cmark-gfm, 12 of micromark, 1 of markdown-it, 1 of pulldown-cmark, 1 of goldmark, 2 of remark-gfm, 11 of prettier, and 28 of markdownlint.
   - The 10 real files with an open license of finding 3 (about 1.3 MB): public-apis, kubernetes CHANGELOG-1.33, nodejs/node `fs.md` and `BUILDING.md`, system-design-primer, rust platform-support, ossu, vscode-docs keybindings, kubectl quick reference, and the azure-docs limits page.
3. Get each file from `https://raw.githubusercontent.com/<repo>/<commit>/<path>`, with no token and no other header. Use the built-in `fetch`. Stop at 512 KiB for each file and at 4 MiB for the total. Read the body as a stream, so that a file that is too large stops early.
4. Keep the cache at `~/.cache/tbl-md/corpus/<owner>/<repo>/<commit>/<path>`, or at `$XDG_CACHE_HOME/tbl-md/corpus/`. If the cache has the file with the correct SHA-256, do not get it again. If the hash is wrong, stop with an error that names the file. A commit URL never changes, so the cache never becomes old.
5. Give a command `mise run corpus-pin <repo> <commit> <path>...` that writes the size and the SHA-256 into the configuration file. Do not let the test write the hash, so that a changed file always gives an error.
6. In `mise run corpus`, convert each file to `tbl` and back. Count three results for each source: same, conversion error, and different. Only "different" and a crash make the test fail. Before the comparison, remove the positions, pad short rows with empty cells, and remove excess cells. Print the file and the line of each difference, not the content.
7. Fix the bug of finding 4.1 in a separate step, with a hand-written regression test.
8. Keep jsDelivr as the documented fallback host. It is one change of the URL template. Do not add git or Software Heritage now.

## Open questions for the main thread

1. Principle 1 says "its mdast is the same". The measurement shows that the test must normalize short rows and excess cells. That is the same as "shows the same". Is this normalization in line with the spec, or does the user decide it?
2. Can the conversion to `tbl` accept an excess cell that has no text? Then public-apis converts. It changes `docs/format.md`, so it needs an entry in `docs/review-queue.md`.

## Critical analysis

### 1. Premises of the question

- The question takes GitHub as the place of real Markdown. This is true for the data today, but each source is on one company. The pin is a git commit, which is a protocol and not a platform. Thus each git host can serve the same pin.
- The question takes "renders the same" as "the same mdast". The measurement shows that mdast keeps details that GFM does not show (short rows, excess cells). The better frame is: "the HTML of GFM is the same". The normalized mdast is a cheap form of that.
- The question takes real files as the best test. Real files have few edge cases. In 1.6 MB, only one table had an escaped pipe, and no table was in a list. The fixtures of the parsers and the property tests (fast-check is already a dev dependency) find more edge cases for each byte. Real files show which cases are frequent, for example the excess empty cells of public-apis.
- The question takes a downloader as necessary. The other way is a small set of tables that the project writes and owns. It needs no network. But the user wants proof on tables that other people wrote.

### 2. The standard solution and its control mechanisms

The usual answer is a raw download from GitHub, or a dataset from Hugging Face.

- Centralization: GitHub (Microsoft) serves the files and the parser repositories. Hugging Face hosts the datasets.
- Vendor lock-in: the raw URL form and the contents API are GitHub only. The Stack needs a Hugging Face account and a token.
- Rent-seeking: GitHub puts limits on requests with no token, with no number, and asks users to log in ([changelog](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)). A login gives higher limits. This pushes users to accounts.
- Telemetry: each request tells GitHub or jsDelivr the IP address, the time, and the file. A gated dataset also records the identity of the user and the agreement to the terms.
- Attention economy: none.

### 3. The autonomous architecture

- Pin by git commit and by SHA-256 of the content. Then the source host does not matter. The same configuration works with raw GitHub, jsDelivr, a Forgejo mirror, or Software Heritage. Only the URL template changes.
- Software Heritage as the archive. It is a public archive with no company, and it gives SHA-256 checksums. Its limit is 120 requests per hour with no token, and new commits come late [measured].
- A git partial clone from any git host. It is a protocol, not a platform, and it needs no API.
- A local mirror. A one-time partial clone of each source repository into the cache. The test then needs no network.
- A downloader of about 80 lines on built-in APIs. No dependency, no tool lock-in, and the cache is plain files that a human can read.

### 4. The cost of autonomy

- Hash pin: the SHA-256 in the configuration needs one command at each update of a source (`corpus-pin`). This is about one minute of time for each update [guess].
- Software Heritage: two requests for each file, so about 60 files for each hour. A first download of the 70 files takes more than one hour. The archive does not have new commits, so a pin must use an older commit.
- git partial clone: 5 to 25 times more data than raw [measured], a git process for each source, and slow lazy fetches of objects.
- Local mirror: the trees of large repositories, for example 2.6 MB for azure-docs [measured], and more code for the update of the mirror.
- Own downloader: about 80 lines and their tests to keep. A change of the GitHub limits can need a fallback host. The cost is about two hours for the first version [guess].

Recommendation: take raw GitHub with a commit pin and a SHA-256 pin now. The hash makes the host replaceable, and jsDelivr or Software Heritage is one change of the URL template.

## Sources

All opened on 2026-10-06.

- tbl-md, `docs/spec.md`, `docs/format.md`, `README.md`, `docs/research/npm-release.md` (in this repository)
- Related reports (not copied): `~/dv/markgraf/docs/research/markdown-round-trip-toolchains.md`, `~/dv/markgraf/docs/research/readable-table-syntax.md`
- GFM spec, `test/spec.txt` of cmark-gfm (section Tables, license header): https://raw.githubusercontent.com/github/cmark-gfm/27d942c8b0a62d192f616e5bf3578f4b6a89e180/test/spec.txt
- cmark-gfm, `test/extensions.txt` and `COPYING`: https://github.com/github/cmark-gfm
- File trees through `gh api repos/<owner>/<repo>/git/trees/<commit>?recursive=1` for github/cmark-gfm, micromark/micromark-extension-gfm-table, markdown-it/markdown-it, commonmark/commonmark.js, remarkjs/remark-gfm, syntax-tree/mdast-util-gfm-table, pulldown-cmark/pulldown-cmark, executablebooks/markdown-it-py, yuin/goldmark, prettier/prettier, DavidAnson/markdownlint, executablebooks/mdformat-tables, micromark/micromark-extension-gfm
- Each real file of finding 3 at `https://raw.githubusercontent.com/<repo>/<commit>/<path>`, and the license files through `gh api repos/<repo>/license`
- Hugging Face, The Stack: https://huggingface.co/datasets/bigcode/the-stack
- Hugging Face API: https://huggingface.co/api/datasets/h1alexbel/github-readmes, https://huggingface.co/api/datasets/codeparrot/github-code, https://huggingface.co/api/datasets/bigcode/the-stack-v2
- npm registry, `markdown-dataset`: https://registry.npmjs.org/markdown-dataset
- GitHub changelog, "Updated rate limits for unauthenticated requests" (2025-05-08): https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/
- GitHub Docs, "Rate limits for the REST API": https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- GitHub Docs, "REST API endpoints for repository contents": https://docs.github.com/en/rest/repos/contents
- jsDelivr README: https://github.com/jsdelivr/jsdelivr
- Git, "Partial Clone": https://git-scm.com/docs/partial-clone
- Software Heritage API, responses of `https://archive.softwareheritage.org/api/1/revision/<commit>/directory/<path>/`
- vendir spec v0.46.x: https://carvel.dev/vendir/docs/v0.46.x/vendir-spec/
- vendir repository and release v0.46.2: https://github.com/carvel-dev/vendir
- peru README: https://github.com/buildinspace/peru, PyPI: https://pypi.org/pypi/peru/json
- giget README: https://registry.npmjs.org/giget
- make-fetch-happen README and dependencies: https://registry.npmjs.org/make-fetch-happen
- skills.sh search API: https://www.skills.sh/api/search?q=corpus and `?q=fixtures`, `?q=vendir`, `?q=download-files`, `?q=test-fixtures`, `?q=pinned`
- Creative Commons, CC-BY 4.0 legal code: https://creativecommons.org/licenses/by/4.0/legalcode.en
- choosealicense, "No License": https://choosealicense.com/no-permission/
- GitHub Terms of Service, section D.5 (source in github/docs): https://github.com/github/docs/blob/45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3/content/site-policy/github-terms/github-terms-of-service.md
- MDN license file: https://github.com/mdn/content/blob/main/LICENSE.md
- vscode-docs license file: https://github.com/microsoft/vscode-docs/blob/main/LICENSE.md
