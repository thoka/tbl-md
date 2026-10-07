// The renderer of a tbl block (docs/format.md, section Canonical form).
// It writes the canonical form, so that parse(render(table)) gives the table back.
import { renderAttributes, validateAttributes } from "./attributes.ts";
import type { Column, Table } from "./parse.ts";
import { escapeLine } from "./syntax.ts";

const keyForm = /^[a-z0-9_-]+$/;
/** A line that CommonMark reads as a closing backtick fence. */
const closingFence = /^ {0,3}(`{3,})[ \t]*$/;

/**
 * Lists the problems that stop a table from a render with no loss.
 * Columns and rows count from 1. An empty list means that the table is valid.
 */
export function validate(table: Table): string[] {
  const problems: string[] = [];
  if (table.columns.length === 0) problems.push("The table has no columns. A table needs one column at least.");
  const keys = new Set<string>();
  table.columns.forEach((column, i) => {
    const where = `Column ${i + 1}`;
    if (!keyForm.test(column.key)) {
      problems.push(`${where} has the key "${column.key}". A key must have the form [a-z0-9_-]+.`);
    }
    if (keys.has(column.key)) problems.push(`${where} has the key "${column.key}", and an earlier column has it too.`);
    keys.add(column.key);
    if (/[\r\n]/.test(column.title)) {
      problems.push(`${where} (key "${column.key}") has a title with a line break. A title has one line and no CR.`);
    }
    if (column.attributes !== undefined) problems.push(...validateAttributes(column.attributes, "column", `${where} (key "${column.key}")`));
  });
  table.rows.forEach((row, i) => {
    const where = `Row ${i + 1}`;
    if (row.attributes !== undefined) problems.push(...validateAttributes(row.attributes, "row", where));
    for (const [key, text] of Object.entries(row.cells)) {
      if (!keys.has(key)) {
        problems.push(`${where} has a cell with the key "${key}", but no column has this key.`);
        continue;
      }
      if (text.endsWith("\n")) {
        problems.push(`${where} has a cell "${key}" that ends with a line break. A cell never ends with an empty line.`);
      } else if (text.includes("\r")) {
        problems.push(`${where} has a cell "${key}" with a CR character. A CR is a line end, so a cell holds no CR.`);
      }
    }
    for (const [key, attributes] of Object.entries(row.cellAttributes ?? {})) {
      if (!keys.has(key)) {
        problems.push(`${where} has attributes for a cell with the key "${key}", but no column has this key.`);
        continue;
      }
      problems.push(...validateAttributes(attributes, "cell", `${where}, cell "${key}"`));
    }
  });
  return problems;
}

/** Writes the canonical text inside the fence: lines joined with "\n", with no final newline. It throws on an invalid table. */
export function render(table: Table): string {
  const problems = validate(table);
  if (problems.length > 0) throw new Error(problems[0]);
  const lines: string[] = [];
  for (const column of table.columns) {
    lines.push(keyLine(column.key, column.title));
    if (column.attributes !== undefined) lines.push(renderAttributes(column.attributes));
  }
  const short = shortKeys(table.columns);
  for (const row of table.rows) {
    lines.push(row.attributes === undefined ? "--" : `-- ${renderAttributes(row.attributes)}`);
    for (const { key } of table.columns) {
      const text = row.cells[key] ?? "";
      const attributes = row.cellAttributes?.[key];
      if (text === "" && attributes === undefined) continue;
      const [first, ...rest] = text.split("\n");
      lines.push(keyLine(short[key]!, first!), ...rest.map(escapeLine));
      // The attribute line of a cell is its last line. A cell with attributes and no text has the key line `key:`.
      if (attributes !== undefined) lines.push(renderAttributes(attributes));
    }
  }
  return lines.join("\n");
}

/**
 * Maps each header key to its short key (docs/format.md, section Canonical form).
 * The short key is the shortest prefix of the header key that is the header key itself, or that is a prefix of no other header key.
 * Rule 5 resolves it to its column: a unique prefix resolves to its key, and an exact key wins over a longer key.
 * Examples: `model`, `price`, `note` give `m`, `p`, `n`. `price`, `price-2` give `price` and `price-`.
 */
export function shortKeys(columns: Column[]): Record<string, string> {
  const keys = columns.map((c) => c.key);
  const result: Record<string, string> = {};
  for (const key of keys) {
    for (let length = 1; length <= key.length; length++) {
      const prefix = key.slice(0, length);
      if (prefix === key || !keys.some((other) => other !== key && other.startsWith(prefix))) {
        result[key] = prefix;
        break;
      }
    }
  }
  return result;
}

/** Writes the whole block: the opening fence with the info string `tbl`, the text, and the closing fence. No final newline. */
export function renderBlock(table: Table): string {
  const text = render(table);
  let longest = 0;
  for (const line of text.split("\n")) {
    const match = closingFence.exec(line);
    if (match) longest = Math.max(longest, match[1]!.length);
  }
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [`${fence}tbl`, text, fence].join("\n");
}

/** `key: text`, or `key:` with no space for an empty text. */
function keyLine(key: string, text: string): string {
  return text === "" ? `${key}:` : `${key}: ${text}`;
}
