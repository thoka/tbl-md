---
checked: 2026-10-06
recheck: "12m. If djot reaches version 1.0, if the CommonMark spec adds attributes, or if micromark-extension-directive exports its attribute parser, recheck at that time"
decisions:
  - "tbl-md 0.2.0 (proposal): tbl-md writes its own attribute parser of about 150 lines. No library of the mdast or micromark family exports a parser for one attribute block"
  - "tbl-md 0.2.0 (proposal): the grammar is the subset that Pandoc, djot, and kramdown read the same, plus the escapes \\\" and \\\\ in a double-quoted value"
  - "tbl-md 0.2.0 (proposal): a line that starts with { and ends with } is always an attribute line. If it does not parse, it is an error, not text. A text line of this form gets one backslash more"
  - "tbl-md 0.2.0 (proposal): the canonical form is {#id .class key=value}: the ID, then the classes, then the keys, with one space between the parts. A value of the form [A-Za-z0-9_:-]+ is bare. Each other value has double quotes"
---

# The attribute block for tbl-md 0.2.0

Research on 2026-10-06 for tbl-md version 0.2.0. No paid API. No key file was read. Each source at the end is a page or a file that this research opened on 2026-10-06. A statement without a source has the mark "[guess]". A fact that this research measured has the mark "[measured]".

This report uses ASD-STE100 Simplified Technical English as a guide. No tool can make sure that a text obeys ASD-STE100 fully.

## Question

Version 0.2.0 of tbl-md adds attributes to a `tbl` block (`docs/spec.md`, section Scope of version 0.2.0). An attribute line `{...}` after a header key line describes a column. An attribute line after the last line of a cell describes the cell. The `--` line of a row takes the attribute block of the row, for example `-- {#a1 .hl}`. The row ID marker `{#id}` of rule 4 in `docs/format.md` becomes a special case. The syntax must be the attribute block of Pandoc, djot, and kramdown.

The five questions:

1. What is the exact grammar of the attribute block in Pandoc, djot, and kramdown? Also, briefly, in markdown-it-attrs and in the CommonMark discussion.
2. Which subset means the same in all three?
3. Which canonical form does a writer of these tools write?
4. Does a small JavaScript library parse one attribute block, so that tbl-md need not write its own grammar?
5. What grammar, canonical form, and errors do we recommend for tbl-md?

## Method

1. Read `docs/spec.md`, `docs/format.md`, and the head of `docs/research/table-corpus.md`.
2. Searched the lessons in `~/dv/meta/agents/lessons/` and the research index `~/dv/meta/agents/research-index.md`. No report or lesson covers attribute syntax.
3. Read the parser source of each tool. For Pandoc: the Markdown reader 3.12, and the commonmark-hs attribute extension (the reader for `commonmark+attributes`). For djot: `attributes.ts` of djot.js. For kramdown: the regular expressions of version 2.5.2. Also the attribute factory of micromark-extension-directive 4.0.0, and `utils.js` of markdown-it-attrs 5.0.1.
4. Installed each tool in a scratch folder outside the repository: the Pandoc 3.12 binary, `@djot/djot` 0.3.2, the kramdown 2.5.2 gem on Ruby 3.4.7, `micromark-extension-directive` 4.0.0 with `mdast-util-directive` 3.1.1, and `markdown-it-attrs` 5.0.1 [measured].
5. Gave about 35 attribute blocks to each parser and compared the results [measured]. Pandoc got each block on a heading. djot got each block on a span and as a block attribute. kramdown got each block as a block IAL (`{: ...}`). The directive extension got each block on a leaf directive (`::x{...}`). markdown-it-attrs got each block after a paragraph.
6. Gave one block with all features to each writer and read the output [measured].
7. Read the README files and the exports of the npm packages, and the npm registry entries of other attribute parsers.
8. Read the CommonMark forum thread "Consistent attribute syntax" and the list of sections of the CommonMark spec 0.31.2.
9. Searched skills.sh for `attributes`, `djot`, `pandoc-attributes`, and `markdown-attributes`. No skill covers an attribute grammar.

## Findings

### 1. The grammar of each tool

#### Pandoc Markdown (`header_attributes`, `fenced_code_attributes`, `link_attributes`)

