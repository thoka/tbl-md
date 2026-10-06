// The markdown-it plugin of tbl-md: it renders each valid tbl block as an HTML table (README, section The markdown-it
// plugin). It works on the engine of the host and imports markdown-it only as types, so a bundle of this module has
// no markdown-it in it. It must not import index.ts or any module that reaches a `node:` module, because the IIFE
// bundle runs in a browser and in the server context of Discourse (scripts/bundle.ts fails on a `node:` import).
import type { MarkdownIt, StateCore, Token } from "markdown-it";
import type { Attributes } from "./attributes.ts";
import { splitInfo } from "./info.ts";
import { parse, type Table, type TblErrorCode } from "./parse.ts";

/** The thing that the attributes hook describes. `row` counts the data rows from 1. */
export type TblPlace =
  | { kind: "column"; key: string }
  | { kind: "row"; row: number }
  | { kind: "cell"; key: string; row: number };

export interface TblPluginOptions {
  /**
   * Changes or drops the attributes of a column, a row, or a cell before they go into the HTML. The plugin calls it
   * once for each column, each row, and each cell, also for a place with no attributes (then with no ID, no classes,
   * and no pairs). It gets a copy with no `align` pair, so it can change the object. It returns the attributes to use,
   * or null to drop all of them. The `align` of a column never goes through the hook. Default: no change.
   */
  attributes?: (attributes: Attributes, place: TblPlace) => Attributes | null;
}

/** The `meta` of a `tbl_open` token. */
export interface TblOpenMeta {
  /** The text inside the fence, with no final line end. */
  source: string;
  /** The table that `parse` gives for `source`. */
  table: Table;
  /** The info string and the fence markup of the fence token. */
  info: string;
  markup: string;
}

/** The code `info-text` is a fence with text after `tbl` in its info string (rule 1). The other codes are the codes of `parse`. */
export type TblPluginErrorCode = TblErrorCode | "info-text";

/** An error of an invalid tbl block, in `token.meta.tblErrors` of its `fence` token. */
export interface TblPluginError {
  /** 1-based line in the block text, as in the errors of `parse`. Line 0 is the opening fence (the code `info-text`). */
  line: number;
  /** 1-based column in the line. */
  column: number;
  code: TblPluginErrorCode;
  message: string;
}

const KEY_FORM = /^[A-Za-z][A-Za-z0-9_-]*$/;

/**
 * The markdown-it plugin. Use it with `md.use(tblPlugin, options)`.
 * A valid tbl block becomes the tokens `tbl_open`, the table tokens of markdown-it, and `tbl_close`. An invalid block
 * stays a `fence` token with `meta.tblErrors`, so the host shows it as its normal code block.
 */
export default function tblPlugin(md: MarkdownIt, options: TblPluginOptions = {}): void {
  // Before the core rule inline, so that the cells get the inline rules of the host, and after each core rule of the
  // host that changes the fence content after the block parse (as the link pipe restore of Discourse does).
  md.core.ruler.before("inline", "tbl", (state) => replaceFences(state, options));
  // After the core rule inline: a line break of a cell is always a <br>, also with `breaks: false`.
  md.core.ruler.after("inline", "tbl_breaks", hardBreaks);
  // The wrapper tokens write nothing. A host can set these rules, for example to write a wrapper element.
  md.renderer.rules.tbl_open ??= () => "";
  md.renderer.rules.tbl_close ??= () => "";
}

function replaceFences(state: StateCore, options: TblPluginOptions): void {
  if (state.inlineMode) return;
  const tokens = state.tokens;
  if (!tokens.some((token) => token.type === "fence")) return;
  const out: Token[] = [];
  for (const token of tokens) {
    if (token.type !== "fence") {
      out.push(token);
      continue;
    }
    const [lang, meta] = splitInfo(state.md.utils.unescapeAll(token.info));
    if (lang !== "tbl") {
      out.push(token);
      continue;
    }
    const source = token.content.endsWith("\n") ? token.content.slice(0, -1) : token.content;
    const result = parse(source);
    if (meta !== null || !result.ok) {
      const errors: TblPluginError[] = [];
      if (meta !== null) {
        errors.push({
          line: 0,
          column: 1,
          code: "info-text",
          message: `The info string has text after \`tbl\`: "${meta}". The info string must be exactly \`tbl\`.`,
        });
      }
      if (!result.ok) errors.push(...result.errors);
      token.meta = { ...(token.meta ?? {}), tblErrors: errors };
      out.push(token);
      continue;
    }
    out.push(...tableTokens(state, token, source, result.table, options));
  }
  state.tokens = out;
}

