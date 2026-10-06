// The HTML check of a conversion (docs/format.md, section Conversion to and from GFM, "The HTML check").
// It renders each title and each cell of a converted table with the flavor, in the GFM form and in the tbl form,
// and reports each title and cell whose HTML differs.
import type { MarkdownIt, Token } from "markdown-it";
import { gfmCellForm } from "./gfm.ts";
import type { Table } from "./parse.ts";

/** A title or a cell whose HTML differs. A title has no `row`. `row` counts the data rows from 0. */
export interface HtmlDifference {
  row?: number;
  /** The index of the column, from 0. */
  column: number;
  /** The HTML of the GFM form. */
  gfm: string;
  /** The HTML of the tbl form. */
  tbl: string;
}

/** A Markdown text as the flavor parses it, with the reference definitions in `env`. */
export interface Parsed {
  tokens: Token[];
  env: Record<string, unknown>;
}

/** Parses a Markdown text with the flavor, and keeps its reference definitions. */
export function parseText(md: MarkdownIt, text: string): Parsed {
  const env: Record<string, unknown> = {};
  return { tokens: md.parse(text, env), env };
}

/**
 * Compares the HTML of a GFM table in a Markdown text with the HTML of a table in the tbl form.
 * `line` is the 0-based line of the header row of the GFM table in `gfmText`, which parseText made. The HTML of a GFM
 * cell is the HTML of that cell when the flavor renders the whole text. The HTML of a tbl cell is the inline HTML of its
 * text in the form that toGfm writes, with no pipe escape. Both use the reference definitions of `gfmText`.
 */
export function htmlDifferences(md: MarkdownIt, gfmText: Parsed, line: number, table: Table): HtmlDifference[] {
  const { tokens, env } = gfmText;
  const open = tokens.findIndex((t) => t.type === "table_open" && t.map?.[0] === line);
  if (open < 0) throw new Error(`No GFM table starts at line ${line + 1}.`);
  const rows: Token[][] = [];
  for (let i = open + 1; tokens[i]!.type !== "table_close"; i++) {
    const token = tokens[i]!;
    if (token.type === "tr_open") rows.push([]);
    else if (token.type === "inline") rows[rows.length - 1]!.push(token);
  }
  const differences: HtmlDifference[] = [];
  // The inline content of a GFM cell is the text that the inline parser reads. If the tbl form is the same text, the
  // HTML is the same, because the core rules of markdown-it work on each inline token alone. Only the others render.
  const compare = (row: number, column: number, tblForm: string, at: Omit<HtmlDifference, "gfm" | "tbl">) => {
    const token = rows[row]?.[column];
    if ((token?.content ?? "") === tblForm) return;
    const gfm = token === undefined ? "" : md.renderer.renderInline(token.children ?? [], md.options, env);
    const tbl = md.renderInline(tblForm, env);
    if (gfm !== tbl) differences.push({ ...at, gfm, tbl });
  };
  table.columns.forEach((c, column) => compare(0, column, c.title, { column }));
  table.rows.forEach((r, row) => {
    table.columns.forEach((c, column) => compare(row + 1, column, gfmCellForm(r.cells[c.key] ?? "", r, column === 0), { row, column }));
  });
  return differences;
}
