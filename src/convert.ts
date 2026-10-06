// The conversion of all tables in one Markdown text, in memory (docs/format.md, section "Conversion of a file").
// It replaces only the source range of each converted table. Each other byte stays the same.
import { findTables, type Found, type FoundTbl } from "./markdown.ts";
import { fromGfm, gfmView, keysFromTitles, toGfm, type ConvertError } from "./gfm.ts";
import type { Attributes } from "./attributes.ts";
import { locate, parse, type Row, type Table, type TblLocation } from "./parse.ts";
import { renderBlock } from "./render.ts";

/** A problem of a conversion, at a 1-based line and column of the file. */
export interface FileError {
  line: number;
  column: number;
  message: string;
}

export type ConvertResult = { ok: true; output: string; count: number } | { ok: false; errors: FileError[] };

export interface ConvertOptions {
  /** `"tbl"` converts each GFM table to a tbl block. `"gfm"` converts each tbl block to a GFM table. */
  to: "tbl" | "gfm";
  /**
   * Only for `to: "gfm"`. Drops each attribute with no GFM form, with no error: the conversion keeps the `align`
   * of the columns and the ID of the rows, and drops the rest. Without it, each such attribute is an error at its line.
   */
  dropAttributes?: boolean;
}

/** A converted table: its place in the source, and the text that replaces it (lines joined with "\n", no prefix). */
interface Replacement {
  found: Found;
  /** The index of the table in the list of findTables. */
  index: number;
  text: string;
  /** The table that the new text must read back as. */
  table: Table;
}

/**
 * Converts each table of the other kind in a Markdown text. The result has the new text and the number of converted tables,
 * or all errors, sorted by line and then by column. With an error, the caller must write nothing.
 */
export function convert(source: string, options: ConvertOptions): ConvertResult {
  const errors: FileError[] = [];
  const replacements: Replacement[] = [];
  findTables(source).forEach((found, index) => {
    if (found.kind === "gfm" && options.to === "tbl") {
      const result = fromGfm(source, found);
      if (!result.ok) errors.push(...result.errors);
      else replacements.push({ found, index, text: renderBlock(result.table), table: result.table });
    } else if (found.kind === "tbl" && options.to === "gfm") {
      const replacement = tblToGfm(found, index, options.dropAttributes === true, errors);
      if (replacement) replacements.push(replacement);
    }
  });
  if (errors.length > 0) return { ok: false, errors: sorted(errors) };

  const eol = /\r\n|\r|\n/.exec(source)?.[0] ?? "\n";
  let output = "";
  let last = 0;
  const ranges: [number, number][] = [];
  for (const r of replacements) {
    output += source.slice(last, r.found.start);
    const start = output.length;
    output += withPrefix(r.text, prefixOf(source, r.found.start), eol);
    ranges.push([start, output.length]);
    last = r.found.end;
  }
  output += source.slice(last);

  selfCheck(source, output, replacements, ranges, options.to, errors);
  if (errors.length > 0) return { ok: false, errors: sorted(errors) };
  return { ok: true, output, count: replacements.length };
}

/** Parses a tbl block and writes it as GFM. It maps each error to its file line. */
function tblToGfm(found: FoundTbl, index: number, dropAttributes: boolean, errors: FileError[]): Replacement | null {
  const at = (blockLine: number, blockColumn = 1) => ({
    line: found.contentLine + blockLine - 1,
    column: found.column + blockColumn - 1,
  });
  const before = errors.length;
  if (found.meta !== null) {
    errors.push({
      line: found.line,
      column: found.column,
      message: `The info string has text after \`tbl\`: "${found.meta}". The info string must be exactly \`tbl\`.`,
    });
  }
  const parsed = parse(found.text);
  if (!parsed.ok) {
    for (const e of parsed.errors) errors.push({ ...at(e.line, e.column), message: e.message });
    return null;
  }
  if (errors.length > before) return null;

  const result = toGfm(parsed.table, { dropAttributes });
  if (!result.ok) {
    const places = locate(found.text)!;
    for (const e of result.errors) {
      const line = lineOf(e, places);
      errors.push(line === undefined ? { line: found.line, column: found.column, message: e.message } : { ...at(line), message: e.message });
    }
    return null;
  }
  // The new GFM table must read back as the table that GFM can hold.
  return { found, index, text: result.text, table: withTitleKeys(gfmView(parsed.table)) };
}

/**
 * The block line of an error of toGfm: the attribute line of a column or a cell, the `--` line of a row,
 * the header key line of a title, or the key line of a cell. It gives undefined for an error with no place.
 */
function lineOf(e: ConvertError, places: TblLocation): number | undefined {
  const row = e.row === undefined ? undefined : places.rows[e.row - 1];
  switch (e.attribute) {
    case "column":
      return places.headerAttributeLines[e.key!];
    case "row":
      return row?.line;
    case "cell":
      return row?.cellAttributeLines[e.key!];
  }
  if (e.key === undefined) return undefined;
  return row === undefined ? places.headerLines[e.key] : row.cells[e.key];
}

