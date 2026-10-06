// The line forms of a tbl block (docs/format.md, rules 3, 4, 10, and 13).
// The parser and the renderer share them.

/** A key line: a key, a colon, and then a space or the end of the line (rule 3). */
export const keyLine = /^([a-z0-9_-]+):( |$)/;

/** The escaped key form: a key, one or more backslashes, a colon, and then a space or the end of the line (rule 10). */
export const escapedKeyLine = /^([a-z0-9_-]+)(\\+):( |$)/;

/**
 * A line in the attribute form: `{` first, and `}` as the last character other than a space or a tab (rule 13).
 * Group 1 is the block, with no spaces or tabs after the `}`. The form says nothing about whether the block parses.
 */
export const attributeLine = /^(\{[\s\S]*\})[ \t]*$/;

/** The escaped attribute form: one or more backslashes, and then the rest of a line in the attribute form (rule 10). */
export const escapedAttributeLine = /^(\\+)\{[\s\S]*\}[ \t]*$/;

/**
 * A record separator: exactly `--`, or `--`, spaces or tabs, and a rest in the attribute form (rule 4).
 * Group 1 is the spaces and tabs, and group 2 is the attribute block of the row. The block need not parse.
 */
export const separatorLine = /^--(?:([ \t]+)(\{[\s\S]*\})[ \t]*)?$/;

/** The escaped separator form: one or more backslashes, and then the rest of a separator line (rule 10). */
export const escapedSeparatorLine = /^(\\+)--(?:[ \t]+\{[\s\S]*\}[ \t]*)?$/;

/** True if the line has one of the three escaped forms of rule 10. */
export function isEscaped(line: string): boolean {
  return escapedKeyLine.test(line) || escapedSeparatorLine.test(line) || escapedAttributeLine.test(line);
}

/**
 * Removes one backslash from a line of an escaped form (rule 10).
 * A line of another form comes back unchanged.
 */
export function unescapeLine(line: string): string {
  const key = escapedKeyLine.exec(line);
  if (key) return key[1]! + line.slice(key[1]!.length + 1);
  if (escapedSeparatorLine.test(line) || escapedAttributeLine.test(line)) return line.slice(1);
  return line;
}

/**
 * Adds one backslash to a line of the key form, the separator form, or the attribute form, escaped or not (rule 10).
 * A line of another form comes back unchanged. Thus `unescapeLine(escapeLine(line))` is `line`.
 */
export function escapeLine(line: string): string {
  const key = keyLine.exec(line) ?? escapedKeyLine.exec(line);
  if (key) return key[1]! + "\\" + line.slice(key[1]!.length);
  if (separatorLine.test(line) || escapedSeparatorLine.test(line)) return "\\" + line;
  if (attributeLine.test(line) || escapedAttributeLine.test(line)) return "\\" + line;
  return line;
}
