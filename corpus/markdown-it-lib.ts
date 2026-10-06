// The pure parts of the markdown-it measurement (tbl-md step 16, docs/research/markdown-it-reference.md):
// a markdown-it engine with the settings of Discourse, the row split of the markdown-it table rule with source
// positions, and the tables of a document as markdown-it and micromark see them. No part here uses the network.
// The corpus code lives outside src/, so it never ships in the package.
import markdownit, { type MarkdownIt, type StateBlock, type Token } from "markdown-it";
import type { Table as MdastTable, TableCell } from "mdast";
import { findTables, type FoundGfm } from "../src/markdown.ts";

/**
 * The Discourse source that the measurement reproduces. `table.js` is the table feature of Discourse
 * (GPL-2.0-only). The script downloads it into the cache and runs it. It is not part of this repository.
 */
export const DISCOURSE = {
  repo: "discourse/discourse",
  commit: "eb46cffe81257fd48d3e18c35aaba97488fe19b5",
  tablePath: "frontend/discourse-markdown-it/src/features/table.js",
  tableSha256: "52bcfc206ce7f9d9357ff3dedb768e02e7a7eea097e48c15afaaea732192aa48",
  /** The version of markdown-it in pnpm-lock.yaml of that commit. */
  markdownIt: "15.0.1",
  /** The defaults of config/site_settings.yml at that commit. */
  quotes: "“|”|‘|’",
  linkifyTlds: "com|net|org|io|onion|co|tv|ru|cn|us|uk|me|de|fr|fi|gov",
} as const;

/** The helper object that a Discourse markdown feature gets in `setup(helper)`. Only these two methods matter here. */
export interface FeatureHelper {
  registerPlugin(plugin: (md: MarkdownIt) => void): void;
  allowList(info: unknown): void;
}

/** A Discourse markdown feature module, for example `features/table.js`. */
export interface DiscourseFeature {
  setup(helper: FeatureHelper): void;
}

export interface EngineOptions {
  /** The table feature of Discourse. Without it, the engine is plain markdown-it with the options of Discourse. */
  tableFeature?: DiscourseFeature;
  /** Records the source of each table line on the `table_open` token (see recordTableLines). */
  record?: boolean;
}

/**
 * A markdown-it engine as Discourse makes it to cook a post (setup.js #makeEngine and engine.js makeEngine):
 * the preset "default", the options html, breaks, linkify, and typographer with the defaults of the site settings,
 * the quotes and the linkify TLDs of the site settings, fuzzyLink, and the URL decode characters.
 * Of the Discourse features, only the table feature is applied. The other features (emoji, mentions, BBCode, ...)
 * need the Discourse runtime.
 */
export function discourseEngine(options: EngineOptions = {}): MarkdownIt {
  const md = markdownit({ html: true, breaks: true, xhtmlOut: false, linkify: true, typographer: true });
  md.options.quotes = DISCOURSE.quotes.split("|");
  md.linkify.tlds(DISCOURSE.linkifyTlds.split("|"));
  md.linkify.set({ fuzzyLink: true });
  // engine.js setupUrlDecoding. This changes the shared mdurl module, as it does in Discourse.
  md.utils.lib.mdurl.decode.defaultChars = ";/?:@&=+$,# ";
  if (options.tableFeature) {
    const plugins: ((md: MarkdownIt) => void)[] = [];
    options.tableFeature.setup({ registerPlugin: (plugin) => plugins.push(plugin), allowList: () => {} });
    for (const plugin of plugins) md.use(plugin);
  }
  if (options.record) recordTableLines(md);
  return md;
}

/** The source of one line of a table, as the table rule of markdown-it reads it. */
export interface RecordedLine {
  /** The 0-based line in the source. */
  line: number;
  /** The 0-based column of the first character that the table rule reads: after the container markers and the indent. */
  column: number;
  /** The text that the table rule reads, before its trim. A link pipe that Discourse protects is `\0` here. */
  text: string;
}

type RuleBlock = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;

/**
 * Wraps the table rule of markdown-it, so that each `table_open` token gets `meta.lines`: the source of the header line
 * and of each body line (not the delimiter line). The wrapper calls the original rule and changes no token.
 * The source is `state.src` at the time of the block rule, after the normalize rule (CRLF and CR become LF) and after
 * the link pipe protection of Discourse. Thus each column stays the column of the original line.
 */
