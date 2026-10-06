# Contributing

This file is for people and agents who work on the repository of tbl-md. The README is for users.

## Development

The tools come from `mise.toml`.

```sh
mise install
mise run hooks-install
mise run test
```

These are the tasks of `mise.toml`:

```tbl
task: Task
what: What it does
--
task: `mise run test`
what: Runs the type check and all tests, also the package test.
--
task: `mise run build`
what: Builds the package: ESM JavaScript and type declarations from `src/` to `dist/`, by `tsconfig.build.json`. Then `scripts/bundle.ts` builds the single file `dist/tbl-md-markdown-it.iife.js` of the markdown-it plugin with esbuild.
--
task: `mise run test-package`
what: Runs only the package test, `test/package.test.ts`. It packs the package with `npm pack`, installs the tarball in a temp project, and runs the CLI and the library with Node 24, Node 22, and Bun. It also checks the files of the tarball and type checks a consumer file against the type declarations.
--
task: `mise run tbl-md <command>`
what: Runs the CLI from the source with Bun.
--
task: `mise run corpus`
what: Runs the corpus test (section The corpus test). It needs the network for the files that are not in the cache yet. With `--verbose`, it also lists each conversion error.
--
task: `mise run corpus-pin <owner/repo> <commit> <path>...`
what: Gets each file and writes its size and SHA-256 into `corpus/sources.json`. A new source needs `--license <SPDX id>`. `--kind <kind>` sets the kind of the files (default `markdown`).
--
task: `mise run corpus-discourse`
what: Downloads the table feature of Discourse (`features/table.js`, GPL-2.0-only) at the pinned commit into the corpus cache, with a hash check, once. With it, `mise run test` also compares the link pipe rule of the flavor `discourse` with Discourse. Without it, these tests skip. The file never goes into the repository or the package.
```

`npm pack` runs the build first (the script `prepack`), so a tarball always has a new build.

## The corpus test

Principle 1 of `docs/spec.md` says that a switch to tbl-md must be reversible. The corpus test checks this on tables that other people wrote. The corpus is a list of real Markdown files and of the table fixtures of established Markdown parsers, in `corpus/sources.json`. The list holds the table fixtures of cmark-gfm, micromark, markdown-it, pulldown-cmark, goldmark, and remark-gfm, and real Markdown files from large open source projects, such as Node.js, Kubernetes, and Rust. Each source is pinned to a commit. The files are not part of the repository, and the code in `corpus/` is not part of the package.

`mise run corpus` does these steps:

1. It gets each file of `corpus/sources.json` from `https://raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>`, with no token and no extra header.
2. It makes sure that the SHA-256 of each file is the SHA-256 in `corpus/sources.json`. On a wrong hash, it stops with an error that names the file. Only `mise run corpus-pin` writes a hash, so a changed file always gives an error.
3. It splits each fixture file into one Markdown document for each example. A plain Markdown file is one document.
4. It converts each document with a GFM table to `tbl` and back to GFM with the library, with the flavor `discourse`. It compares the HTML of markdown-it with the settings of that flavor before and after, table by table. It also compares the HTML of the blocks outside the tables.
5. If a table of a document fails the conversion, that table counts as `error`. The check then removes that table from the document and converts the document again. On each line of the removed table, it keeps the characters before the column of the table, for example the `>` of a block quote or the indent of a list item, and it removes the rest. So the other tables keep their lines and their containers, and one error does not hide them.
6. It prints the file and the line of each difference, never the content, and a summary of counts for each source.

The summary has the number of documents with a GFM table and the number of GFM tables in them. The other counts are per table, and they add up to the number of tables. A document that differs outside its tables adds one more `different`.

The counts:

