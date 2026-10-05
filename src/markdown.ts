// Finds the tbl blocks and the GFM tables in a Markdown text.
// It parses CommonMark with only the GFM table extension, and walks the whole mdast tree.
import type { Code, Nodes, Table } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";

interface Place {
  /** Source offset of the first character of the node. */
  start: number;
  /** Source offset after the last character of the node. */
  end: number;
  /** 1-based file line of the start of the node. */
  line: number;
  /** 1-based column of the start of the node. */
  column: number;
}

export interface FoundTbl extends Place {
  kind: "tbl";
  node: Code;
  /** 1-based file line of the first line inside the fence (line + 1). */
  contentLine: number;
  /** The text inside the fence, as the node value has it. */
  text: string;
  /** The text after `tbl` in the info string, or null if there is none. */
  meta: string | null;
}

export interface FoundGfm extends Place {
  kind: "gfm";
  node: Table;
}

export type Found = FoundTbl | FoundGfm;

/** Lists the tbl blocks and the GFM tables of a Markdown text, in document order. */
export function findTables(source: string): Found[] {
  const tree = fromMarkdown(source, {
    extensions: [gfmTable()],
    mdastExtensions: [gfmTableFromMarkdown()],
  });
  const found: Found[] = [];
  const walk = (node: Nodes) => {
    if (isTblBlock(node, source)) {
      const place = placeOf(node);
      found.push({ kind: "tbl", node, ...place, contentLine: place.line + 1, text: node.value, meta: node.meta ?? null });
      return;
    }
    if (node.type === "table") {
      found.push({ kind: "gfm", node, ...placeOf(node) });
      return;
    }
    if ("children" in node) for (const child of node.children) walk(child);
  };
  walk(tree);
  return found;
}

/** A tbl block is a fenced code node with the language `tbl`. An indented code node has no fence. */
function isTblBlock(node: Nodes, source: string): node is Code {
  if (node.type !== "code" || node.lang !== "tbl") return false;
  // An indented code node has no lang, but check the fence anyway, so that the rule stays explicit.
  const start = node.position?.start.offset;
  if (start === undefined) return false;
  const first = source[start];
  return first === "`" || first === "~";
}

function placeOf(node: Code | Table): Place {
  const position = node.position;
  if (position?.start.offset === undefined || position.end.offset === undefined) {
    throw new Error(`The ${node.type} node has no position.`);
  }
  return {
    start: position.start.offset,
    end: position.end.offset,
    line: position.start.line,
    column: position.start.column,
  };
}
