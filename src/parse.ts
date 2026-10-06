// The parser of a tbl block (docs/format.md, rules 2 to 10, 12, and 13 to 16).
// A line ends with LF, CRLF, or CR, as in CommonMark.
// It reads the text inside the fence. The fence and its info string are not part of the text.
import { parseAttributes, type AttributeErrorCode, type AttributePlace, type Attributes } from "./attributes.ts";
import { attributeLine, keyLine, separatorLine, unescapeLine } from "./syntax.ts";

export interface Column {
  key: string;
  title: string;
  /** The attributes of the column, from the attribute line after its header key line. */
  attributes?: Attributes;
}

export interface Row {
  /** The attributes of the row, from its `--` line. The row ID is `attributes.id`. */
  attributes?: Attributes;
  /** Only the cells with text, by the full header key. */
  cells: Record<string, string>;
  /** The attributes of the cells, by the full header key. A cell can have attributes and no text. */
  cellAttributes?: Record<string, Attributes>;
}

export interface Table {
  columns: Column[];
  rows: Row[];
}

export type TblErrorCode =
  | "no-header"
  | "header-not-key"
  | "header-duplicate-key"
  | "unknown-key"
  | "ambiguous-key"
  | "duplicate-key"
  | "orphan-line"
  | AttributeErrorCode;

export interface TblError {
  /** 1-based line in the block text. Line 1 is the first line after the opening fence. */
  line: number;
  /** 1-based column. */
  column: number;
  code: TblErrorCode;
  message: string;
}

export type ParseResult = { ok: true; table: Table } | { ok: false; errors: TblError[] };

interface Line {
  text: string;
  /** 1-based line number in the block. */
  number: number;
}

interface Record_ {
  /** The attribute block of the `--` line, and its 1-based column. */
  block?: { text: string; column: number };
  /** 1-based block line of the separator. The header record has none. */
  separator?: number;
  lines: Line[];
}

type Report = (line: number, code: TblErrorCode, message: string, column?: number) => void;

/** Parses the text inside a tbl fence. It collects all errors and does not stop at the first one. */
export function parse(text: string): ParseResult {
  const errors: TblError[] = [];
  const error: Report = (line, code, message, column = 1) => errors.push({ line, column, code, message });

  const records = splitRecords(text);
  const header = records[0]!;
  const columns = parseHeader(header.lines, error);
  if (columns.length === 0 && header.lines.length === 0) {
    error(1, "no-header", "The block has no header. The first record must map each key to a title, for example `key: Title`.");
  }

  const keys = columns.map((c) => c.key);
  // With no header key, each key of a data record would be an error too, so the parser skips the data records.
  const rows = keys.length === 0 ? [] : records.slice(1).map((record) => parseRecord(record, keys, error));

  // Array.prototype.sort is stable, so errors on the same line keep their order.
  if (errors.length > 0) return { ok: false, errors: errors.sort((a, b) => a.line - b.line || a.column - b.column) };
  return { ok: true, table: { columns, rows } };
}

/** Splits the block at the separator lines, and drops the empty lines at the start and the end of each record (rule 7). */
function splitRecords(text: string): Record_[] {
  const records: Record_[] = [{ lines: [] }];
  text.split(/\r\n|\r|\n/).forEach((line, i) => {
    const separator = separatorLine.exec(line);
    if (separator) {
      const record: Record_ = { lines: [], separator: i + 1 };
      if (separator[2] !== undefined) record.block = { text: separator[2], column: 3 + separator[1]!.length };
      records.push(record);
    } else {
      records[records.length - 1]!.lines.push({ text: line, number: i + 1 });
    }
  });
  for (const record of records) record.lines = trimEmpty(record.lines);
  return records;
}

function trimEmpty(lines: Line[]): Line[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]!.text === "") start++;
  while (end > start && lines[end - 1]!.text === "") end--;
  return lines.slice(start, end);
}

/**
 * Reads an attribute block at its place and reports its first error. `column` is the 1-based column of its `{`.
 * It gives the attributes, or undefined after an error.
 */
function readAttributes(block: string, place: AttributePlace, line: number, column: number, error: Report): Attributes | undefined {
  const result = parseAttributes(block, place);
  if (result.ok) return result.attributes;
  error(line, result.error.code, result.error.message, column + result.error.offset);
  return undefined;
}

