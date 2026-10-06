// The markdown-it engine of each flavor (docs/format.md, section Flavors), and the position recorders of findTables.
// The type declarations of the public API never name this module, so that they do not need markdown-it types.
import markdownit, { type MarkdownIt, type StateBlock } from "markdown-it";
import { DISCOURSE, type Flavor } from "./flavor.ts";
import { discourseTable } from "./discourse.ts";

/**
 * A new markdown-it engine with the settings of a flavor, with no recorder.
 * `discourse`: the preset "default" with the options of Discourse (html, breaks, linkify, typographer), the quotes and
 * the linkify TLDs of its site settings, fuzzyLink, the URL decode characters of Discourse, and the table rule with the
 * link pipe rule (src/discourse.ts). `markdown-it`: `markdownit()`.
 */
export function createEngine(flavor: Flavor): MarkdownIt {
  if (flavor === "markdown-it") return markdownit();
  const md = markdownit({ html: true, xhtmlOut: false, breaks: true, linkify: true, typographer: true });
  md.options.quotes = [...DISCOURSE.quotes];
  md.linkify.tlds([...DISCOURSE.linkifyTlds]);
  md.linkify.set({ fuzzyLink: true });
  const table = (md.block.ruler as unknown as { __rules__: RuleEntry[] }).__rules__.find((r) => r.name === "table")!;
  md.block.ruler.at("table", discourseTable, { alt: [...table.alt] });
  keepUrlDecodeChars(md, DISCOURSE.urlDecodeKeep);
  return md;
}

/**
 * Makes the URL decode of a link text keep these characters. markdown-it reads them from the shared mdurl module
 * (`mdurl.decode.defaultChars`), so the wrapper sets them only for the time of its own call and then restores them.
 * Thus the other engines and the other users of mdurl see no change.
 */
function keepUrlDecodeChars(md: MarkdownIt, chars: string): void {
  const decode = md.utils.lib.mdurl.decode as { defaultChars: string };
  const original = md.normalizeLinkText.bind(md);
  md.normalizeLinkText = (url: string) => {
    const saved = decode.defaultChars;
    decode.defaultChars = chars;
    try {
      return original(url);
    } finally {
      decode.defaultChars = saved;
    }
  };
}

const engines = new Map<Flavor, MarkdownIt>();

/**
 * The cached engine of a flavor, with the recorders of findTables. The recorders add `meta` to the `fence` and the
 * `table_open` tokens, and change no output. A caller must not change the engine.
 */
export function engineOf(flavor: Flavor): MarkdownIt {
  let md = engines.get(flavor);
  if (md === undefined) {
    md = createEngine(flavor);
    recordPositions(md);
    engines.set(flavor, md);
  }
  return md;
}

/** One line of a table, as the table rule of markdown-it reads it. */
export type RecordedLine = {
  /** The 0-based line in the source. */
  line: number;
  /** The 0-based column of the first character that the table rule reads: after the container markers and the indent. */
  column: number;
  /** The text that the table rule reads, before its trim. */
  text: string;
};

/** The `meta` of a `table_open` token: the header line and each body line, not the delimiter line. */
export type TableMeta = {
  lines: RecordedLine[];
};

/** The `meta` of a `fence` token: the 0-based column of the fence in its line. */
export type FenceMeta = {
  column: number;
};

type RuleBlock = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;
interface RuleEntry {
  name: string;
  fn: RuleBlock;
  alt: string[];
}

/**
 * Wraps the block rules `table` and `fence`, so that their first token gets `meta` with the columns that markdown-it
 * does not keep. Each wrapper calls the original rule and changes no token other than its `meta`. The text and the
 * columns come from `state.src`, after the normalize rule: CRLF and CR become LF, and NUL becomes U+FFFD.
 * Thus a column of a line stays the column of the original line.
 */
export function recordPositions(md: MarkdownIt): void {
  wrap(md, "table", (state, first) => {
    const open = state.tokens[first]!;
    const [from, to] = open.map!;
    const lines: RecordedLine[] = [];
    for (let line = from; line < to; line++) {
      if (line === from + 1) continue;
      const start = state.bMarks[line]! + state.tShift[line]!;
      lines.push({ line, column: columnOf(state.src, start), text: state.src.slice(start, state.eMarks[line]!) });
    }
    const meta: TableMeta = { lines };
    open.meta = meta;
  });
  wrap(md, "fence", (state, first) => {
    const token = state.tokens[first]!;
    const startLine = token.map![0];
    const meta: FenceMeta = { column: columnOf(state.src, state.bMarks[startLine]! + state.tShift[startLine]!) };
    token.meta = meta;
  });
}

/** Replaces a block rule by a wrapper that calls `after` with the index of the first new token when the rule made tokens. It keeps the alt list of the rule. */
function wrap(md: MarkdownIt, name: string, after: (state: StateBlock, firstToken: number) => void): void {
  const rules = (md.block.ruler as unknown as { __rules__: RuleEntry[] }).__rules__;
  const rule = rules.find((r) => r.name === name)!;
  const original = rule.fn;
  const wrapped: RuleBlock = (state, startLine, endLine, silent) => {
    const before = state.tokens.length;
    const ok = original(state, startLine, endLine, silent);
    if (ok && !silent) after(state, before);
    return ok;
  };
  md.block.ruler.at(name, wrapped, { alt: [...rule.alt] });
}

/** The 0-based column of an offset in its line. */
function columnOf(src: string, offset: number): number {
  return offset === 0 ? 0 : offset - (src.lastIndexOf("\n", offset - 1) + 1);
}