The manual gives the form `{#identifier .class .class key=value key=value}` ([Pandoc manual](https://raw.githubusercontent.com/jgm/pandoc/3.12/MANUAL.txt), section Extension: `header_attributes`). The reader source gives the exact grammar ([Markdown.hs](https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Readers/Markdown.hs), function `attributes`):

```
attributes = "{" spnl (attribute spnl)* "}"
attribute  = "#" [alnum -_:.]+                 (identifier)
           | "." letter [alnum -_:.]*           (class)
           | key "=" value                       (key-value)
           | "-"                                  (the class unnumbered)
key        = letter [alnum -_:.]*
value      = '"' litChar+ '"' | "'" litChar+ "'" | '""' | "''"
           | (escapedChar | [^ \t\n\r}])*
spnl       = spaces, at most one line end, spaces
```

Facts from the source and from the measurement:

- "Letter" and "alnum" are Unicode classes. Thus `{#ä}` gives the ID `ä` [measured].
- The parts need no space between them. `{.a#b}` gives the class `a` and the ID `b`. `{#a.b}` gives the ID `a.b`, because an ID can contain a dot [measured].
- A quoted value cannot start with a space. `{k=" x"}` is not an attribute block, and Pandoc reads the text `{k=" x"}` [measured].
- In a quoted value, a backslash escapes the ASCII punctuation characters of `all_symbols_escapable`. `\"` gives `"`, and `\\` gives `\`. A backslash before another character stays [measured: `k="a\b"` gives `a\b`].
- In a quoted value, Pandoc decodes HTML entities: `k="&amp;"` gives `&` [measured].
- A bare value is any text up to a space or `}`. `{k=a"b}` gives `a"b`, and `{k=}` gives an empty value [measured].
- The key `id` sets the ID. The key `class` adds its words as classes [measured: `{id=x class="a b"}`].
- Two IDs: the last wins. Two equal keys: Pandoc keeps both pairs in the list. Two equal classes: Pandoc keeps both [measured].
- The braces can hold one line end. An empty line ends the block [measured in a fence info string].
- No comments. `{#a %c% .b}` is text [measured].
- An invalid block is text, with no warning [measured: `{.1a}`, `{1k=v}`, `{k}`].

#### Pandoc `commonmark+attributes` (commonmark-hs)

The `attributes` extension of the commonmark reader uses a different parser. The source is in [Attributes.hs](https://raw.githubusercontent.com/jgm/commonmark-hs/master/commonmark-extensions/src/Commonmark/Extensions/Attributes.hs) and [Tag.hs](https://raw.githubusercontent.com/jgm/commonmark-hs/master/commonmark/src/Commonmark/Tag.hs). The manual says that its syntax is "the same as that used in `header_attributes`" ([Pandoc manual](https://raw.githubusercontent.com/jgm/pandoc/3.12/MANUAL.txt), section Extension: `attributes`). The measurement shows differences:

- The parts need a space between them. `{.a.b}` and `{.a#b}` are text [measured].
- A key is an HTML attribute name. It starts with an ASCII letter, `_`, or `:` [source]. `{1k=v}` is text [measured].
- Only double quotes. `{k='a b'}` is text [measured].
- No backslash escapes. `{k="a \"q\" b"}` is text, and `k="a\\b"` keeps two backslashes [measured].
- Two IDs: the first wins [measured: `{#a #b}` gives `a`].
- `{}` and `{-}` are text [measured].

Thus the two readers of one tool do not agree. The safe subset of finding 2 must hold for both.

#### djot (syntax reference and djot.js 0.3.2)

The syntax reference ([djot syntax.md](https://raw.githubusercontent.com/jgm/djot/main/doc/syntax.md), sections Inline attributes, Block attributes, Comment) says:

- `.foo` is a class. More classes combine.
- `#foo` is the identifier. If there are more, the last one is used.
- `key="value"` or `key=value`. A bare value is "entirely of ASCII alphanumeric characters or `_` or `:` or `-`". Backslash escapes work in a quoted value.
- `%` starts a comment. The comment ends at the next `%` or at the `}`.
- An attribute block can contain line breaks. A block attribute that continues on a next line needs an indent.

The reference does not give the characters of an ID or a class. The parser of djot.js gives them ([attributes.ts](https://raw.githubusercontent.com/jgm/djot.js/main/src/attributes.ts)):

```
id     = "#" [^ \]\[~!@#$%^&*(){}`,.<>\\|=+/? whitespace]+
class  = "." [A-Za-z0-9_:-]+                 (JavaScript \w with no u flag)
key    = [A-Za-z0-9_:-]+
value  = [A-Za-z0-9_:-]+ | '"' ([^"\\] | "\\" any)* '"'
```

Facts from the source and from the measurement:

- An ID can hold Unicode letters and some ASCII punctuation such as `'` and `;`, but no dot [measured: `{#ä}` is valid, `{#a.b}` is text].
- A class is ASCII only [measured: `{.ä}` is text].
- The parts need a space between them [measured: `{.a.b}` and `{.a#b}` are text].
- In a quoted value, a backslash before ASCII punctuation is an escape. A backslash before another character stays ([parse.js](https://raw.githubusercontent.com/jgm/djot.js/main/src/parse.ts), handler `value`) [measured: `k="a\b"` gives `a\b`, `k="a\\b"` gives `a\b`].
- No entity decoding [measured: `k="&amp;"` gives `&amp;`].
- A line end in a quoted value becomes a space [measured].
- Only double quotes [measured: `{k='a b'}` is text].
- A key with no value, `{k}`, and `{k=}` are text [measured].
- The key `id` and the key `class` are normal keys in the attribute map. Thus `{id=x}` sets the ID [measured].
- Two IDs: the last wins. Two equal keys: the last wins. Two equal classes: djot keeps both [measured].
- An invalid block is text, with no warning [measured].

#### kramdown (IAL, kramdown 2.5.2)

kramdown calls the block an inline attribute list (IAL). A block IAL starts with `{:`, for example `{: #id .class key="value"}`. A heading also takes `{#id}` with no colon, but only for an ID ([kramdown syntax](https://kramdown.gettalong.org/syntax.html), sections Attribute List Definitions and Inline Attribute Lists). The regular expressions of the parser ([extensions.rb](https://github.com/gettalong/kramdown/blob/master/lib/kramdown/parser/kramdown/extensions.rb), version 2.5.2 from the gem):

```
ALD_ID_NAME             = \w[\w-]*
ALD_TYPE_ID_NAME        = #([A-Za-z][\w:-]*)
ALD_TYPE_CLASS_NAME     = \.([^\s.#]+)
ALD_TYPE_KEY_VALUE_PAIR = (\w[\w-]*)=("|')((?:\\\}|\\\2|[^}\2])*?)\2
ALD_TYPE_REF            = (\w[\w-]*)
```

Facts from the source, the syntax page, and the measurement:

- An ID starts with an ASCII letter. `{: #1a}` gives no ID and a warning [measured]. Note: the row IDs of tbl-md 0.1 (`[A-Za-z0-9_-]+`) can start with a digit.
- A class is any text with no space, dot, or `#`. `{: .ä}` and `{: .1a}` are valid [measured].
- A value must have quotes, single or double. `{: k=v}` gives no attribute and a warning [measured].
- In a quoted value, only `\}` and the backslash before the own quote are escapes. `\\` stays two backslashes [measured: `k="a\\b"` gives `a\\b`].
- A `}` in a value needs a backslash, because the block ends at the first `}` that has no backslash [measured].
- A bare word such as `{: k}` is a reference to an attribute list definition. If no such definition exists, kramdown ignores it with no warning [measured].
- `#a.b` gives the ID `a` and the class `b` [measured].
- Two IDs: the last wins. Two equal keys: the last wins. Two equal classes: kramdown keeps both [measured].
- Text that matches no part is ignored. `{: #a !}` gives the ID `a` and no warning [measured].
- A block IAL with no valid part disappears and gives a warning. It does not become text [measured: `{: #1a}`, `{: k=v}`].
- The braces can hold line ends [measured].

#### markdown-it-attrs 5.0.1

The parser ([utils.js](https://github.com/arve0/markdown-it-attrs/blob/master/utils.js), function `getAttrs`) is lenient. A key is any characters except tab, line feed, form feed, space, `/`, `>`, `"`, `'`, and `=`. Facts from the measurement:

- `{#a !}` gives the ID `a` and an attribute named `!`. `{#a %c% .b}` gives an attribute named `%c%` [measured].
- `{k='a b'}` gives `k="'a"` and `b=""` [measured].
- `{k}` and `{k=}` give an empty value [measured].
- `{.a.b}` gives the class `a.b` [measured].
- The README recommends the option `allowedAttributes` for security ([README](https://github.com/arve0/markdown-it-attrs#security)).

Thus markdown-it-attrs accepts much that the other tools reject. It is not a good reference for a strict grammar.

#### micromark-extension-directive 4.0.0

The attribute part of a directive "is handled like HTML attributes" ([readme](https://github.com/micromark/micromark-extension-directive#syntax)). Facts from the source ([factory-attributes.js](https://github.com/micromark/micromark-extension-directive/blob/main/dev/lib/factory-attributes.js)) and the measurement:

- Bare, single-quoted, and double-quoted values [measured].
- HTML entities decode: `{k=&amp;}` gives `&` [measured].
- No backslash escapes. `{k="a \"q\" b"}` is text [measured].
- A key with no value is valid: `{k}` gives `k=""` [measured].
- The parts need no space: `{#a.b}` gives the ID `a` and the class `b` [measured].
- `%` is not valid: `{#a %c% .b}` is text [measured].
- The attributes of a leaf directive cannot hold a line end (readme).

#### The CommonMark discussion

The forum thread "Consistent attribute syntax" started on 2014-09-04. It proposes the syntax of Pandoc, PHP Markdown Extra, and kramdown: `{#id .class key=val key2="val 2"}` ([talk.commonmark.org](https://talk.commonmark.org/t/consistent-attribute-syntax/272)). The thread has 143 posts. The last post is from 2022-07-23 [measured through the JSON API of the forum]. The CommonMark spec 0.31.2 has no section on attributes [measured: list of the 26 sections in `spec.json`]. Thus no standard exists. The proposal of the thread is the same form that Pandoc uses.

### 2. The safe subset

This table compares the six parsers. "P" is the Pandoc Markdown reader, "C" is Pandoc `commonmark+attributes`, "D" is djot.js, "K" is kramdown, "M" is micromark-extension-directive, and "A" is markdown-it-attrs. All rows are [measured], except where the cell says "source".

```tbl
feature: Feature
p: Pandoc Markdown
c: Pandoc commonmark
d: djot.js
k: kramdown
m: directive
a: markdown-it-attrs
--
feature: Opening
p: `{`
c: `{`
d: `{`
k: `{:` (`{#id}` only on a heading)
m: `{`
a: `{`
--
feature: ID characters
p: Unicode alnum and `-_:.`
c: word characters and `-_:.`
d: no space and no ASCII punctuation except `-_:'";`
k: `[A-Za-z][A-Za-z0-9_:-]*`
m: no space and none of `"#'.<=>` and backtick
a: any
--
feature: ID with a digit first, `{#1a}`
p: valid
c: valid
d: valid
k: invalid, warning
m: valid
a: valid
--
feature: Class characters
p: letter first, then alnum and `-_:.`
c: word characters and `-_`
d: `[A-Za-z0-9_:-]`
k: any except space, `.`, `#`
m: as the ID
a: any
--
feature: Key characters
p: letter first, then alnum and `-_:.`
c: HTML attribute name (source)
d: `[A-Za-z0-9_:-]+`
k: `\w[\w-]*`
m: alnum and `-_:.`
a: any except space and `/>"'=`
--
feature: Space between parts needed
p: no (`{.a#b}` is valid)
c: yes
d: yes
k: no
m: no
a: yes
--
feature: Bare value
p: any up to space or `}`
c: no space, no `<>='"}` or backtick
d: `[A-Za-z0-9_:-]+`
k: not allowed
m: HTML unquoted value
a: any up to space
--
feature: Double quotes
p: yes
c: yes
d: yes
k: yes
m: yes
a: yes
--
feature: Single quotes
p: yes
c: no
d: no
k: yes
m: yes
a: no
--
feature: Escapes in a quoted value
p: backslash before ASCII punctuation
c: none
d: backslash before ASCII punctuation
k: only `\}` and the own quote
m: none
a: `\"` only
--
feature: Entities in a value
p: decoded
c: decoded
d: kept as text
k: kept as text
m: decoded
a: kept, then escaped in HTML
--
feature: Key with no value, `{k}`
p: text
c: text
d: text
k: reference to a definition, ignored
m: empty value
a: empty value
--
feature: Two IDs
p: last wins
c: first wins
d: last wins
k: last wins
m: last wins
a: last wins
--
feature: Two equal keys
p: both kept
c: last wins
d: last wins
k: last wins
m: last wins
a: last wins
--
feature: Two equal classes
p: both kept
c: both kept
d: both kept
k: both kept
m: both kept
a: both kept
--
feature: Line end in the braces
p: one
c: yes (source)
d: yes, with indent for a block
k: yes
m: no (leaf)
a: not tested
--
feature: Comment `%...%`
p: no, text
c: no, text
d: yes
k: ignored
m: no, text
a: becomes a key
--
feature: Invalid block
p: text
c: text
d: text
k: removed, warning
m: text
a: mostly accepted
```

The subset that means the same in Pandoc (both readers), djot, and kramdown:

- **ID**: `#` and then `[A-Za-z][A-Za-z0-9_-]*`. A digit first fails in kramdown only.
- **Class**: `.` and then `[A-Za-z][A-Za-z0-9_-]*`. Pandoc needs a letter first. djot has no colon problem, but commonmark-hs has no `:` in a class.
- **Key**: `[A-Za-z][A-Za-z0-9_-]*`. kramdown has no `:` in a key.
- **Value**: double quotes, with no `"`, no `\`, no `}`, no `&`, no line end, and no space as the first character. Inside these limits, all three read the same text. A bare value fails in kramdown. A `}` in a value fails in kramdown. `&` fails because Pandoc decodes entities and djot does not. A space first fails in Pandoc Markdown.
- **Separation**: one or more spaces between the parts, spaces allowed after `{` and before `}`.
- **One ID**, **no repeated keys**, **no keys `id` or `class`**, **no comments**, **no line ends**.
- **Classes**: more than one class is safe, and the order stays in all tools.

The opening is not safe. kramdown needs `{:` on a block, and the other tools reject `{:` [guess for djot and Pandoc, from the grammar: `:` is not a valid start of a part]. Thus a `tbl` attribute line is never a kramdown IAL as it is. Only the content between the braces can be the same.

If we accept the bare value of djot, `[A-Za-z0-9_:-]+`, then Pandoc, commonmark-hs, djot, the directive extension, and markdown-it-attrs read the same value. Only kramdown rejects it.

### 3. The canonical form of the writers

```tbl
writer: Writer
order: Order of the parts
quote: Quoting rule
--
writer: Pandoc Markdown writer 3.12
order: ID, then classes, then keys in their order. Output `{#a .b .c k="v"}` [measured]
quote: Always double quotes. In the ID, the classes, the keys, and the values, `"` becomes `\"` and `\` becomes `\\` (source: `attrsToMarkdown`)
--
writer: Pandoc djot writer 3.12
order: ID, then classes, then keys [measured]
quote: Always double quotes. It also escapes `}` and `'`, for example `a\}b` and `it\'s`. It wraps a long block onto a second line [measured]
--
writer: djot.js `renderDjot` 0.3.2
order: The order of the attribute map, that is the source order. `{k=v .b #a}` stays `{k="v" .b #a}` [measured]
quote: Always double quotes, `"` becomes `\"` and `\` becomes `\\` [measured]
--
writer: kramdown writer 2.5.2
order: The order of the attribute map, that is the source order, as `{: k="v" .b .c #a}` [measured]
quote: Always double quotes, with no escape. A value with `"` or `}` gives a block that does not parse back [measured]
```

Thus Pandoc is the only writer with a fixed order: `#id`, then `.class`, then `key="value"`. All four writers quote each value with double quotes. No writer writes a bare value.

### 4. Libraries that parse one attribute block

```tbl
lib: Library
family: mdast or micromark family
api: Exported parser for one block
grammar: Grammar
--
lib: micromark-extension-directive 4.0.0 (MIT, 2025-02-27)
family: yes
api: no. `factoryAttributes` is internal. The exports map has only `directive` and `directiveHtml` [measured]
grammar: HTML-like, see finding 1. No backslash escapes, entities decode, `{k}` is valid, no error message on an invalid block
--
lib: mdast-util-directive 3.1.1 (MIT)
family: yes
api: no. It only turns the tokens of the extension into an object
grammar: as above. Two equal keys: the last wins with no warning [measured]
--
lib: @djot/djot 0.3.2 (MIT, 2024-12-19)
family: no
api: no. `AttributeParser` is internal. A deep import gives `ERR_PACKAGE_PATH_NOT_EXPORTED` [measured]
grammar: djot, see finding 1
--
lib: markdown-it-attrs 5.0.1 (MIT)
family: no
api: `getAttrs` in `utils.js` is reachable by a deep import, but it is not a documented API
grammar: lenient, see finding 1
--
lib: md-attr-parser 1.3.0 (MIT, 2019-09-17)
family: no
api: yes (registry entry, "A parser for markdown's attributes")
grammar: not tested. No release since 2019
--
lib: attributes-parser 2.2.3 (MIT, 2024-08-28)
family: no
api: yes (registry entry)
grammar: not tested. It depends on `json-loose`
```

Thus no library of the mdast or micromark family exports a parser for one attribute block. A possible workaround is to parse `::x{...}` with micromark and the directive extension, and then to read the `attributes` object. This workaround has three problems:

1. The grammar is not the grammar of Pandoc and djot. It has no backslash escapes, and it decodes entities.
2. An invalid block becomes a paragraph. The parser gives no error and no column. Principle 3 of the spec needs precise errors.
3. The attributes object loses repeated keys and repeated IDs silently.

The libraries outside the family break principle 4 of the spec. Thus tbl-md writes its own parser. The grammar of finding 5 is small. A hand-written scanner of about 150 lines with tests is enough [guess].

### 5. Recommendation for tbl-md (proposal)

This section is a proposal. The user decides it with the 0.2.0 review.

#### Which line is an attribute line

- If the first character of a line is `{` and its last character is `}`, the line is in the **attribute form**.
- A line in the attribute form at a place that takes attributes is an attribute line. If it does not parse, it is an **error**. It never falls back to text. Reason: Pandoc and djot fall back to text silently, so a typo such as `{.hl k=}` becomes cell text with no warning. Principle 3 asks for a precise error.
- The `--` line of a row: `--`, one space, and a block in the attribute form. Each other line that starts with `--` stays text, as in rule 4.
- The escape follows rule 10. A content line in the attribute form gets one backslash more: `\{.x}` is the text `{.x}`, and `\\{.x}` is the text `\{.x}`. The separator form of rule 10 takes an optional attribute block instead of the optional ID marker.
- Reason for a test on the form and not on the grammar: the escape then does not depend on the grammar. A later version can add a feature to the grammar, and no old text changes its meaning.

#### Grammar

```
block   = "{" sp* part (sp+ part)* sp* "}"
part    = id | class | pair
id      = "#" [A-Za-z0-9_-]+
class   = "." [A-Za-z][A-Za-z0-9_-]*
pair    = key "=" value
key     = [A-Za-z][A-Za-z0-9_-]*
value   = bare | quoted
bare    = [A-Za-z0-9_:-]+
quoted  = '"' (char | "\\\"" | "\\\\")* '"'
char    = any character except '"', '\', and a line end
sp      = " " or tab
```

- The ID keeps the form of rule 4, `[A-Za-z0-9_-]+`, so that each valid 0.1 row ID stays valid. kramdown rejects an ID with a digit first. This is the only part outside the safe subset of finding 2.
- The bare value is the bare value of djot. Pandoc, djot, and the directive extension read it the same. Reason: principle 0, human editing first. `align=center` is easier to type and to read than `align="center"`.
- In a quoted value, `\"` is `"`, and `\\` is `\`. These are the two escapes that the Pandoc writer and the djot.js writer write. A backslash before another character is an error, so that each value has one form.
- A quoted value can hold `}`, `&`, and a space first. tbl-md reads them as text. A value with one of these characters is outside the safe subset of finding 2. A later export to Pandoc or kramdown must check them [guess].
- No single quotes, no comments, no line ends, no key with no value. These are not in the safe subset.
- `align` is the first known key. Its value is `left`, `center`, or `right`.

#### Canonical form

- `{#id .c1 .c2 k1=v1 k2="v 2"}`: the ID first, then the classes, then the pairs. This is the order of the Pandoc writer.
- The classes and the pairs keep their source order. The parser keeps them in lists, not in a set.
- One space between the parts. No space after `{` and no space before `}`.
- A value that matches `[A-Za-z0-9_:-]+` is bare. Each other value, also the empty value, has double quotes: `k=""`. Inside the quotes, `"` becomes `\"` and `\` becomes `\\`.
- A row: `-- {#a1 .hl}`. A row with no attributes: `--`.

#### Errors

Each error names the line and the column of the first bad character.

```tbl
error: Error
example: Example
--
error: Unexpected character in a block
example: `{.hl !}`
--
error: No space between two parts
example: `{#a.b}` or `{.a#b}`
--
error: Empty block
example: `{}` or `{ }`
--
error: Bad ID character
example: `{#a:b}`
--
error: Bad class (no letter first, or a bad character)
example: `{.1a}`
--
error: Bad key (no letter first, or a bad character)
example: `{1k=v}`
--
error: More than one ID
example: `{#a #b}`
--
error: Repeated key
example: `{k=1 k=2}`
--
error: Repeated class
example: `{.a .a}`
--
error: The key `id` or `class` (write `#x` or `.x`)
example: `{id=x}`
--
error: Key with no value
example: `{k}` or `{k=}`
--
error: Bare value with a character outside `[A-Za-z0-9_:-]` (add quotes)
example: `{k=a.b}`
--
error: Single quotes (use double quotes)
example: `{k='a'}`
--
error: Quoted value with no closing quote
example: `{k="a}`
--
error: Backslash before a character other than `"` or `\` in a quoted value
example: `{k="a\b"}`
--
error: Bad value of a known key (the error lists the values)
example: `{align=middle}`
--
error: Second attribute line for the same column or cell
example: `{.a}` on the line after `{.b}`
--
error: Attribute line at a place that takes no attributes
example: `{.a}` directly after `--`
```

The last row needs a rule of the format. Directly after `--`, the next line is the first line of a record, not the end of a cell. This report does not decide it.

## Critical analysis

### 1. Unquestioned premises

- The question takes for granted that the attribute syntax must be compatible with Pandoc, djot, and kramdown. But no tool other than tbl-md reads a `tbl` block. Thus the compatibility does not give data exchange. It gives familiarity: a human or an agent who knows `{#id .class}` can read the line. A better question is: "Which small syntax is easy to type and read in one table line?" The familiar form answers it. The edge cases of the other parsers are less important than precise errors in tbl-md.
- The question takes for granted that attributes belong in the table text. An alternative is no attributes in the table, and a separate map from row ID to data, for example in a Markgraf log. The scope of 0.2.0 already decides for attributes in the text, so this report does not discuss it further.
- The question takes for granted one standard. Finding 1 shows that no standard exists: even the two readers of Pandoc disagree.

### 2. The standard solution

The usual answer is the Pandoc attribute block. The control mechanisms:

- **Vendor lock-in**: none. Pandoc (GPL-2.0-or-later), djot.js (MIT), kramdown (MIT), and micromark (MIT) are open source [guess for the Pandoc license, from general knowledge].
- **Rent-seeking**: none. No tool needs a payment.
- **Telemetry** and **attention economy**: none in the parsers.
- **Centralization**: one person, John MacFarlane, maintains Pandoc, commonmark-hs, and djot [guess, from the repository owner `jgm` of all three]. The de facto syntax thus comes from one maintainer, not from a standard body. The CommonMark spec has had no attribute section since the start of the thread in 2014. GitHub controls GFM, and GitHub shows no attributes. Thus each attribute in a `tbl` block is invisible after a conversion to GFM. The spec of 0.2.0 handles this: the conversion fails unless the user gives `--drop-attributes`.

### 3. The autonomous architecture

- A grammar in `docs/format.md` of tbl-md, as a small protocol, with its own parser in tbl-md under the license of the project. The grammar is a subset of the familiar syntax, so that a later export to Pandoc or djot stays possible.
- No dependency on a parser outside the mdast and micromark family. This keeps principle 4.
- A test suite that runs the cases of finding 2 against the tbl-md parser. Optionally, a corpus test can compare the tbl-md parser with djot.js and Pandoc in a scratch folder, but not in the pre-push hook.

### 4. The cost of autonomy

- Own parser: about 150 lines and about 40 tests [guess]. If the grammar grows, the parser needs maintenance.
- Drift: if Pandoc or djot change their grammar, tbl-md does not follow by itself. The recheck of this report catches it.
- Usability: a user who knows Pandoc can expect single quotes, `{k=a.b}`, or comments. tbl-md rejects them. Each error message names the fix, so the cost is one edit.
- The strict form test makes each `{...}` line an attribute line. Thus a cell line that is literally `{...}` needs a backslash, for example a JSON object `{}`. The converter adds it. Only a human who types such a line by hand pays this cost.

## Sources

All opened on 2026-10-06.

- tbl-md, `docs/spec.md`, `docs/format.md`, `docs/research/table-corpus.md` (in this repository)
- Pandoc manual 3.12, sections Extension: `header_attributes`, `fenced_code_attributes`, `attributes`: https://raw.githubusercontent.com/jgm/pandoc/3.12/MANUAL.txt
- Pandoc Markdown reader 3.12, functions `attributes`, `identifierAttr`, `classAttr`, `keyValAttr`, `spnl`, `litChar`, `escapedChar'`: https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Readers/Markdown.hs
- Pandoc parsing helpers 3.12, function `enclosed`: https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Parsing/General.hs
- Pandoc Markdown writer 3.12, function `attrsToMarkdown`: https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Writers/Markdown/Inline.hs
- Pandoc djot writer 3.12: https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Writers/Djot.hs
- Pandoc 3.12 release binary: https://github.com/jgm/pandoc/releases/tag/3.12
- commonmark-hs, attribute extension: https://raw.githubusercontent.com/jgm/commonmark-hs/master/commonmark-extensions/src/Commonmark/Extensions/Attributes.hs
- commonmark-hs, HTML attribute names and values: https://raw.githubusercontent.com/jgm/commonmark-hs/master/commonmark/src/Commonmark/Tag.hs
- djot syntax reference: https://raw.githubusercontent.com/jgm/djot/main/doc/syntax.md
- djot.js attribute parser: https://raw.githubusercontent.com/jgm/djot.js/main/src/attributes.ts
- djot.js djot renderer: https://raw.githubusercontent.com/jgm/djot.js/main/src/djot-renderer.ts
- djot.js 0.3.2 package (`lib/index.js`, `lib/parse.js`, `package.json`): https://www.npmjs.com/package/@djot/djot
- kramdown syntax page: https://kramdown.gettalong.org/syntax.html
- kramdown 2.5.2 gem, `lib/kramdown/parser/kramdown/extensions.rb` and `lib/kramdown/converter/kramdown.rb`: https://github.com/gettalong/kramdown
- micromark-extension-directive 4.0.0, readme and `dev/lib/factory-attributes.js`: https://github.com/micromark/micromark-extension-directive
- mdast-util-directive 3.1.1: https://github.com/syntax-tree/mdast-util-directive
- markdown-it-attrs 5.0.1, README and `utils.js`: https://github.com/arve0/markdown-it-attrs
- npm registry entries: https://registry.npmjs.org/md-attr-parser, https://registry.npmjs.org/attributes-parser, https://registry.npmjs.org/remark-attr, https://registry.npmjs.org/@djot%2fdjot, https://registry.npmjs.org/micromark-extension-directive
- CommonMark forum, "Consistent attribute syntax": https://talk.commonmark.org/t/consistent-attribute-syntax/272 (JSON at `/t/consistent-attribute-syntax/272.json`)
- CommonMark spec 0.31.2, list of sections: https://spec.commonmark.org/0.31.2/spec.json
- skills.sh search API: https://www.skills.sh/api/search?q=attributes and `?q=djot`, `?q=pandoc-attributes`, `?q=markdown-attributes`