/** The same table with the keys of keysFromTitles, as fromGfm reads it back. */
function withTitleKeys(table: Table): Table {
  const keys = keysFromTitles(table.columns.map((c) => c.title));
  const byOld = new Map(table.columns.map((c, i) => [c.key, keys[i]!]));
  const rekey = <T>(record: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).map(([key, value]) => [byOld.get(key)!, value]));
  return {
    columns: table.columns.map((c, i) => ({ ...c, key: keys[i]! })),
    rows: table.rows.map((row) => {
      const r: Row = { ...row, cells: rekey(row.cells) };
      if (row.cellAttributes !== undefined) r.cellAttributes = rekey(row.cellAttributes);
      return r;
    }),
  };
}

/** The text from the start of the line to the offset: the container markers and the indent of the first line. */
function prefixOf(source: string, offset: number): string {
  let start = offset;
  while (start > 0 && source[start - 1] !== "\n" && source[start - 1] !== "\r") start--;
  return source.slice(start, offset);
}

/**
 * Writes the lines of the text with the line end of the file. The first line keeps its place after the first-line prefix.
 * Each other line gets the continuation prefix: the first-line prefix with each character other than `>`, a space, or a tab
 * replaced by a space. An empty line gets the prefix with no trailing spaces or tabs.
 */
function withPrefix(text: string, first: string, eol: string): string {
  const prefix = first.replace(/[^> \t]/g, " ");
  const bare = prefix.replace(/[ \t]+$/, "");
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? line : line === "" ? bare : prefix + line))
    .join(eol);
}

/**
 * Reads the output again. Each converted table must have the same place in the list of tables, the target kind,
 * and the same content. Each other table must keep its kind and its text.
 */
function selfCheck(source: string, output: string, replacements: Replacement[], ranges: [number, number][], to: "tbl" | "gfm", errors: FileError[]): void {
  const before = findTables(source);
  const after = findTables(output);
  replacements.forEach((r, i) => {
    const error = (message: string) => errors.push({ line: r.found.line, column: r.found.column, message });
    const [start, end] = ranges[i]!;
    const index = after.findIndex((f) => f.start === start);
    const found = after[index];
    if (found === undefined && after.some((f) => f.start < start && f.end > start)) {
      // An earlier new table takes this one as rows. The error of the earlier table names the cause.
      return;
    }
    if (found === undefined || found.kind !== to) {
      error(`The new ${to === "gfm" ? "GFM table" : "tbl block"} does not read as one at this place. Add an empty line before and after this table.`);
    } else if (found.end > end) {
      error(
        "GFM would read the line after the new table as a row of it. A GFM table needs an empty line or another block directly after it. Add an empty line after the tbl block.",
      );
    } else if (index !== r.index) {
      error("The conversion changes the order of the tables in the file. Add an empty line before and after this table.");
    } else {
      const back = found.kind === "gfm" ? fromGfm(output, found) : parse(found.text);
      const same = back.ok && sameTable(back.table, r.table) && (found.kind === "gfm" || found.meta === null);
      if (!same) error("The new table does not read back as the same table. Add an empty line before and after this table.");
    }
  });
  if (errors.length > 0) return;
  // The tables that stay must keep their kind and their text.
  const changed = before.findIndex((f, i) => {
    const g = after[i];
    if (g === undefined) return true;
    if (replacements.some((r) => r.index === i)) return false;
    return g.kind !== f.kind || output.slice(g.start, g.end) !== source.slice(f.start, f.end);
  });
  if (changed >= 0 || after.length !== before.length) {
    const at = before[changed >= 0 ? changed : before.length - 1];
    errors.push({
      line: at?.line ?? 1,
      column: at?.column ?? 1,
      message: "The conversion changes how Markdown reads the tables near this place. Add an empty line between the tables.",
    });
  }
}

/**
 * True if two tables have the same columns, the same cells, and the same attributes of the columns, the rows, and the cells.
 * The order of the cell keys does not count.
 */
function sameTable(a: Table, b: Table): boolean {
  if (a.columns.length !== b.columns.length || a.rows.length !== b.rows.length) return false;
  const columnsSame = a.columns.every((c, i) => {
    const other = b.columns[i]!;
    return c.key === other.key && c.title === other.title && sameAttributes(c.attributes, other.attributes);
  });
  if (!columnsSame) return false;
  return a.rows.every((row, i) => {
    const other = b.rows[i]!;
    return (
      sameAttributes(row.attributes, other.attributes) &&
      sameRecord(row.cells, other.cells, (x, y) => x === y) &&
      sameRecord(row.cellAttributes ?? {}, other.cellAttributes ?? {}, sameAttributes)
    );
  });
}

function sameRecord<T>(a: Record<string, T>, b: Record<string, T>, same: (x: T, y: T) => boolean): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && same(a[k]!, b[k]!));
}

/** True if both are missing, or both have the same ID, the same classes, and the same pairs, in the same order. */
function sameAttributes(a: Attributes | undefined, b: Attributes | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.id === b.id &&
    a.classes.length === b.classes.length &&
    a.classes.every((c, i) => c === b.classes[i]) &&
    a.pairs.length === b.pairs.length &&
    a.pairs.every((p, i) => p.key === b.pairs[i]!.key && p.value === b.pairs[i]!.value)
  );
}

function sorted(errors: FileError[]): FileError[] {
  return errors.sort((a, b) => a.line - b.line || a.column - b.column);
}
