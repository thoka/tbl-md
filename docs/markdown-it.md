# The markdown-it plugin

The plugin renders each `tbl` block of a Markdown text as an HTML table, in each host that renders Markdown with markdown-it. Import it from `tbl-md/markdown-it` and give it to `md.use`:

```ts
import markdownit from "markdown-it";
import tblPlugin from "tbl-md/markdown-it";

const md = markdownit().use(tblPlugin);
md.render("```tbl\nmodel: Model\nprice: Price\n{align=right}\n--\nm: *Opus*\np: $15\n```\n");
// <table>
// <thead>
// <tr>
// <th>Model</th>
// <th style="text-align:right">Price</th>
// </tr>
// </thead>
// <tbody>
// <tr>
// <td><em>Opus</em></td>
// <td style="text-align:right">$15</td>
// </tr>
// </tbody>
// </table>
```

The plugin works on the engine that the host gives it, with the options and the rules of that engine. It does not load markdown-it itself. It does these steps:

- A core rule before the core rule `inline` replaces each valid `tbl` block with the token `tbl_open`, the table tokens of markdown-it (`table_open` to `table_close`, with `thead`, `tbody`, `tr`, `th`, and `td`), and the token `tbl_close`. A `tbl` block is a fenced code block whose info string is exactly `tbl`, with backticks or tildes, also in a list item or a block quote (rule 1 of `docs/format.md`). A table with no rows has no `tbody`, as in markdown-it.
- Each title and each cell is an `inline` token, so the inline rules of the host apply to it, for example emphasis, links, and the emoji of Discourse. A missing cell is an empty `td`.
- A second core rule after `inline` turns each soft line break in a cell into a hard line break. Thus each line break of a cell is a `<br>`, also with the option `breaks: false`.
- Each new token gets the `map` of the fence, so a preview can scroll to the block. `tbl_open.meta` has `source` (the text inside the fence), `table` (the result of `parse`), `info`, and `markup`.
- The renderer rules of `tbl_open` and `tbl_close` write nothing. A host can set them, for example to write a wrapper element. The plugin keeps a rule that the host set before.

The attributes go into the HTML by this mapping. The markdown-it renderer escapes each value:

```tbl
attr: Attribute
html: HTML
--
attr: `align` of a column
html: `style="text-align:left"`, `center`, or `right` on the `th` and on each `td` of the column, as in a GFM table of markdown-it.
--
attr: `#id`
html: `id`. The ID of a column goes only to its `th`. The ID of a row goes to its `tr`, and the ID of a cell to its `td`.
--
attr: `.class`
html: `class`. A class of a column goes to its `th` and to each `td` of the column, before the classes of the cell. A class comes once.
--
attr: `key=value`
html: `data-<key>="value"`, with the key in lower case. The key never becomes a plain attribute, so `onclick=x` gives `data-onclick="x"`. A pair of a column goes only to its `th`.
```

Two keys that differ only in case, such as `Note=a note=b` in one block, give the same data attribute. The later pair wins.

The plugin has one option, `attributes`. It is a hook that changes or drops the attributes of a column, a row, or a cell before they go into the HTML. The plugin calls it once for each column, each row, and each cell, also for a place with no attributes. The hook gets a copy of the attributes with no `align` pair, and the place: `{ kind: "column", key }`, `{ kind: "row", row }`, or `{ kind: "cell", key, row }`, where `row` counts the data rows from 1. It returns the attributes to use, or `null` to drop all of them. The `align` of a column never goes through the hook. A key from the hook must have the key form of rule 14, or the render throws an `Error`. For example, a host that keeps only the alignment and the IDs, with a prefix:

```ts
md.use(tblPlugin, {
  attributes: (attributes) => (attributes.id === undefined ? null : { id: `tbl-${attributes.id}`, classes: [], pairs: [] }),
});
```

An invalid `tbl` block stays the `fence` token, so the host shows it as its normal code block, with all its text. A fence with text after `tbl` in its info string is invalid too. The HTML has no error text. The plugin puts the errors into `token.meta.tblErrors` of the fence token, so that an editor preview can show them. Each error has a `line`, a `column`, a `code`, and a `message`, as the errors of `parse`: line 1 is the first line after the opening fence. The error `info-text` is at line 0, the opening fence. A fence with the info `TBL` or `tbl-x` is no `tbl` block, and the plugin does not touch it.

A host that loads a plain script and no ES module, such as a Discourse plugin, uses the file `dist/tbl-md-markdown-it.iife.js` of the package (the export `tbl-md/markdown-it.iife.js`). It is one minified file with no import and no `node:` module, about 13 KB (5 KB with gzip). It defines the global name `tblMdMarkdownIt`, and the plugin function is `tblMdMarkdownIt.default`:

```js
md.use(window.tblMdMarkdownIt.default);
```

The plugin types are `TblPluginOptions`, `TblPlace`, `TblOpenMeta`, `TblPluginError`, and `TblPluginErrorCode`. The type declarations of `tbl-md/markdown-it` use the types of markdown-it, which markdown-it ships.

Two small differences from the GFM form of a table remain. A line break inside a code span is a space in the plugin HTML, and the GFM form shows the text `<br>` in the code. The spaces at the start of a continuation line of a cell are not in the HTML.