```tbl
count: Count
meaning: Meaning
--
count: same
meaning: The HTML of the table after the round trip is the same.
--
count: error
meaning: The conversion of the table to `tbl` fails with an error by `docs/format.md`, for example for an excess cell with text. This is not a failure: tbl-md loses no content in silence. The check of the other tables of the document goes on.
--
count: different
meaning: The HTML of the table differs, also only in the column alignment, or the HTML of the text outside the tables differs. The run fails.
```

A crash also fails the run. Neither `mise run test` nor the pre-push hook runs the corpus test. `test/corpus.test.ts` tests the parts that need no network.

The kinds of a file:

```tbl
kind: Kind
documents: Documents
--
kind: `markdown`
documents: The whole file.
--
kind: `spec`
documents: The spec format of cmark-gfm and pulldown-cmark. Each example starts with a line of 32 backticks and the word `example`, and its Markdown ends at a line `.`. The character `→` stands for a tab.
--
kind: `markdown-it`
documents: The fixture format of markdown-it. The Markdown is between the first and the second line `.` of a case.
--
kind: `goldmark`
documents: The fixture format of goldmark. The Markdown is between the first and the second line `//- - - - - - - - -//` of a case.
```

The cache is `$XDG_CACHE_HOME/tbl-md/corpus/<owner>/<repo>/<commit>/<path>`, by default `~/.cache/tbl-md/corpus/`. A file that the cache has with the correct hash never downloads again. A commit never changes, so the cache never gets old. Delete the folder to get all files again.

The caps: 512 KiB for each file and 4 MiB for all files of one run. The download reads each file as a stream and stops as soon as a cap is passed. The corpus has about 1.6 MB.

If raw.githubusercontent.com is not available, jsDelivr is the fallback: `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/<path>` gives the same file. To use it, change `rawUrl` in `corpus/lib.ts`. The code has no automatic fallback.

Licenses: each source in `corpus/sources.json` has its license, and a file with another license has its own. Use only sources with an open license. A copy in the local cache shares nothing, so the conditions of the licenses for sharing do not apply. Do not copy a table from the corpus into `test/`. Some sources have a share-alike license, for example the GFM spec (CC-BY-SA-4.0). Write a regression test with a new table that shows the same case.

## The markdown-it measurement

`docs/format.md` holds the measurement of markdown-it 15.0.1 that the pipe rule, the trim, and the place of a new GFM table rest on (sections "How markdown-it splits a GFM row" and "Where a new GFM table can stand"). `test/markdown-it.test.ts` checks its statements. With the table feature of Discourse in the cache (`mise run corpus-discourse`), it also compares the link pipe rule of the flavor `discourse` with Discourse.

## Release

A merge of the release PR makes a release. release-please keeps one release PR open on GitHub, and it updates the PR after each push to `main`. When you merge the PR, the workflow `.github/workflows/release.yml` does these steps:

1. It tags the release `vX.Y.Z` and creates the GitHub Release with the changelog.
2. It builds the package and publishes it to npm with trusted publishing. No npm token is stored, and npm adds provenance.
3. It moves the branch `stable` to the release tag. The push cannot force, so `stable` only moves forward.

The workflow runs no tests, because the pre-push hook runs them before each push. Before 1.0.0, `feat:` gives a minor version and `fix:` gives a patch version.

## Libraries

- `typescript`: the type check and the build.
- `@types/node`: the types of the `node:` modules, at the oldest Node that the package supports (22).
- `@types/bun`: the types of `bun:test`.
- `fast-check`: the property test of the round-trip laws on random tables. It is the established property test library for TypeScript.
- `esbuild` (exact version): builds the single IIFE file of the markdown-it plugin. With the platform `neutral`, it fails on each `node:` import, so the build checks that the plugin runs with no Node.
- `markdown-it` (exactly 15.0.1, the version that Discourse pins): the only Markdown parser (spec principle 4). It finds the code blocks and the GFM tables and splits each GFM row, as the target renderer of each flavor does. It ships its own types. The type declarations of `tbl-md` do not use them. Only the declarations of `tbl-md/markdown-it` use them.

