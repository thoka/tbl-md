// Finds the tbl blocks and the GFM tables in a Markdown text, with markdown-it and the settings of a flavor
// (docs/format.md, sections Flavors and How markdown-it splits a GFM row).
// markdown-it normalizes the line ends and NUL before it parses, so each offset maps back to the original text
// by its line and its column.
import { engineOf, type FenceMeta, type TableMeta } from "./engine.ts";
import { DEFAULT_FLAVOR, type Flavor } from "./flavor.ts";
import { linkPipes } from "./discourse.ts";
import { escapedSplit } from "./split.ts";

export { escapedSplit };

interface Place {
  /** Source offset of the first character of the block: the fence, or the first character of the header row. */
  start: number;
  /** Source offset after the last character of the last line of the block, before its line end. */
  end: number;
  /** 1-based file line of the start of the block. */
  line: number;
  /** 1-based column of the start of the block. */
  column: number;
}

export interface FoundTbl extends Place {
  kind: "tbl";
  /** 1-based file line of the first line inside the fence (line + 1). */
  contentLine: number;
  /** The text inside the fence, with no container prefix, with LF line ends, and with no final line end. */
  text: string;
  /** The text after `tbl` in the info string, or null if there is none. */
  meta: string | null;
}

/** The alignment of a GFM column, or null for a column with no alignment mark. */
export type GfmAlign = "left" | "center" | "right" | null;

/** One cell of a GFM row in the source, as the table rule of markdown-it splits it. */
export interface GfmCell {
  /** The source text of the cell, with no pipe and no character of the trim at its edges. The escapes stay as they are. */
  text: string;
  /** 1-based file line of the cell. */
  line: number;
  /** 1-based file column of the first character of `text`. For an empty cell, the column after the spaces of the cell. */
  column: number;
}

/** One row of a GFM table: the header row or a body row. */
export interface GfmRow {
  /** 1-based file line of the row. */
  line: number;
  /** Each cell of the source, also each excess cell after the last column of the header. A short row has fewer cells. */
  cells: GfmCell[];
}

export interface FoundGfm extends Place {
  kind: "gfm";
  /** The alignment of each column, from the delimiter row. Its length is the number of columns. */
  align: GfmAlign[];
  /** The header row. It has one cell for each column. */
  header: GfmRow;
  /** The body rows, in order. */
  rows: GfmRow[];
}

export type Found = FoundTbl | FoundGfm;

export interface FindOptions {
  /** The flavor whose markdown-it settings read the text. The default is `discourse`. */
  flavor?: Flavor;
}

/** Lists the tbl blocks and the GFM tables of a Markdown text, in document order. */
export function findTables(source: string, options: FindOptions = {}): Found[] {
  const flavor = options.flavor ?? DEFAULT_FLAVOR;
  const md = engineOf(flavor);
  // The flavor `discourse` keeps the pipes of the link pipe rule (src/discourse.ts).
  const kept = flavor === "discourse" ? (line: string) => linkPipes(md, line) : undefined;
  const tokens = md.parse(source, {});
  const starts = lineStarts(source);
  const at = (line: number, column: number) => starts[line]! + column;
  const found: Found[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.type === "fence") {
      const [lang, meta] = splitInfo(md.utils.unescapeAll(token.info));
      if (lang !== "tbl") continue;
      const [from, to] = token.map!;
      const { column } = token.meta as FenceMeta;
      const content = restoreNul(token.content, source, starts, from + 1);
      found.push({
        kind: "tbl",
        start: at(from, column),
        end: lineEnd(source, starts, to - 1),
        line: from + 1,
        column: column + 1,
        contentLine: from + 2,
        text: content.endsWith("\n") ? content.slice(0, -1) : content,
        meta,
      });
    } else if (token.type === "table_open") {
      const align: GfmAlign[] = [];
      let j = i + 1;
      for (; tokens[j]!.type !== "table_close"; j++) {
        if (tokens[j]!.type === "th_open") align.push(alignOf(String(tokens[j]!.attrGet("style") ?? "")));
      }
      const [from, to] = token.map!;
      const lines = (token.meta as TableMeta).lines;
      const [header, ...rows] = lines.map((rec): GfmRow => {
        const base = at(rec.line, rec.column);
        return {
          line: rec.line + 1,
          cells: splitRow(rec.text, kept).map((cell) => ({
            text: source.slice(base + cell.trimStart, base + cell.trimEnd),
            line: rec.line + 1,
            column: rec.column + cell.trimStart + 1,
          })),
        };
      });
      const column = lines[0]!.column;
      found.push({
        kind: "gfm",
        start: at(from, column),
        end: lineEnd(source, starts, to - 1),
        line: from + 1,
        column: column + 1,
        align,
        header: header!,
        rows,
      });
      i = j;
    }
  }
  return found;
}