export function recordTableLines(md: MarkdownIt): void {
  const rules = (md.block.ruler as unknown as { __rules__: { name: string; fn: RuleBlock }[] }).__rules__;
  const original = rules.find((rule) => rule.name === "table")!.fn;
  const wrapped: RuleBlock = (state, startLine, endLine, silent) => {
    const before = state.tokens.length;
    const ok = original(state, startLine, endLine, silent);
    if (ok && !silent) {
      const open = state.tokens[before]!;
      const [from, to] = open.map!;
      const lines: RecordedLine[] = [];
      for (let line = from; line < to; line++) {
        if (line === from + 1) continue;
        const start = state.bMarks[line]! + state.tShift[line]!;
        const lineStart = state.src.lastIndexOf("\n", start - 1) + 1;
        lines.push({ line, column: start - lineStart, text: state.src.slice(start, state.eMarks[line]!) });
      }
      open.meta = { lines };
    }
    return ok;
  };
  // Ruler.at replaces the alt list too, so give the alt list of the table rule again.
  md.block.ruler.at("table", wrapped, { alt: ["paragraph", "reference"] });
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

/**
 * The split function of the markdown-it table rule (`escapedSplit` in rules_block/table, 15.0.1), with the offsets
 * of each part. A pipe is a delimiter unless the character before it is a backslash. Then the part loses that one
 * backslash. Thus a run of any number of backslashes before a pipe escapes it, also an even run.
 */
export function escapedSplit(str: string): { start: number; end: number; text: string }[] {
  const result: { start: number; end: number; text: string }[] = [];
  let isEscaped = false;
  let lastPos = 0;
  let segStart = 0;
  let current = "";
  for (let pos = 0; pos < str.length; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x7c) {
      if (!isEscaped) {
        result.push({ start: segStart, end: pos, text: current + str.substring(lastPos, pos) });
        current = "";
        lastPos = pos + 1;
        segStart = pos + 1;
      } else {
        current += str.substring(lastPos, pos - 1);
        lastPos = pos;
      }
    }
    isEscaped = ch === 0x5c;
  }
  result.push({ start: segStart, end: str.length, text: current + str.substring(lastPos) });
  return result;
}

const leading = /^\s*/;
const trailing = /\s*$/;

/**
 * Splits one row line as the markdown-it table rule does: a trim of the line (String.prototype.trim, so also
 * Unicode spaces such as U+00A0), the escaped split, and no first part if it is empty and no last part if it is empty.
 * The offsets are offsets in the given line. The result has each cell of the source, also an excess cell.
 */
export function splitRow(line: string): SplitCell[] {
  const lead = leading.exec(line)![0].length;
  const trimmed = line.trim();
  const parts = escapedSplit(trimmed);
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

/** A table as one parser sees it, in a form that both parsers share. */
export interface SeenTable {
  /** The 1-based line of the header row. */
  line: number;
  align: string[];
  rows: SeenRow[];
}

export interface SeenRow {
  /** The 1-based line of the row. */
  line: number;
  /** The source text of each cell of the source, with no pipes and no spaces at its edges, also an excess cell. */
  cells: string[];
}

/** The offset of the start of each line of a text. A line ends with LF, CRLF, or CR, as in CommonMark. */
export function lineStarts(text: string): number[] {
  const starts = [0];
  for (const match of text.matchAll(/\r\n|\r|\n/g)) starts.push(match.index + match[0].length);
  return starts;
}

/** A problem of the position check: the cell text at the recorded position is not the content of the token. */
export interface PositionMismatch {
  line: number;
  cell: number;
  fromSource: string;
  fromToken: string;
}

export interface MarkdownItTables {
  tables: SeenTable[];
  /** Each cell where the source text at the position (after the unescape of the pipes) is not the token content. */
  mismatches: PositionMismatch[];
}

/**
 * The tables of a document as markdown-it sees them. The engine must record the table lines (`record: true`).
 * The cell text comes from the original source at the position that splitRow gives for the recorded line.
 * The check compares it with the inline token of markdown-it, for each cell that the token has.
 */
export function markdownItTables(md: MarkdownIt, text: string): MarkdownItTables {
  const tokens = md.parse(text, {});
  const starts = lineStarts(text);
  const tables: SeenTable[] = [];
  const mismatches: PositionMismatch[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i]!;
    if (open.type !== "table_open") continue;
    const recorded = (open.meta as { lines: RecordedLine[] }).lines;
    const align: string[] = [];
    const tokenRows: string[][] = [];
    let j = i + 1;
    for (; tokens[j]!.type !== "table_close"; j++) {
      const t = tokens[j]!;
      if (t.type === "tr_open") tokenRows.push([]);
      if (t.type === "th_open") align.push(styleAlign(t));
      if (t.type === "inline") tokenRows[tokenRows.length - 1]!.push(t.content);
    }
    i = j;
    const rows = recorded.map((rec, r): SeenRow => {
      const base = starts[rec.line]! + rec.column;
      const cells = splitRow(rec.text).map((cell) => text.slice(base + cell.trimStart, base + cell.trimEnd));
      // The check: the cell after our split (pipes unescaped as escapedSplit does, protected link pipes restored)
      // is the content of the inline token of markdown-it.
      const fromSplit = splitRow(rec.text).map((cell) => cell.content.replaceAll("\0", "|"));
      tokenRows[r]!.forEach((content, c) => {
        const own = fromSplit[c] ?? "";
        if (own !== content) mismatches.push({ line: rec.line + 1, cell: c + 1, fromSource: own, fromToken: content });
      });
      return { line: rec.line + 1, cells };
    });
    tables.push({ line: open.map![0] + 1, align, rows });
  }
  return { tables, mismatches };
}

