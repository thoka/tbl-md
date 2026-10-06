// The pure parts of the corpus test: the configuration, the cache place, the hash and size checks, the split of
// fixture files into documents, and the comparison of two mdast trees. No part here uses the network.
// The corpus code lives outside src/, so it never ships in the package.
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Nodes, Root, Table, TableRow } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmTableFromMarkdown } from "mdast-util-gfm-table";
import { gfmTable } from "micromark-extension-gfm-table";
import { convert, type FileError } from "../src/convert.ts";
import { findTables, type FoundGfm } from "../src/markdown.ts";

/** The cap for one file: 512 KiB. */
export const FILE_CAP = 512 * 1024;
/** The cap for all files of one run together: 4 MiB. */
export const TOTAL_CAP = 4 * 1024 * 1024;

/**
 * The kind of a file. `markdown` is one document. `spec` has examples between lines of 32 backticks (cmark-gfm,
 * pulldown-cmark). `markdown-it` has the input between two lines `.`. `goldmark` has the input between two lines
 * `//- - - - - - - - -//`.
 */
export const KINDS = ["markdown", "spec", "markdown-it", "goldmark"] as const;
export type Kind = (typeof KINDS)[number];

export interface SourceFile {
  path: string;
  kind: Kind;
  size: number;
  sha256: string;
  /** The license of this file, if it differs from the license of the source. */
  license?: string;
}

export interface Source {
  repo: string;
  commit: string;
  license: string;
  files: SourceFile[];
}

export interface Config {
  sources: Source[];
}

/** Checks the configuration and returns the problems, each with the source and the file. */
export function checkConfig(config: Config): string[] {
  const problems: string[] = [];
  let total = 0;
  for (const source of config.sources) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repo)) problems.push(`${source.repo}: the repo must be "<owner>/<name>".`);
    if (!/^[0-9a-f]{40}$/.test(source.commit)) problems.push(`${source.repo}: the commit must be a full SHA-1 of 40 hex digits.`);
    if (!source.license) problems.push(`${source.repo}: the source has no license.`);
    for (const file of source.files) {
      const name = `${source.repo}/${file.path}`;
      if (!safePath(file.path)) problems.push(`${name}: the path must be relative, with no "." or ".." part.`);
      if (!KINDS.includes(file.kind)) problems.push(`${name}: the kind "${file.kind}" is unknown. Use one of ${KINDS.join(", ")}.`);
      if (!/^[0-9a-f]{64}$/.test(file.sha256)) problems.push(`${name}: the sha256 must have 64 hex digits. Run mise run corpus-pin.`);
      if (!(file.size > 0 && file.size <= FILE_CAP)) problems.push(`${name}: the size must be above 0 and at most ${FILE_CAP} bytes.`);
      total += file.size;
    }
  }
  if (total > TOTAL_CAP) problems.push(`The files have ${total} bytes together, more than the cap of ${TOTAL_CAP} bytes.`);
  return problems;
}

