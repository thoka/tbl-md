// The table rule of the flavor `discourse` with the link pipe rule (docs/format.md, sections "The link pipe rule of
// `discourse`" and "How markdown-it splits a GFM row").
// The table rule is the rule `table` of markdown-it 15.0.1 (rules_block/table), with one change: its split keeps each
// pipe of a complete link or image. tbl-md does not use the code of Discourse for this, because it has the license
// GPL-2.0-only. The rule of markdown-it has this license:
//
//   Copyright (c) 2014 Vitaly Puzrin, Alex Kocharin.
//
//   Permission is hereby granted, free of charge, to any person
//   obtaining a copy of this software and associated documentation
//   files (the "Software"), to deal in the Software without
//   restriction, including without limitation the rights to use,
//   copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the
//   Software is furnished to do so, subject to the following
//   conditions:
//
//   The above copyright notice and this permission notice shall be
//   included in all copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
//   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
//   OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
//   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
//   HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
//   WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//   FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
//   OTHER DEALINGS IN THE SOFTWARE.

import type { MarkdownIt, StateBlock, StateInline } from "markdown-it";
import { escapedSplit } from "./split.ts";

type RuleInline = (state: StateInline, silent: boolean) => boolean;

/** The inline rule of markdown-it with this name. */
function inlineRule(md: MarkdownIt, name: string): RuleInline {
  const rules = (md.inline.ruler as unknown as { __rules__: { name: string; fn: RuleInline }[] }).__rules__;
  return rules.find((r) => r.name === name)!.fn;
}

/**
 * The offsets of the pipes in a line that the link pipe rule of `discourse` keeps as text. It reads the line with the
 * inline parser of `md`, one element after the other. An element that starts with `[` or `![` is a candidate. It is
 * complete if the link rule or the image rule of markdown-it reads it as an inline link or image, or if a second label
 * `[...]` follows its link text. Each pipe of a complete candidate is kept. The parse has no reference definitions.
 */
export function linkPipes(md: MarkdownIt, line: string): Set<number> {
  const kept = new Set<number>();
  if (!line.includes("|") || !line.includes("[")) return kept;
  const state = new md.inline.State(line, md, {}, []);
  const link = inlineRule(md, "link");
  const image = inlineRule(md, "image");
  const max = state.posMax;
  while (state.pos < max) {
    const start = state.pos;
    const ch = line.charCodeAt(start);
    const isImage = ch === 0x21 && line.charCodeAt(start + 1) === 0x5b;
    if (ch === 0x5b || isImage) {
      const end = completeEnd(state, start, isImage, isImage ? image : link);
      if (end > start) {
        for (let pos = start; pos < end; pos++) if (line.charCodeAt(pos) === 0x7c) kept.add(pos);
        state.pos = end;
        continue;
      }
      state.pos = start;
    }
    md.inline.skipToken(state);
  }
  return kept;
}

/** The end offset of a complete link or image that starts at `start`, or -1. It leaves `state.pos` undefined. */
function completeEnd(state: StateInline, start: number, isImage: boolean, rule: RuleInline): number {
  state.pos = start;
  if (rule(state, true)) return state.pos;
  const md = state.md;
  // A link text cannot hold another link. An image text can.
  const labelEnd = md.helpers.parseLinkLabel(state, isImage ? start + 1 : start, !isImage);
  if (labelEnd < 0 || state.src.charCodeAt(labelEnd + 1) !== 0x5b) return -1;
  const secondEnd = md.helpers.parseLinkLabel(state, labelEnd + 1);
  return secondEnd < 0 ? -1 : secondEnd + 1;
}

/** The text of a line that a block rule reads: after the container markers and the indent. */
function getLine(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]!);
}

const isSpace = (code: number) => code === 0x09 || code === 0x20;

/** markdown-it 15.0.1: a table body stops when it has more autocompleted cells than this. */
const MAX_AUTOCOMPLETED_CELLS = 0x10000;

/** The cells of a trimmed row line: the split with the link pipe rule, with no empty first and no empty last part. */
function rowCells(state: StateBlock, lineText: string): string[] {
  const columns = escapedSplit(lineText, linkPipes(state.md, lineText)).map((part) => part.text);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  return columns;
}

/**
 * The block rule `table` of markdown-it 15.0.1 with the link pipe rule of `discourse`. Each step is the step of the
 * original rule, and only the split of the header line and the body lines differs.
 */
