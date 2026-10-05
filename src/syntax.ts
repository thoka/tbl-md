// The line forms of a tbl block (docs/format.md, rules 3, 4, and 10).
// The parser and the renderer share them.

/** A key line: a key, a colon, and then a space or the end of the line (rule 3). */
export const keyLine = /^([a-z0-9_-]+):( |$)/;

/** The escaped key form: a key, one or more backslashes, a colon, and then a space or the end of the line (rule 10). */
export const escapedKeyLine = /^([a-z0-9_-]+)(\\+):( |$)/;

/** A record separator: exactly `--`, with an optional ID marker after one space (rule 4). */
export const separatorLine = /^--( \{#([A-Za-z0-9_-]+)\})?$/;

/** The escaped separator form: one or more backslashes, `--`, and an optional ID marker (rule 10). */
export const escapedSeparatorLine = /^(\\+)--( \{#[A-Za-z0-9_-]+\})?$/;

/** True if the line has one of the two escaped forms of rule 10. */
export function isEscaped(line: string): boolean {
  return escapedKeyLine.test(line) || escapedSeparatorLine.test(line);
}

/**
 * Removes one backslash from a line of an escaped form (rule 10).
 * A line of another form comes back unchanged.
 */
export function unescapeLine(line: string): string {
  const key = escapedKeyLine.exec(line);
  if (key) return key[1]! + line.slice(key[1]!.length + 1);
  if (escapedSeparatorLine.test(line)) return line.slice(1);
  return line;
}

/**
 * Adds one backslash to a line of the key form or the separator form, escaped or not (rule 10).
 * A line of another form comes back unchanged. Thus `unescapeLine(escapeLine(line))` is `line`.
 */
export function escapeLine(line: string): string {
  const key = keyLine.exec(line) ?? escapedKeyLine.exec(line);
  if (key) return key[1]! + "\\" + line.slice(key[1]!.length);
  if (separatorLine.test(line) || escapedSeparatorLine.test(line)) return "\\" + line;
  return line;
}
