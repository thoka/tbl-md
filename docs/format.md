# The tbl table format

A `tbl` block is a table in a fenced code block. It replaces the GFM pipe table, because a pipe table is hard to read as text. The format was decided on 2026-10-05. The format is a variant of the record-jar and Debian control file family, with a header record and short keys.

Status: version 0.2.0 is released, with attributes (rules 13 to 16). This file now describes version 0.3.0. The rules of a `tbl` block (rules 1 to 16) and the canonical form stay as in 0.2.0. Version 0.3.0 changes how tbl-md reads and writes GFM: markdown-it reads each GFM table, a flavor names the target renderer (section Flavors), and the conversion has a new pipe rule, a new trim, and a check of the HTML of each cell. Version 0.5.0 changes the canonical form to the short keys (section Canonical form), and this file describes that form. Each valid block stays valid with the same content. The package follows these rules from version 0.3.0. Version 0.2.0 of the package follows the rules of the section "Rules of version 0.2.0" at the end of the section Conversion to and from GFM. After the first release, a change of these rules that makes a valid block invalid, or that changes its content, needs a new major version. Below 1.0.0, a minor version takes the role of the major version (`bump-minor-pre-major` of release-please).

## Example

````
```tbl
model: Model
price: Price
{align=right}
note: Note
--
m: Opus
p: $15
n: Good for research.
Second line of the same cell.
hint\: this line is text, not a key.
Note: a capital letter is never a key, so this line needs no escape.
\{this line is text, not an attribute line}
-- {#a1b2c3d4 .new}
m: Haiku
p: $1
{.cheap}
```
````

## Rules

1. The info string of the fence is exactly `tbl`. Text after `tbl` in the info string is reserved for a later version, and the parser reports it as an error. A fence of backticks and a fence of tildes are both valid. As in CommonMark, the spaces before and after the info string do not count, so `tbl   ` is valid. The language is case-sensitive, so a fence with `TBL` or `tbl-x` is no `tbl` block. An indented code block is no `tbl` block, because it has no info string.
2. The first record is always the header. Each line maps a key to a column title: `key: Title`. The order of the header lines is the column order. A header has one key at least. A title has one line, and it can be empty. Two equal keys in the header are an error. A line in the header that is not a key line or the attribute line of a column (rule 13) is an error.
3. A key has the form `[a-z0-9_-]+`. Keys are case-sensitive. A key line is a key, a colon, and then a space or the end of the line. Thus a line such as `https://example.com` is no key line. The text of a key line starts after the colon and one space. More spaces are content.
4. A separator line starts the next record. A separator line is exactly `--`, or `--`, one or more spaces or tabs, and a rest in the attribute form of rule 13: `-- {#a1b2c3d4 .new}`. The rest is the attribute block of the row. If the rest does not parse, the line is an error, never text. The row ID marker `{#a1b2c3d4}` of version 0.1 is an attribute block with only an ID. An ID has the form `[A-Za-z0-9_-]+`. Each other line that starts with `--` is text, for example `--x` or `-- text`.
5. In a data record, a line `key: text` starts a cell. The key can be any unique prefix of a header key. An exact key wins over a longer key with the same prefix.
6. Each other line continues the cell above, except a line in the attribute form (rule 13). Leading spaces of a continuation line are content. An empty line inside a cell is content.
7. Empty lines at the start of the block, directly after `--`, directly before `--`, directly before a key line, directly before the attribute line of a cell (rule 13), and before the end of the block are not content. Thus a cell never ends with an empty line. An empty line has no characters. A line of only spaces is content.
8. Keys can come in any order in a record. A missing key is an empty cell. A record with no cells is a row of empty cells.
9. Each error names the line. These are errors:
   - a key line whose key matches no header key,
   - an ambiguous prefix (the error lists the possible keys),
   - a duplicate key in a record,
   - a continuation line before the first key of a record,
   - a block with no header key, that is an empty block or a block that starts with `--` (a header of only lines that are no key lines gives an error for each of these lines instead),
   - text after `tbl` in the info string,
   - each error of the attributes (rule 16).
