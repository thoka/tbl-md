// The public API of tbl-md.
export { parse } from "./parse.ts";
export type { Column, ParseResult, Row, Table, TblError, TblErrorCode } from "./parse.ts";
export { render, renderBlock, validate } from "./render.ts";
export {
  escapedKeyLine,
  escapedSeparatorLine,
  escapeLine,
  isEscaped,
  keyLine,
  separatorLine,
  unescapeLine,
} from "./syntax.ts";
export { findTables } from "./markdown.ts";
export type { Found, FoundGfm, FoundTbl } from "./markdown.ts";
export { lint } from "./lint.ts";
export type { Problem, ProblemCode } from "./lint.ts";