export function discourseTable(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (startLine + 2 > endLine) return false;
  let nextLine = startLine + 1;
  if (state.sCount[nextLine]! < state.blkIndent) return false;
  if (state.sCount[nextLine]! - state.blkIndent >= 4) return false;

  // The delimiter line: only `|`, `-`, `:`, and spaces.
  let pos = state.bMarks[nextLine]! + state.tShift[nextLine]!;
  if (pos >= state.eMarks[nextLine]!) return false;
  const firstCh = state.src.charCodeAt(pos++);
  if (firstCh !== 0x7c && firstCh !== 0x2d && firstCh !== 0x3a) return false;
  if (pos >= state.eMarks[nextLine]!) return false;
  const secondCh = state.src.charCodeAt(pos++);
  if (secondCh !== 0x7c && secondCh !== 0x2d && secondCh !== 0x3a && !isSpace(secondCh)) return false;
  if (firstCh === 0x2d && isSpace(secondCh)) return false;
  while (pos < state.eMarks[nextLine]!) {
    const ch = state.src.charCodeAt(pos);
    if (ch !== 0x7c && ch !== 0x2d && ch !== 0x3a && !isSpace(ch)) return false;
    pos++;
  }

  let lineText = getLine(state, startLine + 1);
  let columns = lineText.split("|");
  const aligns: string[] = [];
  for (let i = 0; i < columns.length; i++) {
    const t = columns[i]!.trim();
    if (!t) {
      if (i === 0 || i === columns.length - 1) continue;
      return false;
    }
    if (!/^:?-+:?$/.test(t)) return false;
    if (t.charCodeAt(t.length - 1) === 0x3a) aligns.push(t.charCodeAt(0) === 0x3a ? "center" : "right");
    else if (t.charCodeAt(0) === 0x3a) aligns.push("left");
    else aligns.push("");
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf("|") === -1) return false;
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  columns = rowCells(state, lineText);
  const columnCount = columns.length;
  if (columnCount === 0 || columnCount !== aligns.length) return false;
  if (silent) return true;

  const oldParentType = state.parentType;
  state.parentType = "table" as typeof state.parentType;
  const terminatorRules = state.md.block.ruler.getRules("blockquote");

  const tokenTable = state.push("table_open", "table", 1);
  const tableLines: [number, number] = [startLine, 0];
  tokenTable.map = tableLines;
  state.push("thead_open", "thead", 1).map = [startLine, startLine + 1];
  state.push("tr_open", "tr", 1).map = [startLine, startLine + 1];
  for (let i = 0; i < columns.length; i++) {
    const token = state.push("th_open", "th", 1);
    if (aligns[i]) token.attrs = [["style", `text-align:${aligns[i]}`]];
    const inline = state.push("inline", "", 0);
    inline.content = columns[i]!.trim();
    inline.children = [];
    state.push("th_close", "th", -1);
  }
  state.push("tr_close", "tr", -1);
  state.push("thead_close", "thead", -1);

  let tbodyLines: [number, number] | undefined;
  let autocompletedCells = 0;
  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine]! < state.blkIndent) break;
    if (terminatorRules.some((rule) => rule(state, nextLine, endLine, true))) break;
    lineText = getLine(state, nextLine).trim();
    if (!lineText) break;
    if (state.sCount[nextLine]! - state.blkIndent >= 4) break;
    columns = rowCells(state, lineText);
    autocompletedCells += columnCount - columns.length;
    if (autocompletedCells > MAX_AUTOCOMPLETED_CELLS) break;
    if (nextLine === startLine + 2) {
      tbodyLines = [startLine + 2, 0];
      state.push("tbody_open", "tbody", 1).map = tbodyLines;
    }
    state.push("tr_open", "tr", 1).map = [nextLine, nextLine + 1];
    for (let i = 0; i < columnCount; i++) {
      const token = state.push("td_open", "td", 1);
      if (aligns[i]) token.attrs = [["style", `text-align:${aligns[i]}`]];
      const inline = state.push("inline", "", 0);
      inline.content = columns[i] ? columns[i]!.trim() : "";
      inline.children = [];
      state.push("td_close", "td", -1);
    }
    state.push("tr_close", "tr", -1);
  }
  if (tbodyLines) {
    state.push("tbody_close", "tbody", -1);
    tbodyLines[1] = nextLine;
  }
  state.push("table_close", "table", -1);
  tableLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