/** The language and the meta of an info string, as the fence renderer of markdown-it splits it: the first word, then the rest. */
function splitInfo(info: string): [string, string | null] {
  const trimmed = info.trim();
  const match = /^(\S*)\s*([\s\S]*)$/.exec(trimmed)!;
  return [match[1]!, match[2] === "" ? null : match[2]!];
}

function alignOf(style: string): GfmAlign {
  const value = style.startsWith("text-align:") ? style.slice("text-align:".length) : "";
  return value === "left" || value === "center" || value === "right" ? value : null;
}

/** The offset of the start of each line of a text. A line ends with LF, CRLF, or CR, as in CommonMark. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (const match of text.matchAll(/\r\n|\r|\n/g)) starts.push(match.index + match[0].length);
  return starts;
}

/** The offset of the end of a 0-based line, before its line end. */
function lineEnd(source: string, starts: number[], line: number): number {
  const next = starts[line + 1];
  if (next === undefined) return source.length;
  return source.startsWith("\r\n", next - 2) ? next - 2 : next - 1;
}

/**
 * markdown-it replaces each NUL with U+FFFD before it parses. This puts each NUL of the source back into the text of a
 * fence, so that a conversion keeps it. A line of the content is the end of its source line, after the container
 * prefix and the indent, so the two lines match from their ends.
 */
function restoreNul(content: string, source: string, starts: number[], firstLine: number): string {
  if (!source.includes("\0")) return content;
  return content
    .split("\n")
    .map((text, i) => {
      const line = firstLine + i;
      if (line >= starts.length || !text.includes("�")) return text;
      const original = source.slice(starts[line]!, lineEnd(source, starts, line));
      // U+FFFD and NUL are one UTF-16 code unit each.
      const units = text.split("");
      for (let k = 1; k <= Math.min(units.length, original.length); k++) {
        if (units[units.length - k] === "�" && original[original.length - k] === "\0") units[units.length - k] = "\0";
      }
      return units.join("");
    })
    .join("\n");
}

/** One cell of a row line, as the table rule of markdown-it splits it. */
export interface SplitCell {
  /** Offsets in the line of the text between the two delimiters, with no trim. */
  start: number;
  end: number;
  /** Offsets in the line of the cell text after the trim. */
  trimStart: number;
  trimEnd: number;
  /** The text that markdown-it gives the inline parser: one backslash before each escaped pipe removed, then a trim. */
  content: string;
}

// `\s` matches the characters that String.prototype.trim removes.
const leading = /^\s*/;
const trailing = /\s*$/;

/**
 * Splits one row line as the markdown-it table rule does: a trim of the line (String.prototype.trim, so also
 * Unicode spaces such as U+00A0), the escaped split, and no first part if it is empty and no last part if it is empty.
 * The offsets are offsets in the given line. The result has each cell of the source, also an excess cell.
 * `kept` gives the offsets of the pipes in the trimmed line that are text, for the link pipe rule of `discourse`.
 */
export function splitRow(line: string, kept?: (trimmed: string) => ReadonlySet<number>): SplitCell[] {
  const lead = leading.exec(line)![0].length;
  const trimmed = line.trim();
  const parts = escapedSplit(trimmed, kept?.(trimmed));
  if (parts.length > 0 && parts[0]!.text === "") parts.shift();
  if (parts.length > 0 && parts[parts.length - 1]!.text === "") parts.pop();
  return parts.map((part) => {
    const raw = trimmed.slice(part.start, part.end);
    const a = leading.exec(raw)![0].length;
    const b = raw.length - trailing.exec(raw)![0].length;
    return {
      start: lead + part.start,
      end: lead + part.end,
      // A cell of only spaces has a == raw.length and b == 0. Then the trimmed text is empty.
      trimStart: lead + part.start + a,
      trimEnd: lead + part.start + Math.max(a, b),
      content: part.text.trim(),
    };
  });
}
