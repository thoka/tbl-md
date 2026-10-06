// The conversion of one table to and from a GFM pipe table (docs/format.md, section "Conversion to and from GFM").
// The conversion has no loss: each failure is an error, never a silent change.
import { renderAttributes, type Attributes } from "./attributes.ts";
import type { FoundGfm, GfmCell } from "./markdown.ts";
import type { Column, Row, Table } from "./parse.ts";
import { validate } from "./render.ts";

/**
 * A problem of toGfm. `row` counts the data rows from 1. A problem of a title has a `key` and no `row`.
 * A problem of an attribute block has `attribute`: a column block has the `key`, a row block has the `row`,
 * and a cell block has both.
 */
export interface ConvertError {
  row?: number;
  key?: string;
  /** The kind of the attribute block with no GFM form. */
  attribute?: "column" | "row" | "cell";
  message: string;
}

export interface ToGfmOptions {
  /** Drops each attribute with no GFM form, with no error. `toGfm` keeps the `align` of the columns and the ID of the rows. */
  dropAttributes?: boolean;
}

/** A problem of fromGfm, at a 1-based line and column of the Markdown source. */
export interface GfmError {
  line: number;
  column: number;
  message: string;
}

export type ToGfmResult = { ok: true; text: string } | { ok: false; errors: ConvertError[] };
export type FromGfmResult = { ok: true; table: Table } | { ok: false; errors: GfmError[] };

/**
 * A character at the start or the end of a text that markdown-it trims at the edges of a cell: each character that
 * String.prototype.trim removes (`\s`), but not a line feed, because a line break of a cell becomes `<br>`.
 */
