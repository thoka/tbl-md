// The conversion of one table to and from a GFM pipe table (docs/format.md, section "Conversion to and from GFM").
// The conversion has no loss: each failure is an error, never a silent change.
import type { TableCell } from "mdast";
import type { FoundGfm } from "./markdown.ts";
import type { Row, Table } from "./parse.ts";
import { validate } from "./render.ts";

/** A problem of toGfm. `row` counts the data rows from 1. A problem of a title has a `key` and no `row`. */
export interface ConvertError {
  row?: number;
  key?: string;
  message: string;
}

/** A problem of fromGfm, at a 1-based line and column of the Markdown source. */
export interface GfmError {
  line: number;
  column: number;
  message: string;
}

export type ToGfmResult = { ok: true; text: string } | { ok: false; errors: ConvertError[] };
export type FromGfmResult = { ok: true; table: Table } | { ok: false; errors: GfmError[] };

/** A space or a tab: the characters that GFM trims at the start and the end of a cell. */
const edgeSpace = /^[ \t]|[ \t]$/;
/** A run of backslashes and the pipe after it. */
const pipeRun = /(\\*)\|/g;
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

/**
 * Writes a table as a GFM pipe table: the header row, the delimiter row `| --- |`, and one line per row.
 * The lines join with "\n", with no final newline. The result has the errors if the table cannot convert with no loss.
 */
export function toGfm(table: Table): ToGfmResult {
  const problems = validate(table);
  if (problems.length > 0) return { ok: false, errors: problems.map((message) => ({ message })) };

  const errors: ConvertError[] = [];
  const header = table.columns.map(({ key, title }) => {
    if (edgeSpace.test(title)) {
      errors.push({ key, message: `The title of column "${key}" starts or ends with a space or a tab. GFM removes it, so remove it from the title.` });
    }
    oddPipeRuns(title, (message) => errors.push({ key, message: `The title of column "${key}" ${message}` }));
    return escapePipes(title);
  });

  const lines = [row(header), row(table.columns.map(() => "---"))];
  table.rows.forEach((r, i) => {
    const cells = table.columns.map(({ key }, c) => {
      const text = r.cells[key] ?? "";
      const report = (message: string) => errors.push({ row: i + 1, key, message: `Row ${i + 1}, cell "${key}": ${message}` });
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
    report("the text starts or ends with a space or a tab. GFM removes it, so remove it from the cell.");
  }
  const lines = text.split("\n");
  lines.slice(0, -1).forEach((line, n) => {
    if (line.endsWith("\\")) {
      report(
        `line ${n + 1} ends with a backslash, and a line follows. The backslash would escape the \`<br>\` of the line break. Remove the backslash, or end the line with another character.`,
      );
    }
  });
  oddPipeRuns(text, report);
  // A literal `<br>` gets one backslash more. Only the exact `<br>` with no backslash before it is a line break.
  const joined = lines.map((line) => line.replace(brRun, "\\$1<br>")).join("<br>");
  return escapePipes(joined);
}

/** Reports a pipe after an odd number of backslashes: one backslash more gives an even run, and GFM splits the cell there. */
function oddPipeRuns(text: string, report: (message: string) => void): void {
  for (const match of text.matchAll(pipeRun)) {
    const k = match[1]!.length;
    if (k % 2 === 1) {
      report(
        `has a pipe after ${k} backslash${k === 1 ? "" : "es"}. In GFM, this pipe would split the cell. Write the pipe with no backslash (\`|\`), or with one backslash more (\`${"\\".repeat(k + 1)}|\`).`,
      );
      return;
    }
  }
}

/** A pipe after k backslashes (k even) gets one backslash more. */
function escapePipes(text: string): string {
  return text.replace(pipeRun, "\\$1|");
}

/** The ID marker goes to the end of the first cell. With no ID, a text that ends with the marker form gets one backslash more. */
function firstCell(cell: string, r: Row): string {
  if (r.id !== undefined) return cell === "" ? `{#${r.id}}` : `${cell} {#${r.id}}`;
  return cell.replace(markerForm, "$1\\$2$3");
}

/**
 * Reads a GFM table of a Markdown source as a table. `found` comes from `findTables(source)`.
 * Each cell text comes from the source by the offsets of its mdast cell, so that the inline Markdown stays byte for byte.
 * The keys come from the titles by `keysFromTitles`. The column alignment is dropped.
 */
export function fromGfm(source: string, found: FoundGfm): FromGfmResult {
  const errors: GfmError[] = [];
  const [headerRow, ...bodyRows] = found.node.children;
  const titles = headerRow!.children.map((cell) => unescapePipes(cellSource(source, cell).text));
  const keys = keysFromTitles(titles);
  const columns = titles.map((title, i) => ({ key: keys[i]!, title }));

  const rows = bodyRows.map((bodyRow, i) => {
    const cells: Record<string, string> = {};
    const r: Row = { cells };
    let excessReported = false;
    bodyRow.children.forEach((cell, c) => {
      const { text: raw, line, column } = cellSource(source, cell);
      if (c >= keys.length) {
        // GFM hides an excess cell. One with no text holds no content, so it is dropped.
        // The first one with text is an error, because GFM would hide that text.
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
          r.id = id[2]!;
          text = text.slice(0, id.index);
          if (/[ \t]$/.test(text)) {
            errors.push({
              line,
              column,
              message: `Row ${i + 1}, cell "${keys[0]}": the text before the ID marker ends with a space or a tab. Keep only one space before the marker, so that the cell converts back to GFM.`,
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

/** A pipe in a GFM cell always has an odd number of backslashes before it. It loses one. */
function unescapePipes(text: string): string {
  return text.replace(/\\(\\*)\|/g, "$1|");
}

/** The text of a cell in the source, with no pipe and no space or tab at its edges, and the place where the cell starts. */
function cellSource(source: string, cell: TableCell): { text: string; line: number; column: number } {
  const start = cell.position!.start;
  let text = source.slice(start.offset!, cell.position!.end.offset!);
  if (text.startsWith("|")) text = text.slice(1);
  // micromark ends the last cell at the end of the line, so the spaces and tabs after the closing pipe belong to it.
  // Remove them first, so that the closing pipe is at the end of the text.
  text = text.replace(/[ \t]+$/, "");
  // The last cell can end with the closing pipe. It is a delimiter if an even number of backslashes comes before it.
  const end = /(\\*)\|$/.exec(text);
  if (end && end[1]!.length % 2 === 0) text = text.slice(0, -1);
  return { text: text.replace(/^[ \t]+|[ \t]+$/g, ""), line: start.line, column: start.column };
}