function safePath(path: string): boolean {
  return path !== "" && !path.startsWith("/") && !path.includes("\\") && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

/** The cache folder: `$XDG_CACHE_HOME/tbl-md/corpus`, or `~/.cache/tbl-md/corpus`. */
export function cacheRoot(env: Record<string, string | undefined> = process.env, home = homedir()): string {
  const base = env.XDG_CACHE_HOME && env.XDG_CACHE_HOME.startsWith("/") ? env.XDG_CACHE_HOME : join(home, ".cache");
  return join(base, "tbl-md", "corpus");
}

/** The place of one file in the cache: `<root>/<owner>/<repo>/<commit>/<path>`. */
export function cachePath(root: string, repo: string, commit: string, path: string): string {
  if (!safePath(path)) throw new Error(`${repo}/${path}: the path must be relative, with no "." or ".." part.`);
  return join(root, ...repo.split("/"), commit, ...path.split("/"));
}

/** The URL of one file at a commit on raw.githubusercontent.com. The fallback host is jsDelivr (README.md). */
export function rawUrl(repo: string, commit: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${commit}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Throws an error that names the file if the bytes do not have the expected SHA-256. */
export function verify(name: string, bytes: Uint8Array, expected: string): void {
  const actual = sha256(bytes);
  if (actual !== expected) {
    throw new Error(
      `${name}: the SHA-256 is ${actual}, but sources.json has ${expected}. The file changed or the download is broken. If the change is correct, run mise run corpus-pin for this file.`,
    );
  }
}

/** Counts the bytes of a run, so that all downloads together stay under the total cap. */
export class Budget {
  used = 0;
  constructor(readonly cap: number = TOTAL_CAP) {}
  take(name: string, bytes: number): void {
    this.used += bytes;
    if (this.used > this.cap) throw new Error(`${name}: the downloads of this run pass the total cap of ${this.cap} bytes.`);
  }
}

/**
 * Reads a stream to its end. It stops with an error that names the file as soon as the file passes the cap
 * or the run passes the budget, so that a file that is too large does not download in full.
 */
export async function readCapped(name: string, body: ReadableStream<Uint8Array>, cap: number, budget: Budget): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > cap) throw new Error(`${name}: the file is larger than the cap of ${cap} bytes.`);
      budget.take(name, value.byteLength);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** One Markdown document of a file, and the 1-based file line of its first line. */
export interface Document {
  line: number;
  text: string;
}

/** Splits a file into Markdown documents by its kind. */
export function splitDocuments(kind: Kind, text: string): Document[] {
  switch (kind) {
    case "markdown":
      return [{ line: 1, text }];
    case "spec":
      return splitSpec(text);
    case "markdown-it":
      return splitBetween(text, (line) => line === ".", (line) => line === ".");
    case "goldmark":
      return splitBetween(text, (line) => line === "//- - - - - - - - -//", (line) => line.startsWith("//= = ="));
  }
}

const FENCE = "`".repeat(32);

/**
 * The spec format of cmark-gfm and pulldown-cmark: an example starts with a line of 32 backticks and the word
 * `example`, the Markdown ends at a line `.`, and the HTML ends at a line of 32 backticks. `→` stands for a tab.
 */
function splitSpec(text: string): Document[] {
  const lines = text.split(/\r?\n/);
  const docs: Document[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i]!;
    if (!(open.startsWith(FENCE + " ") && /\bexample\b/.test(open))) continue;
    const start = i + 1;
    let end = start;
    while (end < lines.length && lines[end] !== "." && lines[end] !== FENCE) end++;
    docs.push({ line: start + 1, text: lines.slice(start, end).map((l) => l.replaceAll("→", "\t")).join("\n") + "\n" });
    while (end < lines.length && lines[end] !== FENCE) end++;
    i = end;
  }
  return docs;
}

/**
 * The fixture formats of markdown-it and goldmark. The input sits between two separator lines. The expected output
 * follows and ends at its end line: `.` for markdown-it, `//= = = ... =//` for goldmark. The text between cases is a
 * title or options.
 */
function splitBetween(text: string, isSeparator: (line: string) => boolean, isOutputEnd: (line: string) => boolean): Document[] {
  const lines = text.split(/\r?\n/);
  const docs: Document[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!isSeparator(lines[i]!)) {
      i++;
      continue;
    }
    const start = i + 1;
    let end = start;
    while (end < lines.length && !isSeparator(lines[end]!)) end++;
    docs.push({ line: start + 1, text: lines.slice(start, end).join("\n") + "\n" });
    // Skip the expected output up to its end line.
    i = end + 1;
    while (i < lines.length && !isOutputEnd(lines[i]!)) i++;
    i++;
  }
  return docs;
}

