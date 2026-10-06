# The tbl table format

A `tbl` block is a table in a fenced code block. It replaces the GFM pipe table, because a pipe table is hard to read as text. The user decided the format on 2026-10-05. The first copy of this file came from `~/dv/markgraf/docs/tbl-format.md`. The research behind the format is `~/dv/markgraf/docs/research/readable-table-syntax.md`. The format is a variant of the record-jar and Debian control file family, with a header record and short keys.

Status: version 0.1.0 is released. This file now describes version 0.2.0, which adds attributes (rules 13 to 16). Since step 12 of `docs/PLAN.md`, the parser and the renderer follow version 0.2.0. Since step 13, the conversion to and from GFM follows version 0.2.0 too. Each change of the rules has an entry in `docs/review-queue.md`. After the first release, a change of these rules that makes a valid block invalid, or that changes its content, needs a new major version. Below 1.0.0, a minor version takes the role of the major version (`bump-minor-pre-major` of release-please).

## Example

````
```tbl
model: Model
price: Price
{align=right}
note: Note
--
model: Opus
price: $15
note: Good for research.
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
14. The grammar of an attribute block. It is the subset of the attribute block that Pandoc, djot, and kramdown read the same, with the ID of rule 4 and a bare value. The research is `docs/research/attribute-block.md`.

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
15. Known keys. Each attribute is kept, also an unknown key. The parser checks only the values of the known keys. The only known key is `align`. Its value is `left`, `center`, or `right`, and it is allowed only on a column, because GFM has an alignment only for a column. A later version can allow `align` on a row or a cell with no breaking change. `tbl-md lint` warns on an unknown key, unless the configuration of the project lists that key (section Configuration of `README.md`).
16. These are the errors of the attributes. Each error names the line and the column of the first bad character:

    ```tbl
    error: Error
    example: Example
    --
    error: an unexpected character
    example: `{.hl !}`
    --
    error: no space between two parts
    example: `{#a.b}` or `{.a#b}`
    --
    error: an empty block
    example: `{}` or `{ }`
    --
    error: an empty ID, or a bad character in an ID
    example: `{#}` or `{#a:b}`
    --
    error: an empty class, a class with no letter first, or a class with a bad character
    example: `{.}` or `{.1a}`
    --
    error: a key with no letter first, or with a bad character
    example: `{1k=v}`
    --
    error: more than one ID
    example: `{#a #b}`
    --
    error: a repeated class
    example: `{.a .a}`
    --
    error: a repeated key
    example: `{k=1 k=2}`
    --
    error: the key `id` or `class` (the error names `#x` or `.x`)
    example: `{id=x}`
    --
    error: a key with no value
    example: `{k}` or `{k=}`
    --
    error: a bare value with a character outside `[A-Za-z0-9_:-]` (the error names the quotes)
    example: `{k=a.b}`
    --
    error: single quotes (the error names double quotes)
    example: `{k='a'}`
    --
    error: a quoted value with no closing quote
    example: `{k="a}`
    --
    error: a backslash before a character other than `"` or `\` in a quoted value
    example: `{k="a\b"}`
    --
    error: a bad value of a known key (the error lists the values)
    example: `{align=middle}`
    --
    error: a known key at a place that does not allow it
    example: `{align=right}` after the last line of a cell
    --
    error: a second attribute line for the same column or cell
    example: `{.a}` on the line after `{.b}`
    --
    error: a line in the attribute form at a place that takes no attributes
    example: `{.a}` directly after `--`, before the first header key, after an empty line in the header, or in the middle of a cell
    --
    error: a separator line whose rest is in the attribute form and does not parse
    example: `-- {.x !}` or `-- {}`
    ```

## Canonical form

The renderer writes the canonical form, so that a parse followed by a render gives the same text:

- full keys, in header order,
- no line for an empty cell,
- `key:` with no space for a cell whose first line is empty,
- no indentation, and no empty line directly before or after `--`,
- the escapes of rule 10 where they are necessary,
- an attribute block as `{#id .c1 .c2 k1=v1 k2="v 2"}`: the ID first, then the classes, then the pairs, as the Pandoc writer orders them. The classes and the pairs keep their order. One space between the parts, no space after `{` and before `}`, and nothing after `}`. A value of the form `[A-Za-z0-9_:-]+` is bare. Each other value, also the empty value, has double quotes, and inside the quotes `"` becomes `\"` and `\` becomes `\\`,
- the attribute line of a column directly after its header key line, the attribute line of a cell as its last line, and the block of a row on its `--` line. A cell with attributes and no text has its key line `key:`,
- a fence of three backticks, or one backtick more than the longest closing fence line in the block. A closing fence line is a line that CommonMark reads as a closing fence: up to three spaces, three or more backticks, and then only spaces and tabs.

## Conversion to and from GFM

The conversion goes both ways with no loss of content. If a table cannot convert without loss, the conversion fails with an error at the line, and it changes nothing. It never drops content silently.

- The header titles become the GFM header row. The keys of a GFM table are made from its titles: lower case, each run of other characters than `[a-z0-9]` becomes `-`, with no `-` at the start or the end. An empty key becomes `c1`, `c2`, and so on by column. Then the first column with a key keeps it, and a later column with the same key gets the smallest suffix `-2`, `-3`, and so on that no other column has. Thus the titles `a`, `a`, `a-2` give the keys `a`, `a-3`, `a-2`.
- The GFM text has the form `| T1 | T2 |`, then `| --- | --- |` (with the alignment marks of the columns), then one line per row, `| c1 | c2 |`. An empty cell is `|  |`. Each row has a cell for each column.
- A line break in a cell becomes `<br>`. A literal `<br>` in a cell gets one backslash more, by the rule of rule 10: `<br>` becomes `\<br>`, and `\<br>` becomes `\\<br>`. Only the exact text `<br>` with no backslash before it becomes a line break. `<br/>` and `<BR>` stay text.
- A cell line that ends with a backslash and has a next line cannot convert to GFM, because the backslash would come directly before the `<br>` of the line break. The conversion to GFM fails for it.
- A title has no line break, so a `<br>` in a title stays as it is in both directions.
- A pipe after an even number of backslashes (also none) gets one backslash more: `|` becomes `\|`, and `\\|` becomes `\\\|`. The conversion to tbl removes one backslash before each pipe. A pipe after an odd number of backslashes cannot convert to GFM, because one backslash more gives an even number, and GFM splits the cell there. The conversion to GFM fails for it, and the error tells the writer to write `|` or one backslash more.
- An ID marker of a row goes to the end of the first cell in GFM, after one space if the cell has text, as in the table views of Markgraf. The marker form is `{#id}` with an ID of the form `[A-Za-z0-9_-]+`, at the start of the cell or after a space, and with zero or more backslashes before the `{`. A first cell of a row with no ID that ends with the marker form gets one backslash more before the `{`, by the same rule. With an ID, the text needs no escape, because the conversion to tbl removes only the last marker. The conversion to tbl fails if the text before the marker ends with a space or a tab, because the text could not convert back.
- The attribute `align` of a column maps to the GFM alignment, in both directions: `left` is `:---`, `center` is `:---:`, `right` is `---:`, and a column with no `align` is `---`. A GFM column with an alignment gets the attribute line `{align=...}` after its header key line.
- The ID of a row goes to GFM by the ID marker rule above. Each other attribute has no GFM form: a class or a pair of a row, any attribute of a cell, and any attribute of a column other than `align`. The conversion to GFM fails for each of them, with an error at its line, unless the user gives `--drop-attributes`. With `--drop-attributes`, the conversion drops them and keeps the rest.
- GFM removes the spaces and the tabs at the start and at the end of a cell. Thus the conversion to GFM fails for a title or a cell that starts or ends with a space or a tab.
- A tbl cell never ends with a line break (rule 7). Thus the conversion to tbl fails for a GFM cell that ends with `<br>`.
- A GFM row with fewer cells than the header has empty cells. A cell after the last column of the header is an excess cell. GFM drops excess cells. The conversion to tbl drops an excess cell with no text: its text between the pipes is empty or only spaces and tabs. An excess cell with text fails the conversion to tbl, because GFM hides that text. The error names the first excess cell with text of the row.
- The conversion to tbl reads each cell text from the source, so that the inline Markdown stays byte for byte. It removes the pipes of the cell and the spaces and the tabs at its edges.

### How micromark splits a GFM row

The pipe rule rests on this measurement of `micromark-extension-gfm-table` 2.1 (2026-10-05). The cell text is the text between the pipes.

```tbl
cell: GFM cell text
split: Split
mdast: mdast of the cell
--
cell: `x\|y`
split: no
mdast: text `x|y`
--
cell: `x\\|y`
split: yes, after `x\\`
mdast: text `x\` and text `y`
--
cell: `x\\\|y`
split: no
mdast: text `x\|y`
--
cell: `` `x\|y` ``
split: no
mdast: inline code `x|y`
--
cell: `` `x|y` ``
split: yes, a code span gives no protection
mdast: text `` `x `` and text `` y` ``
--
cell: `` `x\\\|y` ``
split: no
mdast: inline code `x\\|y`
```

Thus GFM splits at a pipe after an even number of backslashes. In text, the backslashes before a pipe are escapes. In a code span, micromark removes one backslash before a pipe and keeps the others. Thus one backslash more before a pipe after an even number of backslashes keeps the meaning in text and in a code span.

## Conversion of a file

A conversion of a file converts each table of the other kind, and it keeps each other byte of the file. Thus a conversion to tbl converts each GFM table and keeps each `tbl` block, also an invalid one. A table inside another code block or an HTML block is no table, so it stays as it is.

- The new text replaces only the source of the table, from its first character to its last character.
- The first line of the new text starts where the table started. Each other line starts with the continuation prefix. The continuation prefix is the text from the start of the first line to the table, with each character other than `>`, a space, or a tab replaced by a space. Thus `- ` gives two spaces, `> ` gives `> `, and `> 1. ` gives `>    `. An empty line gets the continuation prefix with no spaces and tabs at its end, so that no line ends with a space.
- The new text uses the line end of the file: the first line end of the file, CRLF, LF, or CR. A file with no line end gets LF.
- A conversion to GFM fails for a `tbl` block with text after `tbl` in the info string, and for a block with parse errors. Each error is at its line in the file. An error of a cell is at the key line of the cell, also if that line has a prefix key. An error of a title is at the header key line of the title. The column of these errors is the column of the fence.
- A conversion to tbl fails at the cell of each error of the GFM table.
- After the conversion, the converter reads the new text again. Each new table must be at the same place in the list of tables, with the new kind, and it must read back as the same table. A new GFM table reads back with the keys of its titles. Each other table must keep its kind and its text. If the check fails for a table, the conversion fails with an error at the first line of that table.
- If one table fails, the whole conversion fails, and the file does not change. The errors come sorted by line and then by column.

### Where a new GFM table can stand

A GFM table has no end marker. It ends at an empty line or at the start of another block. A tbl block ends at its closing fence. Thus a conversion to GFM can change how Markdown reads the lines around the table. This measurement of `micromark-extension-gfm-table` 2.1 (2026-10-05) shows the cases:

```tbl
case: The tbl block is directly
result: Result of the conversion to GFM
--
case: after a paragraph line
result: It converts. A GFM table can interrupt a paragraph, so the line stays a paragraph.
--
case: before a paragraph line
result: It fails. GFM reads the line as a row of the table.
--
case: before a line of the same list item or block quote
result: It fails. GFM reads the line as a row of the table.
--
case: before a lazy line after a list item or a block quote
result: It converts. A table row is never a lazy line, so the line stays outside the table.
--
case: before a heading, a list item, or a fence
result: It converts. Another block ends the table.
--
case: before another tbl block or a GFM table
result: It fails. GFM reads the lines of the next table as rows. Only the first table gets an error.
```

The error tells the writer to add an empty line after the `tbl` block. A conversion to tbl has no such case, because a fence ends at its closing fence line.

## How the rule applies

- Agents write new tables as `tbl` blocks.
- An agent that edits a file converts the GFM tables in that file with `tbl-md convert`.
- An imported report, for example from Gemini Deep Research, gets its tables converted at import. The content stays the same.
- A chat reply has no tables at all.
- Check: `tbl-md lint` in the pre-commit hook of each project fails on a GFM table and on an invalid `tbl` block in a changed Markdown file.