function styleAlign(token: Token): string {
  const style = String(token.attrGet("style") ?? "");
  return style.startsWith("text-align:") ? style.slice("text-align:".length) : "";
}

/** The tables of a document as micromark sees them (the current parser path of tbl-md: findTables). */
export function micromarkTables(text: string): SeenTable[] {
  return findTables(text)
    .filter((f): f is FoundGfm => f.kind === "gfm")
    .map((found) => fromMdast(text, found.node));
}

function fromMdast(text: string, table: MdastTable): SeenTable {
  return {
    line: table.position!.start.line,
    align: (table.align ?? []).map((a) => a ?? ""),
    rows: table.children.map((row) => ({ line: row.position!.start.line, cells: row.children.map((cell) => cellSource(text, cell)) })),
  };
}

/** The text of a cell in the source with no pipe and no space or tab at its edges, as fromGfm of src/gfm.ts reads it. */
function cellSource(source: string, cell: TableCell): string {
  let text = source.slice(cell.position!.start.offset!, cell.position!.end.offset!);
  if (text.startsWith("|")) text = text.slice(1);
  text = text.replace(/[ \t]+$/, "");
  const end = /(\\*)\|$/.exec(text);
  if (end && end[1]!.length % 2 === 0) text = text.slice(0, -1);
  return text.replace(/^[ \t]+|[ \t]+$/g, "");
}

/** The kinds of a difference between two views of one table. */
export const DIFF_KINDS = ["only-micromark", "only-markdown-it", "rows", "columns", "cells", "content", "align"] as const;
export type DiffKind = (typeof DIFF_KINDS)[number];

export interface TableDiff {
  /** The 1-based line of the table in the document. */
  line: number;
  kinds: DiffKind[];
  /** The first row that shows a difference of the kinds "cells" or "content", with both views. */
  example?: { line: number; micromark: string[]; markdownIt: string[] };
}

/**
 * Pairs the tables of the two parsers by the line of their header row, and lists the differences of each table.
 * A table with no difference gets no entry. `cells` means that a row has a different number of source cells.
 * `content` means that a cell in both views has a different source text. `rows` and `columns` compare the number of
 * rows and of header cells.
 */
export function compareTables(micromark: SeenTable[], markdownIt: SeenTable[]): { paired: number; diffs: TableDiff[] } {
  const diffs: TableDiff[] = [];
  const byLine = new Map(markdownIt.map((t) => [t.line, t]));
  const used = new Set<number>();
  let paired = 0;
  for (const a of micromark) {
    const b = byLine.get(a.line);
    if (!b) {
      diffs.push({ line: a.line, kinds: ["only-micromark"] });
      continue;
    }
    used.add(b.line);
    paired++;
    const kinds = new Set<DiffKind>();
    let example: TableDiff["example"];
    if (a.rows.length !== b.rows.length) kinds.add("rows");
    if (a.rows[0]!.cells.length !== b.rows[0]!.cells.length) kinds.add("columns");
    if (a.align.join(",") !== b.align.join(",")) kinds.add("align");
    const rowsB = new Map(b.rows.map((r) => [r.line, r]));
    for (const row of a.rows) {
      const other = rowsB.get(row.line);
      if (!other) continue;
      const cells = row.cells.length !== other.cells.length;
      const content = row.cells.some((cell, c) => c < other.cells.length && cell !== other.cells[c]);
      if (cells) kinds.add("cells");
      if (content) kinds.add("content");
      if ((cells || content) && !example) example = { line: row.line, micromark: row.cells, markdownIt: other.cells };
    }
    if (kinds.size > 0) diffs.push({ line: a.line, kinds: DIFF_KINDS.filter((k) => kinds.has(k)), ...(example ? { example } : {}) });
  }
  for (const b of markdownIt) if (!used.has(b.line)) diffs.push({ line: b.line, kinds: ["only-markdown-it"] });
  diffs.sort((x, y) => x.line - y.line);
  return { paired, diffs };
}
