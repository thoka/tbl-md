// The parser of a tbl block (docs/format.md, rules 2 to 10 and 12).
// It reads the text inside the fence. The fence and its info string are not part of the text.
import { keyLine, separatorLine, unescapeLine } from "./syntax.ts";

export interface Column {
  key: string;
  title: string;
}

export interface Row {
  id?: string;
  /** Only the cells with text, by the full header key. */
  cells: Record<string, string>;
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
  | "orphan-line";

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
  id?: string;
  lines: Line[];
}

/** Parses the text inside a tbl fence. It collects all errors and does not stop at the first one. */
export function parse(text: string): ParseResult {
  const errors: TblError[] = [];
  const error = (line: number, code: TblErrorCode, message: string) =>
    errors.push({ line, column: 1, code, message });

  const records = splitRecords(text);
  const header = records[0]!;
  const columns = parseHeader(header.lines, error);
  if (columns.length === 0 && header.lines.length === 0) {
    error(1, "no-header", "The block has no header. The first record must map each key to a title, for example `key: Title`.");
  }

  const keys = columns.map((c) => c.key);
  // With no header key, each key of a data record would be an error too, so the parser skips the data records.
  const rows = keys.length === 0 ? [] : records.slice(1).map((record) => parseRecord(record, keys, error));

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, table: { columns, rows } };
}

/** Splits the block at the separator lines, and drops the empty lines at the start and the end of each record (rule 7). */
function splitRecords(text: string): Record_[] {
  const records: Record_[] = [{ lines: [] }];
  text.split(/\r?\n/).forEach((line, i) => {
    const separator = separatorLine.exec(line);
    if (separator) {
      const record: Record_ = { lines: [] };
      if (separator[2] !== undefined) record.id = separator[2];
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

type Report = (line: number, code: TblErrorCode, message: string) => void;

function parseHeader(lines: Line[], error: Report): Column[] {
  const columns: Column[] = [];
  for (const line of lines) {
    const match = keyLine.exec(line.text);
    if (!match) {
      const what = line.text === "" ? "an empty line" : "no key line";
      error(line.number, "header-not-key", `The header has ${what} here. Each header line must have the form \`key: Title\`.`);
      continue;
    }
    const key = match[1]!;
    if (columns.some((c) => c.key === key)) {
      error(line.number, "header-duplicate-key", `The header has the key "${key}" two times.`);
      continue;
    }
    columns.push({ key, title: keyText(line.text, key) });
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

function parseRecord(record: Record_, keys: string[], error: Report): Row {
  const cells: Record<string, string> = {};
  const row: Row = { cells };
  if (record.id !== undefined) row.id = record.id;

  // The lines of the current cell. Null before the first key line, and after a key line with an error.
  let current: Line[] | null = null;
  let currentKey = "";
  let started = false;
  const finish = () => {
    if (current === null) return;
    // A cell drops its trailing empty lines (rule 7), and an empty cell counts as missing (rule 8).
    const text = trimTrailingEmpty(current).map((l) => l.text).join("\n");
    if (text !== "") cells[currentKey] = text;
  };
  const seen = new Set<string>();

  for (const line of record.lines) {
    const match = keyLine.exec(line.text);
    if (match) {
      finish();
      current = null;
      started = true;
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
      currentKey = resolved.key;
      current = [{ text: keyText(line.text, match[1]!), number: line.number }];
      continue;
    }
    if (!started) {
      if (line.text !== "") {
        error(line.number, "orphan-line", "This line comes before the first key of the record, so it belongs to no cell.");
      }
      continue;
    }
    current?.push({ text: unescapeLine(line.text), number: line.number });
  }
  finish();
  return row;
}

function trimTrailingEmpty(lines: Line[]): Line[] {
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.text === "") end--;
  return lines.slice(0, end);
}
