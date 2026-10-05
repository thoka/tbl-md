// The lint of a Markdown text: each GFM table and each error of a tbl block, at its place in the file.
import { findTables } from "./markdown.ts";
import { parse, type TblErrorCode } from "./parse.ts";

export type ProblemCode = TblErrorCode | "gfm-table" | "info-text";

export interface Problem {
  /** 1-based file line. */
  line: number;
  /** 1-based file column. */
  column: number;
  code: ProblemCode;
  message: string;
}

/** Lists the problems of a Markdown text, sorted by line and then by column. */
export function lint(source: string): Problem[] {
  const problems: Problem[] = [];
  for (const found of findTables(source)) {
    if (found.kind === "gfm") {
      problems.push({
        line: found.line,
        column: found.column,
        code: "gfm-table",
        message: "This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`.",
      });
      continue;
    }
    if (found.meta !== null) {
      problems.push({
        line: found.line,
        column: found.column,
        code: "info-text",
        message: `The info string has text after \`tbl\`: "${found.meta}". The info string must be exactly \`tbl\`.`,
      });
    }
    const result = parse(found.text);
    if (result.ok) continue;
    // The block content starts at the column of the fence, also in a list item or a block quote.
    for (const error of result.errors) {
      problems.push({
        line: found.contentLine + error.line - 1,
        column: found.column + error.column - 1,
        code: error.code,
        message: error.message,
      });
    }
  }
  // Array.prototype.sort is stable, so problems at the same place keep their order.
  return problems.sort((a, b) => a.line - b.line || a.column - b.column);
}
