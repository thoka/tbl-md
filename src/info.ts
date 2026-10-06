// The info string of a fence (docs/format.md, rule 1). This module imports nothing, so that the markdown-it plugin
// (src/markdown-it.ts) can use it with no markdown-it value and no `node:` module.

/**
 * The language and the meta of an info string, as the fence renderer of markdown-it splits it: the first word, then
 * the rest, or null if there is no rest. The caller unescapes the info string first (`md.utils.unescapeAll`).
 */
export function splitInfo(info: string): [string, string | null] {
  const trimmed = info.trim();
  const match = /^(\S*)\s*([\s\S]*)$/.exec(trimmed)!;
  return [match[1]!, match[2] === "" ? null : match[2]!];
}
