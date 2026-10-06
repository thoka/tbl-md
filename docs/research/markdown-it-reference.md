---
checked: 2026-10-06
recheck: "each new Discourse release, or a change of markdown-it or of features/table.js in Discourse"
decisions:
  - "tbl-md step 16 (proposal): the reference parser is markdown-it 15.0.1 as Discourse eb46cffe (2026-09-18) uses it to cook a post. It has the preset default, four options, and the table feature of Discourse"
  - "tbl-md step 16 (proposal): a wrapper of the markdown-it table rule records the source of each table line. fromGfm splits each line again and gets the source of each cell. A check against the token content turns each difference into an error"
  - "tbl-md step 16 (proposal): new text for principles 1, 4, and 5 of docs/spec.md and for the pipe rules of docs/format.md. The user approves it in step 17"
---

# markdown-it with the settings of Discourse as the reference parser

Research and measurement on 2026-10-06 for step 16 of `docs/PLAN.md`. No paid API. No key file was read. No change of `src/`.

This report uses ASD-STE100 Simplified Technical English as a guide. No tool can make sure that a text obeys ASD-STE100 fully.

Marks:

- "[file]" is a file of the Discourse checkout `~/dv/discourse/discourse` at commit `eb46cffe81257fd48d3e18c35aaba97488fe19b5` (2026-09-18). This research read the file. The path is relative to the repository root, with line numbers.
- "[measured]" is a fact that this research measured on this machine with `mise run corpus-markdown-it` or with `test/markdown-it.test.ts`.
- "[guess]" is a statement without a source. Test it before a decision rests on it.

Related work: `docs/research/discourse-integration.md` (the plugin path, at a later Discourse commit `f18a198`), `docs/research/table-corpus.md` (the corpus), and the lesson `~/dv/meta/agents/lessons/spec-names-target-renderer.md`. The search of the lessons and of `~/dv/meta/agents/research-index.md` for markdown-it and Discourse found only that lesson. This report does not copy them.

## Question

The user decided that markdown-it with the settings of Discourse becomes the root of tbl-md (decision 4 in `docs/PLAN.md`). Before the spec changes, step 16 asks:

1. Which markdown-it version, preset, options, rules, and plugins does Discourse use to cook a post? What changes the table rule? What differs between the server and the client?
2. How many tables of the corpus of step 10 do markdown-it and micromark see in a different way, and of which kind?
3. How does markdown-it split a GFM row, compared with `docs/format.md` and micromark?
4. markdown-it gives only line numbers. How can `fromGfm` get the exact source of each cell?
5. Which new text do principles 1, 4, and 5 of `docs/spec.md` and the GFM rules of `docs/format.md` need?

## Short answer

