// The split of a GFM row line, as the table rule of markdown-it does it (docs/format.md, section How markdown-it splits a
// GFM row). This module has no markdown-it type, so that the type declarations of the package do not need markdown-it.

/** One part of a split row line, with its offsets in the line. */
export interface SplitPart {
  start: number;
  end: number;
  /** The text of the part, with one backslash removed before each escaped pipe. */
  text: string;
}

/**
 * The split function of the markdown-it table rule (`escapedSplit` in rules_block/table, 15.0.1), with the offsets
 * of each part. A pipe is a delimiter unless the character before it is a backslash. Then the part loses that one
 * backslash. Thus a run of any number of backslashes before a pipe escapes it, also an even run.
 * A pipe in `kept` (offsets in `str`) is text: it never splits, and the backslash before it stays.
 */
export function escapedSplit(str: string, kept: ReadonlySet<number> = NONE): SplitPart[] {
  const result: SplitPart[] = [];
  let isEscaped = false;
  let lastPos = 0;
  let segStart = 0;
  let current = "";
  for (let pos = 0; pos < str.length; pos++) {
    const ch = str.charCodeAt(pos);
    if (ch === 0x7c && !kept.has(pos)) {
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

const NONE: ReadonlySet<number> = new Set();
