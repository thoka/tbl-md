// The public API of tbl-md.
export { parse } from "./parse.ts";
export type { Column, ParseResult, Row, Table, TblError, TblErrorCode } from "./parse.ts";
export { escapedKeyLine, escapedSeparatorLine, isEscaped, keyLine, separatorLine, unescapeLine } from "./syntax.ts";