```tbl
q: Question
a: Answer
--
q: 1. Discourse settings
a: markdown-it 15.0.1, preset `default` (all rules on, also `table` and `strikethrough`), options `html: true`, `breaks: true`, `linkify: true` with 17 TLDs and `fuzzyLink`, `typographer: true` with curly quotes. The table feature of Discourse adds one change to the split: a pipe inside a complete link or image never splits a cell. Server and client run the same engine code.
--
q: 2. Corpus
a: 586 tables by micromark, 567 by markdown-it, 557 by both. 45 tables differ, all in the parser fixtures of micromark, markdown-it, and pulldown-cmark. No table of the 9 real files (207 tables) and of the other fixtures differs. The kinds: a header line with no pipe (29, only micromark), a pipe after two backslashes (10 tables), a header line that starts with `#` or `-` (3, only markdown-it), and a body line of only `|` (3, same output).
--
q: 3. Row split
a: markdown-it never splits at a pipe that has a backslash directly before it, also after two backslashes. It removes that one backslash. micromark splits after an even number of backslashes. A header line with no pipe gives no table in markdown-it. The other rules of `docs/format.md` (excess cells, missing cells, trim, code spans) stay true.
--
q: 4. Cell positions
a: Wrap the markdown-it table rule to record the source of each table line, and split the line again with the split function of markdown-it. 17207 cells of the corpus had 0 differences against the token content [measured].
--
q: 5. Spec
a: Section "Proposal" at the end. In short: "renders the same" means the same HTML from the reference engine; the only Markdown parser is markdown-it; the pipe rule becomes "one backslash more before each pipe".
```

## 1. How Discourse cooks a post

### Version

- `frontend/discourse-markdown-it/package.json:23` asks for `"markdown-it": "^15.0.1"` [file]. The server bundle asks for the same range in `frontend/pretty-text-processor/package.json:13` [file].
- `pnpm-lock.yaml:5916-5918` and `pnpm-lock.yaml:14174-14177` resolve it to `markdown-it@15.0.1`, with `entities 8.0.0` and `argparse 3.0.1` [file].
- The lock file also has `markdown-it@14.3.1` (`pnpm-lock.yaml:5912`). Only the development tools `markdown-it-terminal` and `markdown-it-anchor` use it (`pnpm-lock.yaml:9287`, `13761`) [file].
- `frontend/discourse-markdown-it/node_modules/markdown-it` is a link to `markdown-it@15.0.1` [file].
- `pnpm-workspace.yaml:68-75` lists the patched dependencies. markdown-it is not one of them [file].

### Preset and options

`frontend/discourse-markdown-it/src/setup.js:164-187` makes the engine [file]:

```
html: true
breaks: !traditional_markdown_linebreaks
xhtmlOut: false
linkify: enable_markdown_linkify
typographer: enable_markdown_typographer
```

`frontend/discourse-markdown-it/src/engine.js:83-90` makes the engine in one of two ways [file]. If the caller gives a rule list, it uses `markdownit("zero", options).enable(markdownItRules)`. If not, it uses `markdownit(options)`, which is the preset `default`. A post gives no rule list: `lib/pretty_text.rb:207` sets `markdownItRules` only from the option `markdown_it_rules` [file]. Only chat, post voting, events, and the reviewable serializer give that option (search of the repository for `markdown_it_rules`) [file].

The defaults of the site settings in `config/site_settings.yml:1516-1545` [file]:

```tbl
setting: Site setting
default: Default
effect: Effect in the engine
--
setting: `traditional_markdown_linebreaks`
default: `false`
effect: `breaks: true`. A line end in a paragraph becomes `<br>`.
--
setting: `enable_markdown_typographer`
default: `true`
effect: `typographer: true`. Quotes and dashes change.
--
setting: `enable_markdown_linkify`
default: `true`
effect: `linkify: true`. A bare URL becomes a link.
--
setting: `markdown_linkify_tlds`
default: `com|net|org|io|onion|co|tv|ru|cn|us|uk|me|de|fr|fi|gov`
effect: `engine.js:23-25` gives these TLDs to linkify-it and sets `fuzzyLink: true`.
--
setting: `markdown_typographer_quotation_marks`
default: `“|”|‘|’` (German: `„|“|‚|‘`)
effect: `engine.js:16-21` sets the quotes of the typographer.
```

`engine.js:92-96` also changes the characters that the URL decode keeps (`;/?:@&=+$,# `) [file].

### Rules and features

Discourse enables each of its 21 core features by default (`frontend/discourse-markdown-it/src/features/index.js:23-45`, `setup.js:111-132`) [file]. Each feature can add markdown-it rules. These change tables or the lines next to them:

- `features/table.js:96-108` adds two core rules: `protect_link_pipes` after `normalize` and `restore_link_pipes` after `block` [file]. Before the block parse, it replaces each pipe inside a complete link or image of a line with `\0`. After the block parse, it puts the pipes back. Thus a pipe inside `[x|y](url)`, `![alt|100x50](url)`, or `[x|y][ref]` never splits a cell. The commit `5a117324bb1` of 2026-08-25 ("FIX: Preserve pipes in Markdown table cells") added this. The reason is the image size syntax of Discourse, `![alt|100x50](url)` [file].
- `features/table.js:101-107` wraps each table in `<div class="md-table">` [file].
- `features/table.js:110-141` is the allow list of the sanitizer for tables [file]. It allows the table elements, `colspan`, and `rowspan`. Of the styles, it allows only `text-align:left`, `text-align:center`, and `text-align:right`.
- `features/bbcode-block.js:429-434` adds a block rule with the alt list `paragraph`, `reference`, `blockquote`, and `list` [file]. The table rule uses the rules of the alt list `blockquote` as terminators of a body row. Thus a line such as `[quote]` or `[details=x]` directly after a table ends the table. This is a [guess] from the code. This research did not measure it.
- `features/paragraph.js:89` replaces the paragraph rule. It only marks a leading space for oneboxes and does not change tables [file].

