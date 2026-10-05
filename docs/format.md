# The tbl table format

A `tbl` block is a table in a fenced code block. It replaces the GFM pipe table, because a pipe table is hard to read as text. The user decided the format on 2026-10-05. The first copy of this file came from `~/dv/markgraf/docs/tbl-format.md`. The research behind the format is `~/dv/markgraf/docs/research/readable-table-syntax.md`. The format is a variant of the record-jar and Debian control file family, with a header record and short keys.

Status: draft for version 0.1.0. The review of this project changed some details before the first release. Each change has an entry in `docs/review-queue.md`. After the first release, a change of these rules that makes a valid block invalid, or that changes its content, needs a new major version.

## Example

````
```tbl
model: Model
price: Price
note: Note
--
model: Opus
price: $15
note: Good for research.
Second line of the same cell.
hint\: this line is text, not a key.
Note: a capital letter is never a key, so this line needs no escape.
-- {#a1b2c3d4}
m: Haiku
p: $1
```
````

## Rules

1. The info string of the fence is exactly `tbl`. Text after `tbl` in the info string is reserved for a later version, and the parser reports it as an error. A fence of backticks and a fence of tildes are both valid. As in CommonMark, the spaces before and after the info string do not count, so `tbl   ` is valid. The language is case-sensitive, so a fence with `TBL` or `tbl-x` is no `tbl` block. An indented code block is no `tbl` block, because it has no info string.
2. The first record is always the header. Each line maps a key to a column title: `key: Title`. The order of the header lines is the column order. A header has one key at least. A title has one line, and it can be empty. Two equal keys in the header are an error. A line in the header that is not a key line is an error.
3. A key has the form `[a-z0-9_-]+`. Keys are case-sensitive. A key line is a key, a colon, and then a space or the end of the line. Thus a line such as `https://example.com` is no key line. The text of a key line starts after the colon and one space. More spaces are content.
4. A line that is exactly `--` starts the next record. A row ID marker can follow after one space: `-- {#a1b2c3d4}`. An ID has the form `[A-Za-z0-9_-]+`. Each other line that starts with `--` is text.
5. In a data record, a line `key: text` starts a cell. The key can be any unique prefix of a header key. An exact key wins over a longer key with the same prefix.
6. Each other line continues the cell above. Leading spaces of a continuation line are content. An empty line inside a cell is content.
7. Empty lines at the start of the block, directly after `--`, directly before `--`, directly before a key line, and before the end of the block are not content. Thus a cell never ends with an empty line. An empty line has no characters. A line of only spaces is content.
8. Keys can come in any order in a record. A missing key is an empty cell. A record with no cells is a row of empty cells.
9. Each error names the line. These are errors:
   - a key line whose key matches no header key,
   - an ambiguous prefix (the error lists the possible keys),
   - a duplicate key in a record,
   - a continuation line before the first key of a record,
   - a block with no header key, that is an empty block or a block that starts with `--` (a header of only lines that are no key lines gives an error for each of these lines instead),
   - text after `tbl` in the info string.
10. Escapes exist only at the start of a line, and all follow one rule: one backslash more than the text has. Two forms take an escape:
    - The key form: a key, one or more backslashes, a colon, and then a space or the end of the line. Example: `hint\: text` is the text `hint: text`.
    - The separator form: one or more backslashes, `--`, and an optional ID marker, with nothing else on the line. Example: `\--` is the text `--`.

    The parser removes one backslash from each line of these forms. The renderer adds one backslash to each content line of these forms, also to a line that has backslashes already. Thus `hint\\: text` is the text `hint\: text`, and each text survives the round trip. A line of other forms keeps each backslash.
11. Cell text is inline Markdown.
12. A line ends with LF, CRLF, or CR, as in CommonMark. A title or a cell holds no CR. The parser reads all three line ends. The renderer writes LF, and a rewrite of a file keeps the line end of that file.

## Canonical form

The renderer writes the canonical form, so that a parse followed by a render gives the same text:

- full keys, in header order,
- no line for an empty cell,
- `key:` with no space for a cell whose first line is empty,
- no indentation, and no empty line directly before or after `--`,
- the escapes of rule 10 where they are necessary,
- a fence of three backticks, or one backtick more than the longest closing fence line in the block. A closing fence line is a line that CommonMark reads as a closing fence: up to three spaces, three or more backticks, and then only spaces and tabs.

## Conversion to and from GFM

The conversion goes both ways with no loss of content. If a table cannot convert without loss, the conversion fails with an error at the line, and it changes nothing. It never drops content silently.

- The header titles become the GFM header row. The keys of a GFM table are made from its titles: lower case, each run of other characters than `[a-z0-9]` becomes `-`, with no `-` at the start or the end. An empty key becomes `c1`, `c2`, and so on by column. Then the first column with a key keeps it, and a later column with the same key gets the smallest suffix `-2`, `-3`, and so on that no other column has. Thus the titles `a`, `a`, `a-2` give the keys `a`, `a-3`, `a-2`.
- The GFM text has the form `| T1 | T2 |`, then `| --- | --- |`, then one line per row, `| c1 | c2 |`. An empty cell is `|  |`. Each row has a cell for each column.
- A line break in a cell becomes `<br>`. A literal `<br>` in a cell gets one backslash more, by the rule of rule 10: `<br>` becomes `\<br>`, and `\<br>` becomes `\\<br>`. Only the exact text `<br>` with no backslash before it becomes a line break. `<br/>` and `<BR>` stay text.
- A cell line that ends with a backslash and has a next line cannot convert to GFM, because the backslash would come directly before the `<br>` of the line break. The conversion to GFM fails for it.
- A title has no line break, so a `<br>` in a title stays as it is in both directions.
- A pipe after an even number of backslashes (also none) gets one backslash more: `|` becomes `\|`, and `\\|` becomes `\\\|`. The conversion to tbl removes one backslash before each pipe. A pipe after an odd number of backslashes cannot convert to GFM, because one backslash more gives an even number, and GFM splits the cell there. The conversion to GFM fails for it, and the error tells the writer to write `|` or one backslash more.
- An ID marker of a row goes to the end of the first cell in GFM, after one space if the cell has text, as in the table views of Markgraf. The marker form is `{#id}` with an ID of the form `[A-Za-z0-9_-]+`, at the start of the cell or after a space, and with zero or more backslashes before the `{`. A first cell of a row with no ID that ends with the marker form gets one backslash more before the `{`, by the same rule. With an ID, the text needs no escape, because the conversion to tbl removes only the last marker. The conversion to tbl fails if the text before the marker ends with a space or a tab, because the text could not convert back.
- GFM column alignment is dropped.
- GFM removes the spaces and the tabs at the start and at the end of a cell. Thus the conversion to GFM fails for a title or a cell that starts or ends with a space or a tab.
- A tbl cell never ends with a line break (rule 7). Thus the conversion to tbl fails for a GFM cell that ends with `<br>`.
- A GFM row with fewer cells than the header has empty cells. A GFM row with more cells than the header fails the conversion to tbl, because GFM drops the extra cells.
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