/** The tokens of one valid block. Each token gets the `map` of the fence. */
function tableTokens(state: StateCore, fence: Token, source: string, table: Table, options: TblPluginOptions): Token[] {
  const out: Token[] = [];
  let level = fence.level;
  const push = (type: string, tag: string, nesting: 1 | 0 | -1): Token => {
    const token = new state.Token(type, tag, nesting);
    token.block = true;
    if (fence.map) token.map = [fence.map[0], fence.map[1]];
    if (nesting < 0) level--;
    token.level = level;
    if (nesting > 0) level++;
    out.push(token);
    return token;
  };
  const inline = (content: string) => {
    const token = push("inline", "", 0);
    token.content = content;
    token.children = [];
  };
  const hook = options.attributes ?? ((attributes: Attributes) => attributes);

  const open = push("tbl_open", "", 1);
  open.info = fence.info;
  open.markup = fence.markup;
  const meta: TblOpenMeta = { source, table, info: fence.info, markup: fence.markup };
  open.meta = meta as unknown as Record<string, unknown>;

  const columns = table.columns.map((column) => ({
    key: column.key,
    title: column.title,
    align: column.attributes?.pairs.find((pair) => pair.key === "align")?.value,
    attributes: hook(withoutAlign(column.attributes), { kind: "column", key: column.key }),
  }));

  push("table_open", "table", 1);
  push("thead_open", "thead", 1);
  push("tr_open", "tr", 1);
  for (const column of columns) {
    const th = push("th_open", "th", 1);
    if (column.align !== undefined) th.attrSet("style", `text-align:${column.align}`);
    applyAttributes(th, column.attributes);
    inline(column.title);
    push("th_close", "th", -1);
  }
  push("tr_close", "tr", -1);
  push("thead_close", "thead", -1);

  if (table.rows.length > 0) {
    push("tbody_open", "tbody", 1);
    table.rows.forEach((row, index) => {
      const number = index + 1;
      const tr = push("tr_open", "tr", 1);
      applyAttributes(tr, hook(withoutAlign(row.attributes), { kind: "row", row: number }));
      for (const column of columns) {
        const td = push("td_open", "td", 1);
        if (column.align !== undefined) td.attrSet("style", `text-align:${column.align}`);
        // A class of the column goes to each cell of the column, before the classes of the cell.
        for (const name of column.attributes?.classes ?? []) joinClass(td, name);
        applyAttributes(td, hook(withoutAlign(row.cellAttributes?.[column.key]), { kind: "cell", key: column.key, row: number }));
        inline(row.cells[column.key] ?? "");
        push("td_close", "td", -1);
      }
      push("tr_close", "tr", -1);
    });
    push("tbody_close", "tbody", -1);
  }

  push("table_close", "table", -1);
  push("tbl_close", "", -1);
  return out;
}

/** A copy of the attributes with no `align` pair, or empty attributes. */
function withoutAlign(attributes: Attributes | undefined): Attributes {
  const copy: Attributes = {
    classes: [...(attributes?.classes ?? [])],
    pairs: (attributes?.pairs ?? []).filter((pair) => pair.key !== "align").map((pair) => ({ ...pair })),
  };
  if (attributes?.id !== undefined) copy.id = attributes.id;
  return copy;
}

/**
 * Sets the attributes on a token: the ID as `id`, the classes as `class`, and each pair as `data-<key in lower case>`.
 * Two keys that differ only in case give the same name, and the later pair wins. The renderer of markdown-it escapes
 * each value. A key from the hook must have the key form of rule 14, because it becomes part of an attribute name.
 */
function applyAttributes(token: Token, attributes: Attributes | null | undefined): void {
  if (attributes === null || attributes === undefined) return;
  if (attributes.id !== undefined) token.attrSet("id", attributes.id);
  for (const name of attributes.classes) joinClass(token, name);
  for (const { key, value } of attributes.pairs) {
    if (!KEY_FORM.test(key)) {
      throw new Error(`tbl-md: the attributes hook gave the key "${key}". A key starts with a letter, then letters, digits, "_", and "-".`);
    }
    // A known key never becomes a data attribute. The plugin writes `align` of a column as `style`.
    if (key === "align") continue;
    token.attrSet(`data-${key.toLowerCase()}`, value);
  }
}

/** Adds a class to the `class` attribute, once. */
function joinClass(token: Token, name: string): void {
  const current = token.attrGet("class");
  if (current !== null && String(current).split(" ").includes(name)) return;
  token.attrJoin("class", name);
}

/** Turns each soft line break inside a cell of a tbl block into a hard line break. */
function hardBreaks(state: StateCore): void {
  let inside = false;
  for (const token of state.tokens) {
    if (token.type === "tbl_open") inside = true;
    else if (token.type === "tbl_close") inside = false;
    else if (inside && token.type === "inline") {
      for (const child of token.children ?? []) {
        if (child.type === "softbreak") child.type = "hardbreak";
      }
    }
  }
}