/** Parses Markdown as tbl-md does: CommonMark with the GFM table extension. */
export function parseTree(text: string): Root {
  return fromMarkdown(text, { extensions: [gfmTable()], mdastExtensions: [gfmTableFromMarkdown()] });
}

export interface NormalizeOptions {
  /** Puts an empty table node in place of each table, to find the differences outside the tables. */
  skipTables?: boolean;
}

/**
 * A copy of a node with no positions and no data, as GFM shows it: each table row has the width of the header,
 * so a short row gets empty cells, and the excess cells go away.
 */
export function normalize(node: Nodes, options: NormalizeOptions = {}): unknown {
  if (node.type === "table") return options.skipTables ? { type: "table" } : normalizeTable(node, options);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "position" || key === "data") continue;
    copy[key] = key === "children" ? (value as Nodes[]).map((child) => normalize(child, options)) : value;
  }
  return copy;
}

function normalizeTable(table: Table, options: NormalizeOptions): unknown {
  const width = table.children[0]?.children.length ?? 0;
  return { type: "table", align: table.align ?? [], children: table.children.map((row) => normalizeRow(row, width, options)) };
}

function normalizeRow(row: TableRow, width: number, options: NormalizeOptions): unknown {
  const cells = row.children.slice(0, width).map((cell) => normalize(cell, options));
  while (cells.length < width) cells.push({ type: "tableCell", children: [] });
  return { type: "tableRow", children: cells };
}

/**
 * The first node of `a` that differs from `b`. It descends into nodes with the same type and the same number of
 * children. It stops at a table row, or at a table whose alignment or row count differs. With `skipTables`, two
 * tables never differ.
 */
export function firstDifference(a: Nodes, b: Nodes, options: NormalizeOptions = {}): Nodes {
  if (a.type !== b.type || !("children" in a) || !("children" in b) || a.children.length !== b.children.length) return a;
  if (a.type === "table") {
    const t = b as Table;
    if (!isDeepStrictEqual(a.align ?? [], t.align ?? [])) return a;
    const width = a.children[0]?.children.length ?? 0;
    const otherWidth = t.children[0]?.children.length ?? 0;
    for (let i = 0; i < a.children.length; i++) {
      if (!isDeepStrictEqual(normalizeRow(a.children[i]!, width, options), normalizeRow(t.children[i]!, otherWidth, options))) return a.children[i]!;
    }
    return a;
  }
  const children = b.children as Nodes[];
  for (let i = 0; i < a.children.length; i++) {
    const x = a.children[i] as Nodes;
    const y = children[i]!;
    if (!isDeepStrictEqual(normalize(x, options), normalize(y, options))) return firstDifference(x, y, options);
  }
  return a;
}

/**
 * The result of one table, or of the text outside the tables. `line` is the 1-based line in the document.
 * Each table of a document gets one outcome. A difference outside the tables gets one more outcome "different".
 */
export type Outcome =
  | { kind: "same"; line: number }
  | { kind: "error"; line: number; message: string }
  | { kind: "different"; line: number; message: string };

/** The GFM tables of a tree, in document order. */
function tablesOf(node: Nodes): Table[] {
  if (node.type === "table") return [node];
  return "children" in node ? (node.children as Nodes[]).flatMap(tablesOf) : [];
}

const lineOf = (node: Nodes) => node.position?.start.line ?? 1;

/**
 * Compares the mdast of the original text with the mdast of the text after the round trip, table by table.
 * Each difference of a table is "different", also a difference in the column alignment alone.
 * A difference outside the tables adds one outcome "different". If the number of tables differs, the tables
 * cannot pair, so the result is one outcome "different" for each table of the original.
 */