10. Escapes exist only at the start of a line, and all follow one rule: one backslash more than the text has. Three forms take an escape:
    - The key form: a key, one or more backslashes, a colon, and then a space or the end of the line. Example: `hint\: text` is the text `hint: text`.
    - The separator form: one or more backslashes, `--`, and then nothing, or one or more spaces or tabs and a rest in the attribute form (rule 13), also a rest that does not parse. Example: `\--` is the text `--`, and `\-- {.x}` is the text `-- {.x}`.
    - The attribute form: one or more backslashes, and then the rest of a line in the attribute form. Example: `\{.x}` is the text `{.x}`.

    The parser removes one backslash from each line of these forms. The renderer adds one backslash to each content line of these forms, also to a line that has backslashes already. Thus `hint\\: text` is the text `hint\: text`, and each text survives the round trip. A line of other forms keeps each backslash.
11. Cell text is inline Markdown.
12. A line ends with LF, CRLF, or CR, as in CommonMark. A title or a cell holds no CR. The parser reads all three line ends. The renderer writes LF, and a rewrite of a file keeps the line end of that file.
13. Attributes. An attribute block describes a column, a row, or a cell. A line is in the attribute form if its first character is `{` and its last character other than a space or a tab is `}`. Spaces and tabs after the `}` are not part of the block. An attribute block follows the thing that it describes:
    - A line in the attribute form directly after a header key line, with no empty line between them, describes the column of that key.
    - A line in the attribute form as the last line of a cell describes the cell. Empty lines before it are not content, so the text of the cell ends at its last line before the attribute line. A cell can have attributes and no text: `note:` and then `{.x}`.
    - The `--` line of a row takes the block of the row after one space: `-- {#a1 .new}`.

    A column, a row, or a cell has one attribute block at most. A line in the attribute form at another place is an error: in the middle of a cell, directly after `--`, or as a second attribute line. It never falls back to text, so that a typo gives an error and not silent text. A text line in the attribute form needs the escape of rule 10. An attribute block on a key line is text: `price: $15 {.x}` is the cell text `$15 {.x}`.
14. The grammar of an attribute block. It is the subset of the attribute block that Pandoc, djot, and kramdown read the same, with the ID of rule 4 and a bare value.

    ```
    block   = "{" sp* part (sp+ part)* sp* "}"
    part    = id | class | pair
    id      = "#" [A-Za-z0-9_-]+
    class   = "." [A-Za-z][A-Za-z0-9_-]*
    pair    = key "=" value
    key     = [A-Za-z][A-Za-z0-9_-]*
    value   = bare | quoted
    bare    = [A-Za-z0-9_:-]+
    quoted  = '"' (char | '\"' | '\\')* '"'
    char    = any character except '"', '\', and a line end
    sp      = a space or a tab
    ```

    In a quoted value, `\"` is `"` and `\\` is `\`. A block has one ID at most, each class once, and each key once. The keys `id` and `class` are not allowed, because `#x` and `.x` express them. Keys are case-sensitive, as in rule 3, so `Align` and `ID` are unknown keys. A column and a cell can have an ID too. tbl-md does not check that the IDs of a table are unique, as in version 0.1. The parts keep their order, so the classes and the pairs are lists, not sets.