const edgeSpace = /^(?!\n)\s|(?!\n)\s$/;
/** The message part that names the characters of the trim. */
const trimmed = "a space, a tab, or another character that markdown-it trims, such as a no-break space (U+00A0)";
/** A run of backslashes and the `<br>` after it. */
const brRun = /(\\*)<br>/g;
/** The ID marker at the end of the first GFM cell, at the start or after one space. */
const marker = /(^| )\{#([A-Za-z0-9_-]+)\}$/;
/** The marker form with a run of backslashes before the `{`, at the start or after a space. */
const markerForm = /(^| )(\\*)(\{#[A-Za-z0-9_-]+\})$/;

/**
 * Makes the keys of a GFM table from its titles: lower case, each run of characters other than [a-z0-9] becomes `-`,
 * and no `-` at the start or the end. An empty key becomes `c` and the column number (from 1).
 * The first column with a key keeps it. A later column with the same key gets the smallest suffix `-2`, `-3`, ...
 * that no other column has, so that a suffixed key never collides with the key of another title.
 */
export function keysFromTitles(titles: string[]): string[] {
  const bases = titles.map((title, i) => {
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return key === "" ? `c${i + 1}` : key;
  });
  const taken = new Set(bases);
  const used = new Set<string>();
  return bases.map((base) => {
    if (!used.has(base)) {
      used.add(base);
      return base;
    }
    let n = 2;
    while (taken.has(`${base}-${n}`) || used.has(`${base}-${n}`)) n++;
    const key = `${base}-${n}`;
    used.add(key);
    return key;
  });
}

/** The delimiter mark of a column: `:---`, `:---:`, or `---:` for its `align`, and `---` with no `align`. */
function delimiterOf(column: Column): string {
  const align = alignOf(column);
  return align === "left" ? ":---" : align === "center" ? ":---:" : align === "right" ? "---:" : "---";
}

/** The `align` of a column, or undefined. */
function alignOf(column: Column): string | undefined {
  return column.attributes?.pairs.find((p) => p.key === "align")?.value;
}

/**
 * The table that GFM can hold: the `align` of the columns, the ID of the rows, and no cell attributes.
 * A column or a row with nothing left has no `attributes`. `toGfm` with `dropAttributes` writes this table.
 */
export function gfmView(table: Table): Table {
  return {
    columns: table.columns.map((c) => {
      const column: Column = { key: c.key, title: c.title };
      const align = alignOf(c);
      if (align !== undefined) column.attributes = { classes: [], pairs: [{ key: "align", value: align }] };
      return column;
    }),
    rows: table.rows.map((r) => {
      const row: Row = { cells: r.cells };
      const id = r.attributes?.id;
      if (id !== undefined) row.attributes = { id, classes: [], pairs: [] };
      return row;
    }),
  };
}

/**
 * The parts of an attribute block with no GFM form, in the canonical form with no braces, and their number.
 * It gives undefined if each part has a GFM form. `keep` names the parts that GFM holds at this place.
 */
function lossyParts(attributes: Attributes | undefined, keep: { id: boolean; align: boolean }): { text: string; count: number } | undefined {
  if (attributes === undefined) return undefined;
  const lossy: Attributes = {
    classes: attributes.classes,
    pairs: attributes.pairs.filter((p) => !(keep.align && p.key === "align")),
  };
  if (!keep.id && attributes.id !== undefined) lossy.id = attributes.id;
  const count = (lossy.id === undefined ? 0 : 1) + lossy.classes.length + lossy.pairs.length;
  if (count === 0) return undefined;
  return { text: renderAttributes(lossy).slice(1, -1), count };
}

/**
 * Reports the parts of an attribute block with no GFM form, with the two fixes. `where` starts the message,
 * and `why` says what GFM holds at this place.
 */
function reportLossy(
  attributes: Attributes | undefined,
  keep: { id: boolean; align: boolean },
  error: Omit<ConvertError, "message">,
  where: string,
  why: string,
  errors: ConvertError[],
): void {
  const parts = lossyParts(attributes, keep);
  if (parts === undefined) return;
  const what = parts.count === 1 ? `the attribute \`${parts.text}\` has` : `the attributes \`${parts.text}\` have`;
  const them = parts.count === 1 ? "it" : "them";
  errors.push({ ...error, message: `${where}: ${what} no GFM form, because ${why}. Remove ${them}, or convert with --drop-attributes to drop ${them}.` });
}

/**
 * Writes a table as a GFM pipe table: the header row, the delimiter row with the alignment of each column, and one line per row.
 * The lines join with "\n", with no final newline. The result has the errors if the table cannot convert with no loss.
 * An attribute with no GFM form is an error, unless `options.dropAttributes` is true.
 */
export function toGfm(table: Table, options: ToGfmOptions = {}): ToGfmResult {
  const problems = validate(table);
  if (problems.length > 0) return { ok: false, errors: problems.map((message) => ({ message })) };

  const errors: ConvertError[] = [];
  const strict = !options.dropAttributes;
  const header = table.columns.map(({ key, title, attributes }) => {
    if (strict) {
      reportLossy(attributes, { id: false, align: true }, { key, attribute: "column" }, `Column "${key}"`, "GFM keeps only the align of a column", errors);
    }
    if (edgeSpace.test(title)) {
      errors.push({ key, message: `The title of column "${key}" starts or ends with ${trimmed}. GFM removes it, so remove it from the title.` });
    }
    return escapePipes(title);
  });

  const lines = [row(header), row(table.columns.map(delimiterOf))];
  table.rows.forEach((r, i) => {
    if (strict) {
      reportLossy(r.attributes, { id: true, align: false }, { row: i + 1, attribute: "row" }, `Row ${i + 1}`, "GFM keeps only the ID of a row", errors);
    }
    const cells = table.columns.map(({ key }, c) => {
      const text = r.cells[key] ?? "";
      const report = (message: string) => errors.push({ row: i + 1, key, message: `Row ${i + 1}, cell "${key}": ${message}` });
      if (strict) {
        const where = `Row ${i + 1}, cell "${key}"`;
        reportLossy(r.cellAttributes?.[key], { id: false, align: false }, { row: i + 1, key, attribute: "cell" }, where, "GFM has no attributes for a cell", errors);
      }
      const cell = cellToGfm(text, report);
      return c === 0 ? firstCell(cell, r) : cell;
    });
    lines.push(row(cells));
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, text: lines.join("\n") };
}

function row(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/** Maps a tbl cell text to a GFM cell text, and reports each part that would get lost. */
function cellToGfm(text: string, report: (message: string) => void): string {
  if (edgeSpace.test(text)) {
    report(`the text starts or ends with ${trimmed}. GFM removes it, so remove it from the cell.`);
  }
  const lines = text.split("\n");
  lines.slice(0, -1).forEach((line, n) => {
    if (line.endsWith("\\")) {
      report(
        `line ${n + 1} ends with a backslash, and a line follows. The backslash would escape the \`<br>\` of the line break. Remove the backslash, or end the line with another character.`,
      );
    }
  });
  // A literal `<br>` gets one backslash more. Only the exact `<br>` with no backslash before it is a line break.
  const joined = lines.map((line) => line.replace(brRun, "\\$1<br>")).join("<br>");
  return escapePipes(joined);
}

/** Each pipe gets one backslash more (the pipe rule). markdown-it never splits a cell at a pipe with a backslash before it. */
function escapePipes(text: string): string {
  return text.replaceAll("|", "\\|");
}

/** The ID marker goes to the end of the first cell. With no ID, a text that ends with the marker form gets one backslash more. */
function firstCell(cell: string, r: Row): string {
  const id = r.attributes?.id;
  if (id !== undefined) return cell === "" ? `{#${id}}` : `${cell} {#${id}}`;
  return cell.replace(markerForm, "$1\\$2$3");
}

/**
 * Reads a GFM table of a Markdown source as a table. `found` comes from `findTables(source)` with the same flavor.
 * Each cell text is the source cell of `found`, so that the inline Markdown stays byte for byte. `source` is the text
 * that `found` comes from; the cells of `found` already hold its text.
 * The keys come from the titles by `keysFromTitles`. A column with an alignment gets the attributes `{align=...}`.
 */
export function fromGfm(source: string, found: FoundGfm): FromGfmResult {
  const errors: GfmError[] = [];
  const titles = found.header.cells.map((cell) => unescapePipes(cell.text));
  const keys = keysFromTitles(titles);
  const columns = titles.map((title, i): Column => {
    const column: Column = { key: keys[i]!, title };
    const align = found.align[i];
    if (align) column.attributes = { classes: [], pairs: [{ key: "align", value: align }] };
    return column;
  });

  const rows = found.rows.map((bodyRow, i) => {
    const cells: Record<string, string> = {};
    const r: Row = { cells };
    let excessReported = false;
    bodyRow.cells.forEach(({ text: raw, line, column }: GfmCell, c) => {
      if (c >= keys.length) {
        // markdown-it drops an excess cell. One with no text holds no content, so it is dropped.
        // The first one with text is an error, because markdown-it would hide that text.
        if (raw === "" || excessReported) return;
        excessReported = true;
        errors.push({
          line,
          column,
          message: `Row ${i + 1} has more cells than the header (${keys.length}). GFM drops cell ${c + 1}, so add a column for it or remove it.`,
        });
        return;
      }
      let text = raw;
      if (c === 0) {
        const id = marker.exec(text);
        if (id) {
          r.attributes = { id: id[2]!, classes: [], pairs: [] };
          text = text.slice(0, id.index);
          if (/\s$/.test(text)) {
            errors.push({
              line,
              column,
              message: `Row ${i + 1}, cell "${keys[0]}": the text before the ID marker ends with ${trimmed}. Keep only one space before the marker, so that the cell converts back to GFM.`,
            });
          }
        } else {
          text = text.replace(markerForm, (_, space: string, run: string, form: string) => space + run.slice(1) + form);
        }
      }
      const value = cellFromGfm(text, (message) => errors.push({ line, column, message: `Row ${i + 1}, cell "${keys[c]}": ${message}` }));
      if (value !== "") cells[keys[c]!] = value;
    });
    return r;
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, table: { columns, rows } };
}

/** Maps a GFM cell text to a tbl cell text. */
function cellFromGfm(text: string, report: (message: string) => void): string {
  if (/(^|[^\\])<br>$/.test(text)) {
    report("the text ends with `<br>`. A tbl cell never ends with a line break, so remove the last `<br>`.");
  }
  // The exact `<br>` is a line break. A `<br>` after backslashes loses one backslash.
  return unescapePipes(text).replace(brRun, (_, run: string) => (run === "" ? "\n" : `${run.slice(1)}<br>`));
}

/** The pipe rule: each pipe with a backslash directly before it loses that one backslash, as markdown-it removes it. */
function unescapePipes(text: string): string {
  return text.replaceAll("\\|", "|");
}