/** The block of a line in the attribute form, with no spaces or tabs after the `}`. */
function blockOf(line: Line): string | undefined {
  return attributeLine.exec(line.text)?.[1];
}

function parseHeader(lines: Line[], error: Report): Column[] {
  const columns: Column[] = [];
  // What the previous line was: a key line (with its column, or null after an error), the attribute line of a column, or other.
  let previous: { kind: "key"; column: Column | null } | { kind: "attributes"; key: string } | null = null;
  for (const line of lines) {
    const block = blockOf(line);
    if (block !== undefined) {
      // A place error wins over a grammar error, so the parser reads a block only at a right place.
      if (previous?.kind === "key") {
        const attributes = readAttributes(block, "column", line.number, 1, error);
        if (attributes !== undefined && previous.column !== null) previous.column.attributes = attributes;
        previous = { kind: "attributes", key: previous.column?.key ?? "" };
      } else if (previous?.kind === "attributes") {
        error(
          line.number,
          "attr-second-line",
          `The column "${previous.key}" has an attribute line already. A column has one attribute line at most, so merge the two blocks into one line.`,
        );
      } else {
        error(
          line.number,
          "attr-misplaced",
          "This attribute line follows no header key line, so it describes no column. Put it directly after the key line of its column, with no empty line between them.",
        );
      }
      continue;
    }
    const match = keyLine.exec(line.text);
    if (!match) {
      const what = line.text === "" ? "an empty line" : "no key line";
      error(line.number, "header-not-key", `The header has ${what} here. Each header line must have the form \`key: Title\`.`);
      previous = null;
      continue;
    }
    const key = match[1]!;
    if (columns.some((c) => c.key === key)) {
      error(line.number, "header-duplicate-key", `The header has the key "${key}" two times.`);
      previous = { kind: "key", column: null };
      continue;
    }
    const column: Column = { key, title: keyText(line.text, key) };
    columns.push(column);
    previous = { kind: "key", column };
  }
  return columns;
}

/** The text of a key line starts after the colon and one space (rule 3). */
function keyText(line: string, key: string): string {
  const rest = line.slice(key.length + 1);
  return rest.startsWith(" ") ? rest.slice(1) : rest;
}

/** Finds the header key for a key or a prefix (rule 5). */
function resolve(key: string, keys: string[]): { key: string } | { candidates: string[] } {
  if (keys.includes(key)) return { key };
  const candidates = keys.filter((k) => k.startsWith(key));
  if (candidates.length === 1) return { key: candidates[0]! };
  return { candidates };
}

/** The lines of one cell: its key line and the lines after it. `key` is null after an error of the key line. */
interface Cell {
  key: string | null;
  first: string;
  lines: Line[];
}

function parseRecord(record: Record_, keys: string[], error: Report): Row {
  const cells: Record<string, string> = {};
  const cellAttributes: Record<string, Attributes> = {};
  const row: Row = { cells };
  if (record.block !== undefined) {
    const attributes = readAttributes(record.block.text, "row", record.separator!, record.block.column, error);
    if (attributes !== undefined) row.attributes = attributes;
  }

  let current: Cell | null = null;
  const seen = new Set<string>();
  const finish = () => {
    if (current === null) return;
    const { text, attributes } = finishCell(current, error);
    if (current.key === null) return;
    // An empty cell counts as missing (rule 8).
    if (text !== "") cells[current.key] = text;
    if (attributes !== undefined) cellAttributes[current.key] = attributes;
  };

  for (const line of record.lines) {
    const match = keyLine.exec(line.text);
    if (match) {
      finish();
      current = { key: null, first: keyText(line.text, match[1]!), lines: [] };
      const resolved = resolve(match[1]!, keys);
      if ("candidates" in resolved) {
        if (resolved.candidates.length === 0) {
          error(line.number, "unknown-key", `The key "${match[1]}" matches no header key. The header keys are: ${keys.join(", ")}.`);
        } else {
          error(line.number, "ambiguous-key", `The key "${match[1]}" is a prefix of more than one header key: ${resolved.candidates.join(", ")}.`);
        }
        continue;
      }
      if (seen.has(resolved.key)) {
        error(line.number, "duplicate-key", `The record has the key "${resolved.key}" more than one time.`);
        continue;
      }
      seen.add(resolved.key);
      current.key = resolved.key;
      continue;
    }
    if (current === null) {
      if (blockOf(line) !== undefined) {
        error(
          line.number,
          "attr-misplaced",
          "This attribute line comes before the first key of the record, so it describes nothing. Write the attributes of the row on its `--` line, for example `-- {.new}`.",
        );
      } else if (line.text !== "") {
        error(line.number, "orphan-line", "This line comes before the first key of the record, so it belongs to no cell.");
      }
      continue;
    }
    current.lines.push(line);
  }
  finish();
  if (Object.keys(cellAttributes).length > 0) row.cellAttributes = cellAttributes;
  return row;
}

