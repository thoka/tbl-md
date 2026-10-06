// The public API of tbl-md.
export { locate, parse } from "./parse.ts";
export type { Column, ParseResult, Row, Table, TblError, TblErrorCode, TblLocation } from "./parse.ts";
export { render, renderBlock, validate } from "./render.ts";
export { parseAttributes, renderAttributes, validateAttributes } from "./attributes.ts";
export type {
  AttributeError,
  AttributeErrorCode,
  AttributePlace,
  Attributes,
  AttributesResult,
  Pair,
} from "./attributes.ts";
export {
  attributeLine,
  escapedAttributeLine,
  escapedKeyLine,
  escapedSeparatorLine,
  escapeLine,
  isEscaped,
  keyLine,
  separatorLine,
  unescapeLine,
} from "./syntax.ts";
export { findTables } from "./markdown.ts";
export type { FindOptions, Found, FoundGfm, FoundTbl, GfmAlign, GfmCell, GfmRow } from "./markdown.ts";
export type { Flavor } from "./flavor.ts";
export { lint } from "./lint.ts";
export type { LintOptions, Problem, ProblemCode, Severity } from "./lint.ts";
export { CONFIG_FILE, findConfig, parseConfig, readConfig } from "./config.ts";
export type { Config, ConfigError, ConfigResult } from "./config.ts";
export { fromGfm, keysFromTitles, toGfm } from "./gfm.ts";
export type { ConvertError, FromGfmResult, GfmError, ToGfmOptions, ToGfmResult } from "./gfm.ts";
export { convert } from "./convert.ts";
export type { ConvertOptions, ConvertResult, FileError } from "./convert.ts";