The other features change only the inline content of a cell, not the table structure [file]. Examples are emoji, mentions, hashtags, censored words, watched words, inline BBCode, and the typographer replacements. This research read the list of rules that each feature adds.

### Server and client

The server and the client run the same code:

- Server: `lib/pretty_text.rb:170-219` calls `__PrettyText.cook` in a mini_racer (V8) context [file]. `frontend/pretty-text-processor/pretty-text-ruby-interface.js:93-116` calls `DiscourseMarkdownIt.withCustomFeatures(loadPluginFeatures()).withOptions(optInput)` and `cook` [file].
- Client: `frontend/discourse/app/static/markdown-it/index.js:7-17` calls the same `DiscourseMarkdownIt.withCustomFeatures(loadPluginFeatures(), omitFromDefault).withOptions(...)` [file].

The differences:

- The server reads the site settings with `SiteSetting.client_settings_hash` (`lib/pretty_text.rb:188`). The client reads the site settings of the browser session (`frontend/discourse/app/static/markdown-it/options.js:5-21`). The values are the same [file].
- The server gives the allowed iframes after a plugin modifier. The client takes them from the site settings (`frontend/discourse-markdown-it/src/options.js:69-76`). This does not change tables [file].
- The server loads only the files under `discourse-markdown/` of each plugin (`lib/pretty_text.rb:104-116`). The client also loads plugin modules under `/markdown-it/` (`frontend/discourse/app/static/markdown-it/features.js:9-12`). A plugin that puts a markdown feature only under `/markdown-it/` thus changes only the preview [file].
- The rich text editor (ProseMirror) has its own table parse and serializer. Its serializer writes `\|` for each pipe in a cell (`frontend/discourse/app/static/prosemirror/extensions/table.js:172`) [file]. This matters for decision 7 of the plan, not for the cook.

### What the measurement reproduces

`corpus/markdown-it-lib.ts` (`discourseEngine`) makes markdown-it 15.0.1 with the preset, the options, the quotes, the TLDs, `fuzzyLink`, and the URL decode characters above. It runs the table feature of Discourse itself: `corpus/markdown-it.ts` downloads `features/table.js` at the pinned commit into the cache (`~/.cache/tbl-md/corpus/discourse/discourse/<commit>/...`), checks its SHA-256, and loads it. The file is GPL-2.0-only, so it does not go into this MIT repository.

Not reproduced: the other 20 features of Discourse and the plugins of a forum, because they need the Discourse runtime (site settings, lookups, the allow lister). Of these, only the BBCode block rule can change a table, by the end of a table at a BBCode line. The sanitizer is not reproduced either. It does not change the table structure.

## 2. The corpus: markdown-it against micromark

`mise run corpus-markdown-it` reads each document of the step 10 corpus [measured]. It finds the GFM tables with micromark (`findTables` of `src/markdown.ts`). It finds them again with the Discourse engine. It pairs the tables by the line of the header row. For each table, it compares these properties:

- the number of rows, of header cells, and of source cells in each row,
- the source text of each cell, with no pipes and no spaces at the edges,
- the alignment.

```tbl
source: Source
mm: micromark
mi: markdown-it
diff: Tables that differ
--
source: github/cmark-gfm (fixtures)
mm: 26
mi: 26
diff: 0
--
source: micromark/micromark-extension-gfm-table (fixtures)
mm: 60
mi: 32
diff: 29
--
source: markdown-it/markdown-it (fixtures)
mm: 24
mi: 27
diff: 4
--
source: pulldown-cmark/pulldown-cmark (fixtures)
mm: 31
mi: 37
diff: 12
--
source: goldmark, remark-gfm, prettier, markdownlint (fixtures)
mm: 238
mi: 238
diff: 0
--
source: 9 real files (public-apis, kubernetes, node, system-design-primer, rust, ossu, vscode-docs, kubernetes website, azure-docs)
mm: 207
mi: 207
diff: 0
--
source: Total (148 documents with a table)
mm: 586
mi: 567
diff: 45
```