/**
 * Reads the lines of a cell (rule 13). The first attribute line that only empty lines and attribute lines follow describes the cell.
 * An earlier attribute line is in the middle of the cell, and a later one is a second attribute line.
 * The text ends at the last text line, so the empty lines before the attribute line are not content (rule 7).
 */
function finishCell(cell: Cell, error: Report): { text: string; attributes?: Attributes } {
  const isText = (line: Line) => line.text !== "" && blockOf(line) === undefined;
  let last = -1;
  cell.lines.forEach((line, i) => {
    if (isText(line)) last = i;
  });
  let attributes: Attributes | undefined;
  let described = false;
  const name = cell.key === null ? "This cell" : `The cell "${cell.key}"`;
  cell.lines.forEach((line, i) => {
    const block = blockOf(line);
    if (block === undefined) return;
    if (i < last) {
      error(
        line.number,
        "attr-misplaced",
        `This attribute line is in the middle of a cell. The attribute line of a cell must be its last line. If the line is text, add a backslash: \\${block}.`,
      );
    } else if (described) {
      error(
        line.number,
        "attr-second-line",
        `${name} has an attribute line already. A cell has one attribute line at most, so merge the two blocks into one line.`,
      );
    } else {
      described = true;
      attributes = readAttributes(block, "cell", line.number, 1, error);
    }
  });
  const lines = [cell.first, ...cell.lines.slice(0, last + 1).map((l) => unescapeLine(l.text))];
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const text = lines.join("\n");
  return attributes === undefined ? { text } : { text, attributes };
}

/** The block lines of the key lines and the attribute lines of a valid tbl block. All lines are 1-based block lines, as in `TblError`. */
export interface TblLocation {
  /** The line of each header key line, by key. */
  headerLines: Record<string, number>;
  /** The line of the attribute line of each column that has one, by key. */
  headerAttributeLines: Record<string, number>;
  /**
   * One entry per data record: the line of its `--` (which also holds the block of the row), the line of each key line
   * by the full header key, and the line of the attribute line of each cell that has one, by the full header key.
   */
  rows: { line: number; cells: Record<string, number>; cellAttributeLines: Record<string, number> }[];
}

/**
 * Finds the line of each header key line, of each cell key line, and of each attribute line of a column or a cell of a tbl block.
 * A cell key line can have a prefix key, and `cells` and `cellAttributeLines` map the full header key to its line.
 * It returns null if `parse(text)` has errors.
 */
export function locate(text: string): TblLocation | null {
  const parsed = parse(text);
  if (!parsed.ok) return null;
  const keys = parsed.table.columns.map((c) => c.key);
  const [header, ...data] = splitRecords(text);
  const headerLines: Record<string, number> = {};
  const headerAttributeLines: Record<string, number> = {};
  // In a valid block, an attribute line in the header describes the column of the key line before it,
  // and an attribute line in a record describes the cell of the key line before it.
  let last: string | undefined;
  for (const line of header!.lines) {
    const match = keyLine.exec(line.text);
    if (match) {
      last = match[1]!;
      headerLines[last] = line.number;
    } else if (last !== undefined && blockOf(line) !== undefined) {
      headerAttributeLines[last] = line.number;
    }
  }
  const rows = data.map((record) => {
    const cells: Record<string, number> = {};
    const cellAttributeLines: Record<string, number> = {};
    let current: string | undefined;
    for (const line of record.lines) {
      const match = keyLine.exec(line.text);
      if (match) {
        const resolved = resolve(match[1]!, keys);
        current = "key" in resolved ? resolved.key : undefined;
        if (current !== undefined) cells[current] = line.number;
      } else if (current !== undefined && blockOf(line) !== undefined) {
        cellAttributeLines[current] = line.number;
      }
    }
    return { line: record.separator!, cells, cellAttributeLines };
  });
  return { headerLines, headerAttributeLines, rows };
}
