// The lint of a Markdown text: each GFM table and each error of a tbl block, at its place in the file,
// and a warning for each attribute key that the project does not know (docs/format.md, rule 15).
import { pairOffsets } from "./attributes.ts";
import type { Flavor } from "./flavor.ts";
import { findTables } from "./markdown.ts";
import { locate, parse, type TblErrorCode } from "./parse.ts";
import { attributeLine, separatorLine } from "./syntax.ts";

export type ProblemCode = TblErrorCode | "gfm-table" | "info-text" | "unknown-attribute-key";

/** An error makes a file invalid. A warning does not, but the CLI can fail on it with `--max-warnings`. */
export type Severity = "error" | "warning";

export interface Problem {
  /** 1-based file line. */
  line: number;
  /** 1-based file column. */
  column: number;
  severity: Severity;
  code: ProblemCode;
  message: string;
}

export interface LintOptions {
  /**
   * The attribute keys of the project. A pair with another key gives the warning `unknown-attribute-key`.
   * `align` is always known. With no list, each key other than `align` is unknown.
   */
  attributeKeys?: string[];
  /** The flavor whose markdown-it settings find the tables (docs/format.md, section Flavors). The default is `discourse`. */
  flavor?: Flavor;
}

/** Lists the problems of a Markdown text, sorted by line and then by column. */
export function lint(source: string, options: LintOptions = {}): Problem[] {
  const known = new Set(["align", ...(options.attributeKeys ?? [])]);
  const problems: Problem[] = [];
  for (const found of findTables(source, { flavor: options.flavor })) {
    if (found.kind === "gfm") {
      problems.push({
        line: found.line,
        column: found.column,
        severity: "error",
        code: "gfm-table",
        message: "This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`.",
      });
      continue;
    }
    if (found.meta !== null) {
      problems.push({
        line: found.line,
        column: found.column,
        severity: "error",
        code: "info-text",
        message: `The info string has text after \`tbl\`: "${found.meta}". The info string must be exactly \`tbl\`.`,
      });
    }
    // The block content starts at the column of the fence, also in a list item or a block quote.
    const at = (line: number, column: number) => ({ line: found.contentLine + line - 1, column: found.column + column - 1 });
    const result = parse(found.text);
    if (!result.ok) {
      for (const error of result.errors) {
        problems.push({ ...at(error.line, error.column), severity: "error", code: error.code, message: error.message });
      }
      continue;
    }
    for (const key of attributeKeys(found.text)) {
      if (known.has(key.key)) continue;
      problems.push({
        ...at(key.line, key.column),
        severity: "warning",
        code: "unknown-attribute-key",
        message: `The attribute key "${key.key}" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it.`,
      });
    }
  }
  // Array.prototype.sort is stable, so problems at the same place keep their order.
  return problems.sort((a, b) => a.line - b.line || a.column - b.column);
}

/** The key of each pair of a valid tbl block, with its 1-based block line and column: in the columns, the rows, and the cells. */
function attributeKeys(text: string): { key: string; line: number; column: number }[] {
  const location = locate(text);
  if (location === null) return [];
  const lines = text.split(/\r\n|\r|\n/);
  // Each attribute block has its line and the 1-based column of its `{`.
  const blocks: { block: string; line: number; column: number }[] = [];
  const lineBlock = (line: number) => {
    const block = attributeLine.exec(lines[line - 1]!)?.[1];
    if (block !== undefined) blocks.push({ block, line, column: 1 });
  };
  for (const line of Object.values(location.headerAttributeLines)) lineBlock(line);
  for (const row of location.rows) {
    const separator = separatorLine.exec(lines[row.line - 1]!);
    if (separator?.[2] !== undefined) blocks.push({ block: separator[2], line: row.line, column: 3 + separator[1]!.length });
    for (const line of Object.values(row.cellAttributeLines)) lineBlock(line);
  }
  return blocks.flatMap(({ block, line, column }) =>
    pairOffsets(block).map((pair) => ({ key: pair.key, line, column: column + pair.offset })),
  );
}