15. Known keys. Each attribute is kept, also an unknown key. The parser checks only the values of the known keys. The only known key is `align`. Its value is `left`, `center`, or `right`, and it is allowed only on a column, because GFM has an alignment only for a column. A later version can allow `align` on a row or a cell with no breaking change. `tbl-md lint` warns on an unknown key, unless the configuration of the project lists that key (section Configuration of `docs/cli.md`).
16. These are the errors of the attributes. Each error names the line and the column of the first bad character:

    ```tbl
    error: Error
    example: Example
    --
    er: an unexpected character
    ex: `{.hl !}`
    --
    er: no space between two parts
    ex: `{#a.b}` or `{.a#b}`
    --
    er: an empty block
    ex: `{}` or `{ }`
    --
    er: an empty ID, or a bad character in an ID
    ex: `{#}` or `{#a:b}`
    --
    er: an empty class, a class with no letter first, or a class with a bad character
    ex: `{.}` or `{.1a}`
    --
    er: a key with no letter first, or with a bad character
    ex: `{1k=v}`
    --
    er: more than one ID
    ex: `{#a #b}`
    --
    er: a repeated class
    ex: `{.a .a}`
    --
    er: a repeated key
    ex: `{k=1 k=2}`
    --
    er: the key `id` or `class` (the error names `#x` or `.x`)
    ex: `{id=x}`
    --
    er: a key with no value
    ex: `{k}` or `{k=}`
    --
    er: a bare value with a character outside `[A-Za-z0-9_:-]` (the error names the quotes)
    ex: `{k=a.b}`
    --
    er: single quotes (the error names double quotes)
    ex: `{k='a'}`
    --
    er: a quoted value with no closing quote
    ex: `{k="a}`
    --
    er: a backslash before a character other than `"` or `\` in a quoted value
    ex: `{k="a\b"}`
    --
    er: a bad value of a known key (the error lists the values)
    ex: `{align=middle}`
    --
    er: a known key at a place that does not allow it
    ex: `{align=right}` after the last line of a cell
    --
    er: a second attribute line for the same column or cell
    ex: `{.a}` on the line after `{.b}`
    --
    er: a line in the attribute form at a place that takes no attributes
    ex: `{.a}` directly after `--`, before the first header key, after an empty line in the header, or in the middle of a cell
    --
    er: a separator line whose rest is in the attribute form and does not parse
    ex: `-- {.x !}` or `-- {}`
    ```

## Canonical form

The renderer writes the canonical form, so that a parse followed by a render gives the same text. The data records use the shortest key of each column. With the shortest keys, the cell texts of a record start at the same column, so the eye reads them as a column. Mostly the short key is one letter.

The short key of a column is the shortest prefix of its header key that is the header key itself, or that is a prefix of no other header key. Rule 5 resolves it to its column. Examples:

- The keys `model`, `price`, `note` give `m`, `p`, `n`.
- The keys `error`, `example` give `er`, `ex`.
- The keys `price`, `price-2` give `price` and `price-`. The prefix `p` would be ambiguous, and `price` is the first prefix that resolves to itself, because an exact key wins (rule 5).

The canonical form has:

- the full keys in the header, and the short keys in the data records, in header order,
- no line for an empty cell,
- `key:` with no space for a cell whose first line is empty,
- no indentation, and no empty line directly before or after `--`,
- the escapes of rule 10 where they are necessary,
- an attribute block as `{#id .c1 .c2 k1=v1 k2="v 2"}`: the ID first, then the classes, then the pairs, as the Pandoc writer orders them. The classes and the pairs keep their order. One space between the parts, no space after `{` and before `}`, and nothing after `}`. A value of the form `[A-Za-z0-9_:-]+` is bare. Each other value, also the empty value, has double quotes, and inside the quotes `"` becomes `\"` and `\` becomes `\\`,
- the attribute line of a column directly after its header key line, the attribute line of a cell as its last line, and the block of a row on its `--` line. A cell with attributes and no text has its key line `key:`,
- a fence of three backticks, or one backtick more than the longest closing fence line in the block. A closing fence line is a line that CommonMark reads as a closing fence: up to three spaces, three or more backticks, and then only spaces and tabs.

## Flavors

From version 0.3.0. A GFM table has no single meaning: each renderer splits a row in its own way. A flavor names one target renderer. It is the set of markdown-it settings of that renderer, and its rules for the conversion to and from GFM. markdown-it finds the code blocks and the GFM tables of a file, and it splits each GFM row. tbl-md parses only the text inside a `tbl` block. The configuration of the project or the flag `--flavor` picks the flavor. The default is `discourse`. A flavor pins its renderer to one version, so that "renders the same" (spec principle 1) has one exact meaning.

```tbl
flavor: Flavor
renderer: Target renderer
engine: markdown-it engine
table: Table rule
--
f: `discourse`
r: Discourse at the commit [eb46cffe81257fd48d3e18c35aaba97488fe19b5](https://github.com/discourse/discourse/tree/eb46cffe81257fd48d3e18c35aaba97488fe19b5) (2026-09-18), as it cooks a post with the default site settings
e: markdown-it 15.0.1, preset `default`, options `html: true`, `xhtmlOut: false`, `breaks: true`, `linkify: true`, `typographer: true`, and the extra settings below
t: the table rule of markdown-it 15.0.1 and the link pipe rule below
--
f: `markdown-it`
r: markdown-it 15.0.1 as `markdownit()` makes it
e: markdown-it 15.0.1, preset `default`, with its default options: `html: false`, `xhtmlOut: false`, `breaks: false`, `linkify: false`, `typographer: false`
t: the table rule of markdown-it 15.0.1
```

The extra settings of `discourse` come from the default site settings of Discourse at the pinned commit:

- The typographer writes the quotes `“`, `”`, `‘`, and `’`.
- linkify knows only the top-level domains `com`, `net`, `org`, `io`, `onion`, `co`, `tv`, `ru`, `cn`, `us`, `uk`, `me`, `de`, `fr`, `fi`, and `gov`, and it has the option `fuzzyLink: true`.
- The URL decode of a link keeps the characters `;/?:@&=+$,#` and the space.

A forum can change its site settings, for example the line breaks or the quotes. The flavor `discourse` follows the defaults. Discourse has more Markdown features than the table rule, for example emoji, mentions, BBCode, and image sizes. tbl-md does not reproduce them. They change the inline content of a cell, not where a row splits, with one possible exception: a BBCode block line such as `[quote]` directly after a table can end the table in Discourse. tbl-md did not measure this.

With the flavor `markdown-it`, the option `html: false` has two effects. A `<br>` in a GFM cell shows as the text `<br>`, not as a line break. An HTML block does not end a GFM table.

### The link pipe rule of `discourse`

Discourse does not split a cell at a pipe inside a complete link or image. The reason is the image size of Discourse, `![alt|100x50](url)`. This section describes the behavior. tbl-md implements it with its own code, because the code of Discourse has the license GPL-2.0-only.

- Before markdown-it splits the rows, Discourse reads each line with the inline parser of markdown-it, one inline element after the other, from the start of the line. A code span, an autolink, raw HTML, and a backslash escape are elements of their own, so a `[` inside them starts no link.
- An element that starts with `[` or `![` is a candidate. Its link text ends at the matching `]`, by the rules of markdown-it for a link label. A link text cannot hold another link.
- The candidate is complete if directly after the `]` comes one of these: an inline destination `(...)`, where markdown-it reads the whole text as one inline link or image, for example `[x|y](url)` or `![x|100x50](url)`; or a second label `[...]`, for example `[x|y][ref]` or `[x|y][]`. The reference does not need a definition, because Discourse does this before it knows the definitions. A shortcut reference such as `[x|y]` alone is not complete.
- Each pipe from the `[` or `![` to the end of a complete link or image is text: in the link text, in the destination, in the title, and in the second label. The table rule does not split there, and it does not remove a backslash before such a pipe. Thus `` [`x\|y`](url) `` shows `x\|y` in its code span with `discourse`, but `x|y` with `markdown-it`.

## Conversion to and from GFM

The conversion goes both ways with no loss of content. If a table cannot convert without loss, the conversion fails with an error at the line, and it changes nothing. It never drops content silently. The conversion uses the flavor (section Flavors). The rules apply to both flavors, unless a rule names one.

- The header titles become the GFM header row. The keys of a GFM table are made from its titles: lower case, each run of other characters than `[a-z0-9]` becomes `-`, with no `-` at the start or the end. An empty key becomes `c1`, `c2`, and so on by column. Then the first column with a key keeps it, and a later column with the same key gets the smallest suffix `-2`, `-3`, and so on that no other column has. Thus the titles `a`, `a`, `a-2` give the keys `a`, `a-3`, `a-2`.
- The GFM text has the form `| T1 | T2 |`, then `| --- | --- |` (with the alignment marks of the columns), then one line per row, `| c1 | c2 |`. An empty cell is `|  |`. Each row has a cell for each column.
- A line break in a cell becomes `<br>`. A literal `<br>` in a cell gets one backslash more, by the rule of rule 10: `<br>` becomes `\<br>`, and `\<br>` becomes `\\<br>`. Only the exact text `<br>` with no backslash before it becomes a line break. `<br/>` and `<BR>` stay text.
- A cell line that ends with a backslash and has a next line cannot convert to GFM, because the backslash would come directly before the `<br>` of the line break. The conversion to GFM fails for it.
- A title has no line break, so a `<br>` in a title stays as it is in both directions.
- The pipe rule. The conversion to GFM writes one backslash more before each pipe of a title or a cell: `|` becomes `\|`, `\|` becomes `\\|`, and `\\|` becomes `\\\|`. The conversion to tbl removes one backslash before each pipe that has a backslash directly before it. markdown-it never splits a cell at a pipe with a backslash directly before it, and it removes that one backslash before the inline parse (section How markdown-it splits a GFM row). Thus each text with pipes converts, also in a code span. In a GFM cell, a pipe with no backslash before it is a delimiter, except where the link pipe rule of `discourse` keeps it. The conversion to tbl keeps such a pipe as it is. The price: GitHub splits a cell at a pipe after two backslashes, so a GFM table from a cell with the text `\|` does not show the same on GitHub.
- An ID marker of a row goes to the end of the first cell in GFM, after one space if the cell has text. The marker form is `{#id}` with an ID of the form `[A-Za-z0-9_-]+`, at the start of the cell or after a space, and with zero or more backslashes before the `{`. A first cell of a row with no ID that ends with the marker form gets one backslash more before the `{`, by the same rule. With an ID, the text needs no escape, because the conversion to tbl removes only the last marker. The conversion to tbl fails if the text before the marker ends with a space or a tab, because the text could not convert back.
- The attribute `align` of a column maps to the GFM alignment, in both directions: `left` is `:---`, `center` is `:---:`, `right` is `---:`, and a column with no `align` is `---`. A GFM column with an alignment gets the attribute line `{align=...}` after its header key line.
- The ID of a row goes to GFM by the ID marker rule above. Each other attribute has no GFM form: a class or a pair of a row, any attribute of a cell, and any attribute of a column other than `align`. The conversion to GFM fails for each of them, with an error at its line, unless the user gives `--drop-attributes`. With `--drop-attributes`, the conversion drops them and keeps the rest.
- The trim. markdown-it removes each character that `String.prototype.trim` of JavaScript removes, at the start and at the end of a cell: a space, a tab, a no-break space (U+00A0), each other space of the Unicode category Zs, U+FEFF, a vertical tab, and a form feed. Thus the conversion to GFM fails for a title or a cell that starts or ends with such a character.
- A tbl cell never ends with a line break (rule 7). Thus the conversion to tbl fails for a GFM cell that ends with `<br>`.
- A GFM row with fewer cells than the header has empty cells. A cell after the last column of the header is an excess cell. markdown-it drops excess cells. The conversion to tbl drops an excess cell with no text: its text between the pipes is empty or only characters of the trim. An excess cell with text fails the conversion to tbl, because markdown-it hides that text. The error names the first excess cell with text of the row.
- The conversion to tbl reads each cell text from the source, so that the inline Markdown stays byte for byte. It removes the pipes of the cell and the characters of the trim at its edges.
- The HTML check. After each conversion, the converter renders each converted table with the flavor, before and after, and compares the HTML of each title and each cell. The HTML of a GFM cell is the HTML of that cell when the flavor renders the whole GFM table. The HTML of a `tbl` cell is the HTML that the flavor gives for the cell text as inline Markdown, in the form that the conversion writes to GFM (with `<br>` for a line break, the `<br>` escape, and the ID marker), but with no pipe escape. If the HTML of a title or a cell differs, the conversion fails with an error at that cell. The check finds what the pipe rule and the trim do not cover. Examples with the flavor `discourse`: a pipe in a code span in a link, and an escaped pipe in a link destination, an image text, or a link title. The link pipe rule keeps the backslash before such a pipe, so the HTML shows it. Write the pipe as `%7C` in a URL and as `&#124;` in a text or a title.

### How markdown-it splits a GFM row

The pipe rule and the trim rest on this measurement of markdown-it 15.0.1 (2026-10-06). The table rule trims the row line (`String.prototype.trim`), and then it splits the line at each pipe with no backslash directly before it. A part loses one backslash before each pipe that it keeps. Then the rule drops an empty first part and an empty last part, and it trims each part again. Each part is a source cell. The flavor `discourse` first applies its link pipe rule.

Each case is a body row under the header `| h1 | h2 |` and `| --- | --- |`, unless it shows its own header. ⏎ marks a line end. A result shows the HTML of each rendered body cell and the number of source cells, also the excess cells. The last column shows the parser of version 0.2.0, `micromark-extension-gfm-table` 2.1.

```tbl
case: Case
source: Source
discourse: `discourse`
markdown-it: `markdown-it`
old: 0.2.0 (micromark)
--
c: leading and trailing pipe
s: `| a | b |`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: no leading and no trailing pipe
s: `a | b`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: an empty cell
s: `|  | b |`
d: (empty), `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a missing cell
s: `| a |`
d: `a`, (empty) (1 source cell)
m: as `discourse`
o: as `discourse`
--
c: an excess cell with text
s: `| a | b | c |`
d: `a`, `b` (3 source cells)
m: as `discourse`
o: as `discourse`
--
c: an escaped pipe
s: `| x\|y | b |`
d: `x|y`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a pipe after two backslashes
s: `| x\\|y | b |`
d: `x|y`, `b` (2 source cells)
m: as `discourse`
o: `x\`, `y` (3 source cells)
--
c: a pipe after three backslashes
s: `| x\\\|y | b |`
d: `x\|y`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a pipe in a code span
s: ``| `x|y` | b |``
d: `` `x ``, `` y` `` (3 source cells)
m: as `discourse`
o: as `discourse`
--
c: an escaped pipe in a code span
s: ``| `x\|y` | b |``
d: `<code>x|y</code>`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a pipe after two backslashes in a code span
s: ``| `x\\|y` | b |``
d: `<code>x\|y</code>`, `b` (2 source cells)
m: as `discourse`
o: `` `x\ ``, `` y` `` (3 source cells)
--
c: a pipe in a link text
s: `| [x|y](https://example.com) | b |`
d: `<a href="https://example.com">x|y</a>`, `b` (2 source cells)
m: `[x`, `y](https://example.com)` (3 source cells)
o: as `markdown-it`
--
c: an escaped pipe in a link text
s: `| [x\|y](https://example.com) | b |`
d: `<a href="https://example.com">x|y</a>`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a pipe in a link destination
s: `| [x](https://example.com/a|b) | b |`
d: `<a href="https://example.com/a%7Cb">x</a>`, `b` (2 source cells)
m: `[x](https://example.com/a`, `b)` (3 source cells)
o: as `markdown-it`
--
c: a pipe in a full reference link with no definition
s: `| [x|y][r] | b |`
d: `[x|y][r]`, `b` (2 source cells)
m: `[x`, `y][r]` (3 source cells)
o: as `markdown-it`
--
c: a pipe in a shortcut reference link
s: `| [x|y] | b |`
d: `[x`, `y]` (3 source cells)
m: as `discourse`
o: as `discourse`
--
c: a pipe in an image text (Discourse image size)
s: `| ![x|100x50](https://example.com/a.png) | b |`
d: `<img src="https://example.com/a.png" alt="x|100x50">`, `b` (2 source cells)
m: `![x`, `100x50](https://example.com/a.png)` (3 source cells)
o: as `markdown-it`
--
c: a pipe in a code span in a link text
s: ``| [`x|y`](https://example.com) | b |``
d: `<a href="https://example.com"><code>x|y</code></a>`, `b` (2 source cells)
m: ``[`x``, ``y`](https://example.com)`` (3 source cells)
o: as `markdown-it`
--
c: an escaped pipe in a code span in a link text
s: ``| [`x\|y`](https://example.com) | b |``
d: `<a href="https://example.com"><code>x\|y</code></a>`, `b` (2 source cells)
m: `<a href="https://example.com"><code>x|y</code></a>`, `b` (2 source cells)
o: as `markdown-it`
--
c: a pipe in an autolink
s: `| <https://example.com/a|b> | b |`
d: `&lt;<a href="https://example.com/a">https://example.com/a</a>`, `b&gt;` (3 source cells)
m: `&lt;https://example.com/a`, `b&gt;` (3 source cells)
o: as `markdown-it`
--
c: a pipe in a raw HTML attribute
s: `| <span title="x|y">z</span> | b |`
d: `&lt;span title=&quot;x`, `y&quot;&gt;z</span>` (3 source cells)
m: `&lt;span title=&quot;x`, `y&quot;&gt;z&lt;/span&gt;` (3 source cells)
o: as `discourse`
--
c: the last cell ends with an escaped pipe
s: `| a | b \|`
d: `a`, `b |` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a no-break space at the end of a cell
s: `| a`, U+00A0, `| b |`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: `a` and U+00A0, `b` (2 source cells)
--
c: a tab at the edges of a cell
s: `|`, tab, `a`, tab, `| b |`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: as `discourse`
--
c: a body line of only one pipe
s: `|`
d: (empty), (empty) (0 source cells)
m: as `discourse`
o: (empty), (empty) (1 source cell)
--
c: a header line with no pipe
s: `h1⏎| --- |⏎| a |`
d: no table
m: as `discourse`
o: `a` (1 source cell)
--
c: a header row that starts with a number sign
s: `# | h2⏎--|--⏎a | b`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: no table
--
c: a header row that starts with a list marker
s: `-   h1|h2⏎---|---⏎a|b`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: no table
--
c: a header cell with a pipe after two backslashes
s: `| h1 | x\\|y |⏎| --- | --- |⏎| a | b |`
d: `a`, `b` (2 source cells)
m: as `discourse`
o: no table
```

What follows:

- markdown-it never splits at a pipe with a backslash directly before it, also after two or more backslashes. The cell loses one backslash, also in a code span. Thus one backslash more before each pipe keeps the meaning in text and in a code span, and no pipe text needs an error.
- A code span, an autolink, and raw HTML give no protection. Only the link pipe rule of `discourse` protects a pipe, and only in a complete link or image.
- A header line with no pipe is no GFM table, also if the delimiter row has a pipe or a colon.
- A line that starts with `#` or with a list marker can be the header row of a table. markdown-it tries the table rule before the rules of a heading and a list, so the line is a heading or a list item only if no delimiter row follows.
- A body line of only `|` has no source cell. It shows a row of empty cells.
- The differences between the two flavors in the table come from the link pipe rule, from `linkify`, and from `html`. The split is the same.

### Rules of version 0.2.0

Version 0.2.0 of the package has no flavors. It reads GFM with `micromark-extension-gfm-table` 2.1, and it follows these rules in place of the pipe rule, the trim, and the HTML check above:

- micromark splits a cell at a pipe after an even number of backslashes, also none. In a code span, it removes one backslash before a pipe and keeps the others.
- A pipe after an even number of backslashes (also none) gets one backslash more in the conversion to GFM: `|` becomes `\|`, and `\\|` becomes `\\\|`. A pipe after an odd number of backslashes cannot convert to GFM, and the conversion fails for it. The conversion to tbl removes one backslash before each pipe.
- The trim removes only spaces and tabs at the edges of a cell.
- After a conversion, the converter reads the new text again (section Conversion of a file), but it does not compare the HTML of the cells.

## Conversion of a file

A conversion of a file converts each table of the other kind, and it keeps each other byte of the file. Thus a conversion to tbl converts each GFM table and keeps each `tbl` block, also an invalid one. A table inside another code block or an HTML block is no table, so it stays as it is.

- The new text replaces only the source of the table, from its first character to its last character.
- The first line of the new text starts where the table started. Each other line starts with the continuation prefix. The continuation prefix is the text from the start of the first line to the table, with each character other than `>`, a space, or a tab replaced by a space. Thus `- ` gives two spaces, `> ` gives `> `, and `> 1. ` gives `>    `. An empty line gets the continuation prefix with no spaces and tabs at its end, so that no line ends with a space.
- The new text uses the line end of the file: the first line end of the file, CRLF, LF, or CR. A file with no line end gets LF.
- A conversion to GFM fails for a `tbl` block with text after `tbl` in the info string, and for a block with parse errors. Each error is at its line in the file. An error of a cell is at the key line of the cell, also if that line has a prefix key. An error of a title is at the header key line of the title. The column of these errors is the column of the fence.
- A conversion to tbl fails at the cell of each error of the GFM table.
- After the conversion, the converter reads the new text again with the flavor. Each new table must be at the same place in the list of tables, with the new kind, and it must read back as the same table. A new GFM table reads back with the keys of its titles. Each other table must keep its kind and its text. If the check fails for a table, the conversion fails with an error at the first line of that table. Then the HTML check of each converted table follows (section Conversion to and from GFM).
- If one table fails, the whole conversion fails, and the file does not change. The errors come sorted by line and then by column.

### Where a new GFM table can stand

A GFM table has no end marker. It ends at an empty line or at the start of another block. A tbl block ends at its closing fence. Thus a conversion to GFM can change how Markdown reads the lines around the table. This measurement of markdown-it 15.0.1 with both flavors (2026-10-06) shows the cases. The flavor `discourse` with and without its link pipe rule gives the same results. `micromark-extension-gfm-table` 2.1, the parser of version 0.2.0, gives the results of `discourse` in each case.

```tbl
case: The tbl block is directly
result: Result of the conversion to GFM
--
c: after a paragraph line
r: It converts. A GFM table can interrupt a paragraph, so the line stays a paragraph.
--
c: after a paragraph line of a list item or a block quote, and the tbl block is outside of it
r: It fails. The lines of the table are lazy lines of that paragraph, so they are no table.
--
c: before a paragraph line
r: It fails. markdown-it reads the line as a row of the table.
--
c: before a line of the same list item or block quote
r: It fails. markdown-it reads the line as a row of the table.
--
c: before a lazy line after a list item or a block quote
r: It converts. A table row is never a lazy line, so the line stays outside the table.
--
c: before a heading, a list item, a block quote, a fence, a thematic break, or an indented code line
r: It converts. Another block ends the table.
--
c: before an HTML block, for example `<div>`
r: With `discourse`, it converts. With `markdown-it`, it fails, because the option `html: false` makes the line a paragraph line, and markdown-it reads it as a row.
--
c: before another tbl block or a GFM table
r: It fails. markdown-it reads the lines of the next table as rows. Only the first table gets an error.
```

The error tells the writer to add an empty line before or after the `tbl` block. A conversion to tbl has no such case, because a fence ends at its closing fence line.

Two more facts of the measurement matter for the conversion to tbl, because they decide which lines are a GFM table:

- A header line with no pipe is no table, also if a delimiter row follows.
- A line that starts with `#` or with a list marker is the header row of a table if a delimiter row with the same number of cells follows. Thus `# | h2` and then `--|--` is a table with the titles `#` and `h2`, not a heading. A heading with a pipe directly before a GFM table stays a heading, because the header row of that table is the next line.

## How the rule applies

- Agents write new tables as `tbl` blocks.
- An agent that edits a file converts the GFM tables in that file with `tbl-md convert`.
- An imported report, for example from Gemini Deep Research, gets its tables converted at import. The content stays the same.
- A chat reply has no tables at all.
- Check: `tbl-md lint` in the pre-commit hook of each project fails on a GFM table and on an invalid `tbl` block in a changed Markdown file.
