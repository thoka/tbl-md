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

- The header titles become the GFM header row. The keys of a GFM table are made from its titles: lower case, each run of other characters than `[a-z0-9]` becomes `-`, with no `-` at the start or the end. A duplicate key gets a suffix `-2`, `-3`, and so on. An empty key becomes `c1`, `c2`, and so on by column.
- A line break in a cell becomes `<br>`. A literal `<br>` in a cell gets one backslash more, by the rule of rule 10: `<br>` becomes `\<br>`, and `\<br>` becomes `\\<br>`. Only the exact text `<br>` becomes a line break. `<br/>` and `<BR>` stay text.
- A title has no line break, so a `<br>` in a title stays as it is in both directions.
- A pipe becomes `\|`.
- An ID marker of a row goes to the end of the first cell in GFM, after one space if the cell has text, as in the table views of Markgraf. A first cell that ends with the marker form and is not a marker gets one backslash more before the `{`, by the same rule.
- GFM column alignment is dropped.
- GFM removes the spaces at the start and at the end of a cell. Thus the conversion to GFM fails for a cell that starts or ends with a space.
- A tbl cell never ends with a line break (rule 7). Thus the conversion to tbl fails for a GFM cell that ends with `<br>`.

## How the rule applies

- Agents write new tables as `tbl` blocks.
- An agent that edits a file converts the GFM tables in that file with `tbl-md convert`.
- An imported report, for example from Gemini Deep Research, gets its tables converted at import. The content stays the same.
- A chat reply has no tables at all.
- Check: `tbl-md lint` in the pre-commit hook of each project fails on a GFM table and on an invalid `tbl` block in a changed Markdown file.