The kinds of difference. A table can have more than one kind:

```tbl
kind: Kind
n: Tables
cause: Cause
example: Example
--
kind: only micromark finds a table
n: 29
cause: The header line has no pipe. micromark accepts it if the delimiter row has a pipe or a colon. markdown-it needs a pipe in the header line.
example: `a` then `:-:`, in `micromark-extension-gfm-table/test/fixtures/align.md:56` and 21 cases of `interrupt.md`
--
kind: only markdown-it finds a table
n: 10
cause: 7 tables: a header cell has a pipe after two backslashes. markdown-it does not split there, so the header and the delimiter row have the same number of cells. micromark splits, so the counts differ. 2 tables: the header line starts with `#`. 1 table: the header line starts with a list marker. markdown-it tries the table rule before the heading and the list rules.
example: `` | Double | `\\|` | `` in `pulldown-cmark/specs/table.txt:525`; `# | 1 | 2` in `markdown-it/test/fixtures/markdown-it/tables.txt:305`; `-   foo|foo` in `tables.txt:147`
--
kind: a different number of cells in a row
n: 6
cause: 3 tables: a body cell has a pipe after two backslashes (see above). 3 tables: a body line of only `|`. micromark sees one empty cell, markdown-it no cell. Both show a row of empty cells.
example: `` `Cell 3\\|` `` in `tables.txt:546`; `|` in `pulldown-cmark/specs/table.txt:599`
--
kind: a different cell text
n: 3
cause: The same 3 tables with a pipe after two backslashes in a body cell.
example: micromark `C \\` and `Charlie`, markdown-it `C \\| Charlie`, in `micromark-extension-gfm-table/test/fixtures/some-escapes.md:3`
--
kind: a different number of rows or header cells, or a different alignment
n: 0
cause: none
example: none
```

With and without the table feature of Discourse, markdown-it gives the same tables for each document of the corpus [measured with a scratch script]. Thus the link pipe protection of Discourse changes no table of the corpus. The fixtures do not use a pipe inside a link, because GFM splits there.

Result: for the real tables of the corpus, the change of the parser changes nothing. The differences are in the edge cases that the parser fixtures test on purpose.

## 3. How markdown-it splits a GFM row

The split function of markdown-it is `escapedSplit` in `src/rules_block/table.ts` (in the package: `dist/markdown-it.mjs:1491-1514`) [file of the npm package]. A pipe is a delimiter unless the character directly before it is a backslash. If a backslash is directly before it, the part loses that one backslash and the pipe stays in the part. Before the split, the rule trims the line with `String.prototype.trim`. After the split, it removes an empty first part and an empty last part. Then it trims each part again. `corpus/markdown-it-lib.ts` has the same function with offsets (`escapedSplit`, `splitRow`).

The hand-written cases of `corpus/markdown-it.ts` (`mise run corpus-markdown-it --cases`), rendered with the Discourse engine and with micromark. A row case stands under the header `| h1 | h2 |` and `| --- | --- |`. Each result shows the HTML of each rendered body cell and the number of source cells, also the excess cells [measured]:

```tbl
case: Case
source: Source row
markdown-it: markdown-it
micromark: micromark
--
case: leading and trailing pipe
source: `| a | b |`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: no leading and no trailing pipe
source: `a | b`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: no trailing pipe
source: `| a | b`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: spaces after the last pipe
source: `| a | b |   `
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: an empty cell
source: `|  | b |`
markdown-it: (empty), `b` (source cells: 2)
micromark: (empty), `b` (source cells: 2)
--
case: a missing cell
source: `| a |`
markdown-it: `a`, (empty) (source cells: 1)
micromark: `a`, (empty) (source cells: 1)
--
case: an excess cell with text
source: `| a | b | c |`
markdown-it: `a`, `b` (source cells: 3)
micromark: `a`, `b` (source cells: 3)
--
case: an excess cell with no text
source: `| a | b |  |`
markdown-it: `a`, `b` (source cells: 3)
micromark: `a`, `b` (source cells: 3)
--
case: an escaped pipe
source: `| x\|y | b |`
markdown-it: `x|y`, `b` (source cells: 2)
micromark: `x|y`, `b` (source cells: 2)
--
case: a pipe after two backslashes
source: `| x\\|y | b |`
markdown-it: `x|y`, `b` (source cells: 2)
micromark: `x\`, `y` (source cells: 3)
--
case: a pipe after three backslashes
source: `| x\\\|y | b |`
markdown-it: `x\|y`, `b` (source cells: 2)
micromark: `x\|y`, `b` (source cells: 2)
--
case: a pipe in a code span
source: ``| `x|y` | b |``
markdown-it: `` `x ``, `` y` `` (source cells: 3)
micromark: `` `x ``, `` y` `` (source cells: 3)
--
case: an escaped pipe in a code span
source: ``| `x\|y` | b |``
markdown-it: `<code>x|y</code>`, `b` (source cells: 2)
micromark: `<code>x|y</code>`, `b` (source cells: 2)
--
case: a pipe after two backslashes in a code span
source: ``| `x\\|y` | b |``
markdown-it: `<code>x\|y</code>`, `b` (source cells: 2)
micromark: `` `x\ ``, `` y` `` (source cells: 3)
--
case: a pipe in a link text
source: `| [x|y](https://example.com) | b |`
markdown-it: `<a href="https://example.com">x|y</a>`, `b` (source cells: 2)
micromark: `[x`, `y](https://example.com)` (source cells: 3)
--
case: an escaped pipe in a link text
source: `| [x\|y](https://example.com) | b |`
markdown-it: `<a href="https://example.com">x|y</a>`, `b` (source cells: 2)
micromark: `<a href="https://example.com">x|y</a>`, `b` (source cells: 2)
--
case: a pipe in an image text (Discourse image size)
source: `| ![x|100x50](https://example.com/a.png) | b |`
markdown-it: `<img src="https://example.com/a.png" alt="x|100x50">`, `b` (source cells: 2)
micromark: `![x`, `100x50](https://example.com/a.png)` (source cells: 3)
--
case: a pipe in an autolink
source: `| <https://example.com/a|b> | b |`
markdown-it: `&lt;<a href="https://example.com/a">https://example.com/a</a>`, `b&gt;` (source cells: 3)
micromark: `&lt;https://example.com/a`, `b&gt;` (source cells: 3)
--
case: a pipe in a raw HTML attribute
source: `| <span title="x|y">z</span> | b |`
markdown-it: `&lt;span title=&quot;x`, `y&quot;&gt;z</span>` (source cells: 3)
micromark: `&lt;span title=&quot;x`, `y&quot;&gt;z</span>` (source cells: 3)
--
case: the last cell ends with an escaped pipe
source: `| a | b \|`
markdown-it: `a`, `b |` (source cells: 2)
micromark: `a`, `b |` (source cells: 2)
--
case: the last cell ends with two backslashes and a pipe
source: `| a | b \\|`
markdown-it: `a`, `b |` (source cells: 2)
micromark: `a`, `b \` (source cells: 2)
--
case: a no-break space at the end of a cell
source: `| a | b |`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a `, `b` (source cells: 2)
--
case: a tab at the edge of a cell
source: `|	a	| b |`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: a body line with no pipe
source: `text`
markdown-it: `text`, (empty) (source cells: 1)
micromark: `text`, (empty) (source cells: 1)
--
case: a body line of only one pipe
source: `|`
markdown-it: (empty), (empty) (source cells: 0)
micromark: (empty), (empty) (source cells: 1)
--
case: a header line with no pipe
source: `h1⏎| --- |⏎| a |`
markdown-it: no table
micromark: `a` (source cells: 1)
--
case: a header line with no pipe and a delimiter row with a colon
source: `h1⏎:-:⏎a`
markdown-it: no table
micromark: `a` (source cells: 1)
--
case: a delimiter row that starts with a dash and a space
source: `h1 |⏎- |⏎a |`
markdown-it: no table
micromark: no table
--
case: a header row that starts with a number sign
source: `# | h2⏎--|--⏎a | b`
markdown-it: `a`, `b` (source cells: 2)
micromark: no table
--
case: a header row that starts with a list marker
source: `-   h1|h2⏎---|---⏎a|b`
markdown-it: `a`, `b` (source cells: 2)
micromark: no table
--
case: a header cell with a pipe after two backslashes
source: `| h1 | x\\|y |⏎| --- | --- |⏎| a | b |`
markdown-it: `a`, `b` (source cells: 2)
micromark: no table
--
case: a header with more cells than the delimiter row
source: `| h1 | h2 | h3 |⏎| --- | --- |⏎| a | b |`
markdown-it: no table
micromark: no table
--
case: a table directly after a paragraph line
source: `text⏎| h1 | h2 |⏎| --- | --- |⏎| a | b |`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
--
case: a paragraph line directly after the table
source: `| a | b |⏎text`
markdown-it: `a`, `b` (source cells: 2); `text`, (empty) (source cells: 1)
micromark: `a`, `b` (source cells: 2); `text`, (empty) (source cells: 1)
--
case: a block quote line directly after the table
source: `| a | b |⏎> quote`
markdown-it: `a`, `b` (source cells: 2)
micromark: `a`, `b` (source cells: 2)
```

The differences from `docs/format.md` and from micromark:

```tbl
rule: Rule of docs/format.md (micromark)
mi: markdown-it with the settings of Discourse
--
rule: GFM splits at a pipe after an even number of backslashes, also none.
mi: markdown-it splits only at a pipe with no backslash directly before it. A pipe after one, two, or three backslashes never splits. The cell loses one backslash before that pipe.
--
rule: In a code span, micromark removes one backslash before a pipe and keeps the others.
mi: The same result, because markdown-it removes the backslash at the split, before the inline parse. `` `x\\|y` `` is one code span `x\|y` in markdown-it and two cells in micromark.
--
rule: (none) micromark splits a cell at a pipe inside a link or an image.
mi: With the table feature of Discourse, a pipe inside a complete link or image does not split the cell. `![x|100x50](url)` is one cell. Plain markdown-it splits there.
--
rule: GFM removes the spaces and the tabs at the edges of a cell.
mi: markdown-it removes each Unicode space at the edges, also U+00A0 (no-break space), because it uses `String.prototype.trim`.
--
rule: (none) A header line with no pipe and a delimiter row with a pipe or a colon is a table in micromark.
mi: It is no table. The header line must have a pipe.
--
rule: (none) A line that starts with `#` or with a list marker is a heading or a list item in micromark.
mi: If a delimiter row follows, markdown-it reads it as the header row of a table.
--
rule: (none) A body line of only `|` has one empty cell in micromark.
mi: It has no cell. Both show a row of empty cells.
--
rule: Excess cells and missing cells, leading and trailing pipes, spaces after the last pipe, a pipe in an autolink or in an HTML attribute.
mi: The same result as micromark.
--
rule: A table can interrupt a paragraph. A paragraph line directly after a table is a row. A block quote line ends the table.
mi: The same result as micromark for these three cases. The measurement of the section "Where a new GFM table can stand" needs a repeat with markdown-it in step 18.
```

The pipe rule in short. With markdown-it, two backslashes and one backslash before a pipe give the same text outside a code span. Inside a code span, they give a different text. A simple rule follows: the conversion to GFM adds one backslash before each pipe, and the conversion to tbl removes one backslash before each pipe that has one. No pipe text then needs an error. The rule of the rich text editor of Discourse is the same: it writes `\|` for each pipe (section 1).

The price: the GFM text of a cell with `\|` is `\\|`, and GitHub (micromark, cmark-gfm) splits that cell. The current rule fails the conversion for this text, so its GFM output works on GitHub too.

## 4. The source of each cell with markdown-it

markdown-it gives a block token only a line map (`token.map`). The inline token of a cell has only the text after the split. But `fromGfm` must read each cell from the source. Then the inline Markdown stays byte for byte (`docs/format.md`, section "Conversion to and from GFM").

```tbl
option: Option
how: How it works
good: Good
bad: Bad
--
option: A. A wrapper of the table rule and a re-split
how: Replace the table rule with a function that calls the original rule. If the rule makes a table, the function records for each table line the offset `bMarks[line] + tShift[line]` and the line text. Then split each line again with the split function of markdown-it, with offsets. The column in the line stays the same after the normalize of markdown-it, so the offset in the original source follows from the line and the column.
good: The original rule makes all tokens, so the output stays the same. Containers (block quote, list item), CRLF, tabs, and the link pipe protection of Discourse work with no extra code, because the wrapper reads `state.src` at the time of the block rule. A check compares each re-split cell with the content of its token, so a change of markdown-it gives an error, never a wrong position.
bad: It copies the split function (20 lines). It reads the original rule from the private field `md.block.ruler.__rules__`.
--
option: B. A fork of the table rule
how: Copy the table rule (MIT, about 130 lines) and add the offsets of each cell to its tokens.
good: The offsets come from the split itself.
bad: The fork does not get the fixes of markdown-it. The fork must stay in step with each markdown-it release.
--
option: C. Search the token content in the source line
how: Find the content of each inline token in the line, from the end of the cell before.
good: No copy of markdown-it code.
bad: The content has one backslash less before each escaped pipe, so it is often not a substring of the line. Two equal texts in a row make the search ambiguous.
--
option: D. Positions from markdown-it itself
how: markdown-it adds column positions to its tokens.
good: No own code.
bad: markdown-it 15 has no column positions. A change upstream is not in our control [guess: no open issue was checked].
```

Recommendation: option A. `corpus/markdown-it-lib.ts` has it (`recordTableLines`, `splitRow`, `markdownItTables`). On the corpus, the check found 0 differences in 17207 cells [measured]. `test/markdown-it.test.ts` tests it in a block quote, in a list item, with CRLF line ends, and with escaped pipes [measured]. The wrapper must give the alt list `paragraph` and `reference` again, because `Ruler.at` replaces the alt list.

## Critical analysis

1. **The premises of the question.** The question takes for granted that one renderer is the reference for "renders the same". A Markdown file in a repository has more than one reader: GitHub (cmark-gfm), the editor preview (often markdown-it in VS Code), Markgraf, and Discourse. A reference parser makes one of them the judge, and the others can show a different table. The question also takes for granted that the settings of Discourse stay stable. The link pipe protection is from 2026-08-25, so the reference moved 6 weeks ago. A pin to a Discourse commit makes the reference exact, but it also makes it old.
2. **The standard solution and its control mechanisms.** The standard solution is GFM as GitHub defines it (the GFM spec and cmark-gfm). GitHub controls that spec. If its product needs a change, GitHub changes the spec. Discourse controls the second reference, the markdown-it pipeline with its own features (centralization of the format in the hand of a platform). The table feature of Discourse is GPL-2.0-only, so an MIT tool cannot copy its code. tbl-md must load it at run time from a Discourse checkout, or reimplement its behavior from a description.
3. **The autonomous alternatives.** markdown-it has the MIT license. It has 6 small runtime dependencies (MIT, and BSD-2-Clause for `entities`). It runs on Node, on Bun, and in a browser. The pin to a Discourse commit and the corpus measurement make each change of the reference visible. The `tbl` block itself is the exit: it is plain text that each renderer shows as a code block, and `tbl-md convert --to gfm` gives a GFM table back. A self-hosted Discourse (GPL-2.0) keeps the forum in the hand of the user.
4. **The cost of autonomy.** Each Discourse release can change the reference. Someone must run `mise run corpus-markdown-it` again and update the pin, perhaps each month [guess]. The link pipe protection needs a clean-room reimplementation in tbl-md, or a load from Discourse, which a CLI user does not have. The simple pipe rule gives GFM text that GitHub splits in one rare case (a cell with `\|`). The wrapper of option A reads a private field of markdown-it and can break with a new major version of markdown-it. The check against the token content makes such a break visible, but a person must fix it.

## Proposal for step 17

Only a proposal. The user approves the spec text in step 17. `docs/spec.md` and `docs/format.md` stay unchanged in this step.

### Principles of docs/spec.md

Principle 1, new last sentences (the first sentences stay):

> Reversible: a switch to tbl-md must be reversible. A conversion of a file to `tbl` and back to GFM gives a file that renders the same in the reference renderer. The reference renderer is markdown-it with the settings of Discourse, pinned to a Discourse commit (`docs/research/markdown-it-reference.md`). "Renders the same" means the same HTML for each table and for the text outside the tables. Layout of the GFM text, such as padding, column widths, and the escapes of pipes, can change. A corpus of real tables from other projects tests this.

Principle 4, new text:

> Small surface. The library has one runtime dependency for Markdown: markdown-it, at the version that the pinned Discourse commit uses. The library and the CLI run on Node and on Bun. The markdown-it plugin of tbl-md also runs in a browser and in the mini_racer context of Discourse, with no `node:` module.

Principle 5, new text:

> Established parser for Markdown. markdown-it, configured as Discourse configures it to cook a post, finds the code blocks and the GFM tables. tbl-md parses only the text inside a `tbl` block. Where Discourse changes the table rule (the link pipe protection), tbl-md follows Discourse.

### GFM rules of docs/format.md

In the section "Conversion to and from GFM", replace the pipe rule:

> A pipe in a cell gets one backslash more: `|` becomes `\|`, and `\|` becomes `\\|`. The conversion to tbl removes one backslash before each pipe that has a backslash directly before it. markdown-it never splits a cell at a pipe that has a backslash directly before it, and it removes that one backslash before the inline parse. Thus each text with pipes converts, also in a code span. A GFM table with `\\|` does not show the same on GitHub, because GFM splits there.

Replace the rule on the edges of a cell:

> markdown-it removes each Unicode space at the start and at the end of a cell (`String.prototype.trim`), also a no-break space. Thus the conversion to GFM fails for a title or a cell that starts or ends with such a character.

Add a rule on the read-back:

> After the conversion, the converter renders each table with the reference renderer, before and after. If the HTML of a cell differs, the conversion fails at that cell. This check finds the edge cases of the pipe rule. An example is a pipe in a code span inside a link. The link pipe protection of Discourse does not split at that pipe, and it keeps the backslash.

Replace the section "How micromark splits a GFM row" with the table of section 3 of this report. That table has the measurement of markdown-it 15.0.1 with the table feature of Discourse. Measure the cases of the section "Where a new GFM table can stand" again with markdown-it. Add two notes:

- A header line with no pipe is no GFM table.
- A line that starts with `#` or with a list marker can be the header row of a table.

Open points for the user in step 17:

1. The simple pipe rule gives up the GitHub form of a cell with `\|`. The alternative keeps the current rule. Then the conversion to GFM fails for a pipe after an odd number of backslashes. Also, the conversion to tbl must fail for a pipe after two or more backslashes (an even number), because that text cannot convert back. Value analysis: the simple rule serves "human editing first" (principle 0) and Discourse as the root (decision 4). The current rule serves the GitHub readers of a repository. The choice settles a priority between Discourse and GitHub as renderers, which the canon does not state yet.
2. The link pipe protection is GPL-2.0-only code. The behavior is: a pipe inside a complete link or image does not split. tbl-md must write its own code for this behavior. Or it leaves the behavior out. Then a CLI run splits at a pipe where Discourse does not split. [guess] A reimplementation from the description in this report is about 60 lines with the public inline API of markdown-it (`md.inline.skipToken`, `md.helpers.parseLinkLabel`).

## Sources

Each source was read on 2026-10-06.

1. Discourse source, `discourse/discourse`, commit `eb46cffe81257fd48d3e18c35aaba97488fe19b5` (2026-09-18), local checkout `~/dv/discourse/discourse`. The "[file]" marks point into it. https://github.com/discourse/discourse/tree/eb46cffe81257fd48d3e18c35aaba97488fe19b5
2. Discourse commit `5a117324bb1a600c98a83689fb7533deb1f0bba4`, "FIX: Preserve pipes in Markdown table cells (#42791)", 2026-08-25. https://github.com/discourse/discourse/commit/5a117324bb1a600c98a83689fb7533deb1f0bba4
3. markdown-it 15.0.1, npm package, file `dist/markdown-it.mjs` (table rule at lines 1484-1618, normalize at lines 999-1007, block rule list at lines 2364-2431, `Ruler.at` at lines 643-649). https://github.com/markdown-it/markdown-it
4. micromark-extension-gfm-table 2.1.2 and micromark 4.0.3, npm packages, as `docs/format.md` measured them.
5. The step 10 corpus, `corpus/sources.json`, and `docs/research/table-corpus.md`.
6. skills.sh: `docs/research/discourse-integration.md` searched it for `markdown-it` on 2026-10-06 and found no skill for markdown-it plugins. This report did not search again.