export function compareTexts(original: string, back: string): Outcome[] {
  const a = parseTree(original);
  const b = parseTree(back);
  const before = tablesOf(a);
  const after = tablesOf(b);
  if (before.length !== after.length) {
    const message = `the document has ${after.length} tables after the round trip, not ${before.length}`;
    return before.map((t) => ({ kind: "different", line: lineOf(t), message }));
  }
  const outcomes: Outcome[] = before.map((t, i) => compareTables(t, after[i]!));
  if (!isDeepStrictEqual(normalize(a, { skipTables: true }), normalize(b, { skipTables: true }))) {
    const node = firstDifference(a, b, { skipTables: true });
    outcomes.push({ kind: "different", line: lineOf(node), message: `the text outside the tables differs after the round trip (first at a ${node.type})` });
  }
  return outcomes;
}

function compareTables(a: Table, b: Table): Outcome {
  if (isDeepStrictEqual(normalize(a), normalize(b))) return { kind: "same", line: lineOf(a) };
  const node = firstDifference(a, b);
  return { kind: "different", line: lineOf(node), message: `the ${node.type} differs after the round trip` };
}

/** The number of GFM tables in a text. */
export function countTables(text: string): number {
  return tablesOf(parseTree(text)).length;
}

/**
 * Removes one table from the text and keeps the line count and the containers. On each line of the table, it keeps
 * the characters before the column of the table (the markers of a block quote or the indent of a list item) and
 * removes the rest. So each other table keeps its line and its container.
 */
export function blankTable(text: string, found: FoundGfm): string {
  const lineStart = text.lastIndexOf("\n", found.start - 1) + 1;
  const lines = text.slice(lineStart, found.end).split("\n");
  const keep = found.column - 1;
  const blanked = lines.map((line) => line.slice(0, keep).replace(/[ \t]+$/, "") + (line.endsWith("\r") ? "\r" : "")).join("\n");
  return text.slice(0, lineStart) + blanked + text.slice(found.end);
}

/** The 1-based line of the last character of a table. */
function endLine(text: string, found: FoundGfm): number {
  return found.line + (text.slice(found.start, found.end).match(/\n/g)?.length ?? 0);
}

/**
 * Converts a document to tbl and back to GFM, and compares the mdast before and after, table by table.
 * It returns one outcome for each GFM table, and none for a document with no table.
 * If a table fails the conversion, it counts as "error". The check removes that table from the text (blankTable)
 * and converts again, so that one error does not hide the other tables of the document.
 */
export function roundTrip(text: string): Outcome[] {
  const errors: Outcome[] = [];
  let work = text;
  let tbl: string;
  for (;;) {
    const tables = findTables(work).filter((f): f is FoundGfm => f.kind === "gfm");
    if (tables.length === 0) return errors;
    const toTbl = convert(work, { to: "tbl" });
    if (toTbl.ok) {
      tbl = toTbl.output;
      break;
    }
    // Each error belongs to the table that holds its line, else to the table before it, else to the first table.
    const failing = new Map<FoundGfm, FileError>();
    for (const e of toTbl.errors) {
      const table =
        tables.find((t) => t.line <= e.line && e.line <= endLine(work, t)) ?? tables.findLast((t) => t.line <= e.line) ?? tables[0]!;
      if (!failing.has(table)) failing.set(table, e);
    }
    for (const [table, e] of failing) errors.push({ kind: "error", line: e.line, message: e.message });
    // Remove the tables from the end, so that the offsets of the earlier tables stay correct.
    for (const table of [...failing.keys()].sort((x, y) => y.start - x.start)) work = blankTable(work, table);
  }
  const toGfm = convert(tbl, { to: "gfm" });
  if (!toGfm.ok) {
    // The tbl text of a successful conversion must convert back. If not, the switch is not reversible.
    const e = toGfm.errors[0]!;
    const message = `the conversion back to GFM fails at line ${e.line} of the tbl text: ${e.message}`;
    return [...errors, ...tablesOf(parseTree(work)).map((t): Outcome => ({ kind: "different", line: lineOf(t), message }))];
  }
  return [...errors, ...compareTexts(work, toGfm.output)].sort((x, y) => x.line - y.line);
}
