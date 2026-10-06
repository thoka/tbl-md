// The attribute blocks of a tbl block (docs/format.md, rules 13 to 16, and the section Canonical form).
// An attribute block describes a column, a row, or a cell: `{#id .class key=value}`.

/** A pair `key=value` of an attribute block. The value has no quotes and no escapes. */
export interface Pair {
  key: string;
  value: string;
}

/** The parts of an attribute block. `classes` and `pairs` are always arrays, in source order. */
export interface Attributes {
  id?: string;
  classes: string[];
  pairs: Pair[];
}

/** The thing that an attribute block describes. */
export type AttributePlace = "column" | "row" | "cell";

/** The error codes of the attributes (rule 16). */
export type AttributeErrorCode =
  | "attr-unexpected-char"
  | "attr-no-space"
  | "attr-empty"
  | "attr-bad-id"
  | "attr-bad-class"
  | "attr-bad-key"
  | "attr-duplicate-id"
  | "attr-duplicate-class"
  | "attr-duplicate-key"
  | "attr-reserved-key"
  | "attr-no-value"
  | "attr-bad-bare-value"
  | "attr-single-quotes"
  | "attr-unclosed-quote"
  | "attr-bad-escape"
  | "attr-bad-value"
  | "attr-key-place"
  | "attr-second-line"
  | "attr-misplaced";

/** An error of one attribute block. `offset` is the 0-based offset of the first bad character in the block. */
export interface AttributeError {
  code: AttributeErrorCode;
  message: string;
  offset: number;
}

export type AttributesResult = { ok: true; attributes: Attributes } | { ok: false; error: AttributeError };

/** The known keys and their values (rule 15). `align` is allowed only on a column. */
const alignValues = ["left", "center", "right"];

const idForm = /^[A-Za-z0-9_-]+$/;
const classForm = /^[A-Za-z][A-Za-z0-9_-]*$/;
const keyForm = /^[A-Za-z][A-Za-z0-9_-]*$/;
const bareForm = /^[A-Za-z0-9_:-]+$/;

const isSpace = (c: string | undefined) => c === " " || c === "\t";
const isIdChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_-]/.test(c);
const isBareChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_:-]/.test(c);
const isLetter = (c: string | undefined) => c !== undefined && /[A-Za-z]/.test(c);

class Failure extends Error {
  constructor(
    readonly code: AttributeErrorCode,
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

/** Shows one character in a message. A space or a tab gets a name, because it is invisible. */
function show(c: string | undefined): string {
  if (c === undefined) return "the end of the block";
  if (c === " ") return "a space";
  if (c === "\t") return "a tab";
  return `"${c}"`;
}

/**
 * Reads one attribute block by the grammar of rule 14, for example `{#a1 .new align=right}`.
 * Spaces and tabs after the closing `}` do not count. It stops at the first error.
 * With a place, it also checks the known keys at that place (rule 15): the value of `align`, and `align` at a row or a cell.
 */
export function parseAttributes(block: string, place?: AttributePlace): AttributesResult {
  try {
    const { attributes, valueOffsets, keyOffsets } = readBlock(block.replace(/[ \t]+$/, ""));
    if (place !== undefined) checkKnownKeys(attributes, place, keyOffsets, valueOffsets);
    return { ok: true, attributes };
  } catch (e) {
    if (e instanceof Failure) return { ok: false, error: { code: e.code, message: e.message, offset: e.offset } };
    throw e;
  }
}

/**
 * Gives each pair of a valid attribute block with the 0-based offset of its key in the block, in source order.
 * It gives an empty list for a block that does not parse. Not part of the public API: the lint uses it to place a warning.
 */
export function pairOffsets(block: string): { key: string; offset: number }[] {
  try {
    const { attributes, keyOffsets } = readBlock(block.replace(/[ \t]+$/, ""));
    return attributes.pairs.map((pair, i) => ({ key: pair.key, offset: keyOffsets[i]! }));
  } catch (e) {
    if (e instanceof Failure) return [];
    throw e;
  }
}

function readBlock(text: string): { attributes: Attributes; keyOffsets: number[]; valueOffsets: number[] } {
  const attributes: Attributes = { classes: [], pairs: [] };
  const keyOffsets: number[] = [];
  const valueOffsets: number[] = [];
  const end = text.length - 1;
  if (text[0] !== "{") {
    throw new Failure("attr-unexpected-char", `An attribute block starts with "{", not with ${show(text[0])}.`, 0);
  }
  if (text[end] !== "}" || end === 0) {
    throw new Failure("attr-unexpected-char", 'An attribute block ends with "}". Add "}" at the end of the block.', text.length);
  }
  let pos = 1;
  const skipSpace = () => {
    while (isSpace(text[pos])) pos++;
  };
  skipSpace();
  if (pos === end) {
    throw new Failure(
      "attr-empty",
      "The attribute block is empty. Write an ID, a class, or a pair in it, for example {.new}, or remove the block.",
      pos,
    );
  }

  /** After a part: a space, the closing "}", or an error. `other` gives the error for a character that does not start a part. */
  const afterPart = (other: (c: string) => Failure) => {
    const c = text[pos]!;
    if (isSpace(c) || pos === end) return;
    if (c === "#" || c === ".") {
      throw new Failure("attr-no-space", `Two parts of the attribute block have no space between them. Add a space before "${c}".`, pos);
    }
    if (c === "}") {
      throw new Failure("attr-unexpected-char", 'The attribute block has a "}" before its end. Only the last "}" closes the block.', pos);
    }
    throw other(c);
  };

  for (;;) {
    const start = pos;
    const c = text[pos]!;
    if (c === "#") {
      pos++;
      while (isIdChar(text[pos]) && pos < end) pos++;
      if (pos === start + 1) {
        throw new Failure("attr-bad-id", 'The ID is empty. Write the ID after "#", for example #a1.', pos);
      }
      afterPart(
        (bad) => new Failure("attr-bad-id", `The ID has the character ${show(bad)}. An ID has only letters, digits, "_", and "-".`, pos),
      );
      if (attributes.id !== undefined) {
        throw new Failure("attr-duplicate-id", "The attribute block has more than one ID. Keep only one ID.", start);
      }
      attributes.id = text.slice(start + 1, pos);
    } else if (c === ".") {
      pos++;
      if (!isLetter(text[pos]) || pos === end) {
        const message =
          isSpace(text[pos]) || pos === end
            ? 'The class is empty. Write a name after ".", for example .new.'
            : `The class starts with ${show(text[pos])}. A class starts with a letter, then letters, digits, "_", and "-".`;
        throw new Failure("attr-bad-class", message, pos);
      }
      while (isIdChar(text[pos]) && pos < end) pos++;
      afterPart(
        (bad) =>
          new Failure("attr-bad-class", `The class has the character ${show(bad)}. A class has only letters, digits, "_", and "-".`, pos),
      );
      const name = text.slice(start + 1, pos);
      if (attributes.classes.includes(name)) {
        throw new Failure("attr-duplicate-class", `The attribute block has the class "${name}" two times. Remove one.`, start);
      }
      attributes.classes.push(name);
    } else if (isLetter(c)) {
      readPair(start);
    } else if (isIdChar(c)) {
      throw new Failure(
        "attr-bad-key",
        `A key starts with ${show(c)}. A key starts with a letter, then letters, digits, "_", and "-".`,
        pos,
      );
    } else {
      throw new Failure(
        "attr-unexpected-char",
        `The attribute block has the unexpected character ${show(c)}. A part is an ID (#id), a class (.class), or a pair (key=value).`,
        pos,
      );
    }
    skipSpace();
    if (pos === end) break;
  }
  return { attributes, keyOffsets, valueOffsets };

  function readPair(start: number): void {
    while (isIdChar(text[pos]) && pos < end) pos++;
    const key = text.slice(start, pos);
    if (key === "id" || key === "class") {
      const fix = key === "id" ? "Write the ID as #x" : "Write the class as .x";
      throw new Failure("attr-reserved-key", `The key "${key}" is not allowed. ${fix}.`, start);
    }
    if (attributes.pairs.some((p) => p.key === key)) {
      throw new Failure("attr-duplicate-key", `The attribute block has the key "${key}" two times. Remove one.`, start);
    }
    const eq = text[pos];
    if (eq !== "=") {
      if (isSpace(eq) || pos === end) throw noValue(key, pos);
      throw new Failure(
        "attr-bad-key",
        `The key "${key}" has the character ${show(eq)}. A key has only letters, digits, "_", and "-", and "=" comes after it.`,
        pos,
      );
    }
    pos++;
    const valueStart = pos;
    const v = text[pos];
    let value: string;
    if (v === '"') {
      pos++;
      value = "";
      for (;;) {
        // The last "}" closes the block, so a quote that is still open at the end of the block has no closing quote.
        if (pos >= end) {
          throw new Failure("attr-unclosed-quote", `The value of "${key}" has no closing quote. Add a '"' at the end of the value.`, valueStart);
        }
        const ch = text[pos]!;
        if (ch === '"') break;
        if (ch === "\\") {
          const next = text[pos + 1];
          if (pos + 1 < end && (next === '"' || next === "\\")) {
            value += next;
            pos += 2;
            continue;
          }
          if (pos + 1 >= end) {
            throw new Failure("attr-unclosed-quote", `The value of "${key}" has no closing quote. Add a '"' at the end of the value.`, valueStart);
          }
          throw new Failure(
            "attr-bad-escape",
            `The value of "${key}" has a backslash before ${show(next)}. In a quoted value, only \\" and \\\\ are escapes. Write \\\\ for a backslash.`,
            pos,
          );
        }
        value += ch;
        pos++;
      }
      pos++;
      afterPart((bad) =>
        isLetter(bad)
          ? new Failure("attr-no-space", `Two parts of the attribute block have no space between them. Add a space before "${bad}".`, pos)
          : new Failure(
              "attr-unexpected-char",
              `The attribute block has the unexpected character ${show(bad)} after the value of "${key}". Add a space before the next part.`,
              pos,
            ),
      );
    } else if (v === "'") {
      throw new Failure("attr-single-quotes", `The value of "${key}" has single quotes. Use double quotes: ${key}="...".`, pos);
    } else if (isSpace(v) || pos === end) {
      throw noValue(key, pos);
    } else {
      while (isBareChar(text[pos]) && pos < end) pos++;
      if (!(isSpace(text[pos]) || pos === end)) {
        let rawEnd = pos;
        while (rawEnd < end && !isSpace(text[rawEnd])) rawEnd++;
        const raw = text.slice(valueStart, rawEnd);
        throw new Failure(
          "attr-bad-bare-value",
          `The value of "${key}" has the character ${show(text[pos])}. A value with no quotes has only letters, digits, "_", ":", and "-". Put the value in double quotes: ${key}="${raw.replace(/["\\]/g, "\\$&")}".`,
          pos,
        );
      }
      value = text.slice(valueStart, pos);
    }
    attributes.pairs.push({ key, value });
    keyOffsets.push(start);
    valueOffsets.push(valueStart);
  }
}

function noValue(key: string, offset: number): Failure {
  return new Failure("attr-no-value", `The key "${key}" has no value. Write "=" and a value, for example ${key}=x, or ${key}="" for an empty value.`, offset);
}

function checkKnownKeys(attributes: Attributes, place: AttributePlace, keyOffsets: number[], valueOffsets: number[]): void {
  attributes.pairs.forEach((pair, i) => {
    if (pair.key !== "align") return;
    if (place !== "column") throw new Failure("attr-key-place", alignPlaceMessage(place), keyOffsets[i]!);
    if (!alignValues.includes(pair.value)) throw new Failure("attr-bad-value", alignValueMessage(pair.value), valueOffsets[i]!);
  });
}

function alignPlaceMessage(place: AttributePlace): string {
  return `The key "align" is allowed only on a column, not on a ${place}. Remove it, or write it in the attribute line of the column.`;
}

function alignValueMessage(value: string): string {
  return `The value "${value}" of "align" is not valid. Use left, center, or right.`;
}

/**
 * Lists the problems of an attributes object at a place, as plain English messages that start with `where`.
 * These are the problems that stop a render with no loss. An empty list means that the attributes are valid.
 */
export function validateAttributes(attributes: Attributes, place: AttributePlace, where: string): string[] {
  const problems: string[] = [];
  const { id, classes, pairs } = attributes;
  if (id === undefined && classes.length === 0 && pairs.length === 0) {
    problems.push(`${where} has an empty attribute block. Give it an ID, a class, or a pair, or remove it.`);
  }
  if (id !== undefined && !idForm.test(id)) {
    problems.push(`${where} has the ID "${id}". An ID must have the form [A-Za-z0-9_-]+.`);
  }
  const seenClasses = new Set<string>();
  for (const name of classes) {
    if (!classForm.test(name)) {
      problems.push(`${where} has the class "${name}". A class must have the form [A-Za-z][A-Za-z0-9_-]*.`);
    }
    if (seenClasses.has(name)) problems.push(`${where} has the class "${name}" two times.`);
    seenClasses.add(name);
  }
  const seenKeys = new Set<string>();
  for (const { key, value } of pairs) {
    if (!keyForm.test(key)) {
      problems.push(`${where} has the attribute key "${key}". A key must have the form [A-Za-z][A-Za-z0-9_-]*.`);
    } else if (key === "id" || key === "class") {
      problems.push(`${where} has the attribute key "${key}". Use the ${key === "id" ? "id" : "classes"} field instead.`);
    }
    if (seenKeys.has(key)) problems.push(`${where} has the attribute key "${key}" two times.`);
    seenKeys.add(key);
    if (/[\r\n]/.test(value)) {
      problems.push(`${where} has a value of "${key}" with a line break. A value has one line and no CR.`);
    }
    if (key === "align") {
      if (place !== "column") problems.push(`${where}: ${alignPlaceMessage(place)}`);
      else if (!alignValues.includes(value)) problems.push(`${where}: ${alignValueMessage(value)}`);
    }
  }
  return problems;
}

/**
 * Writes the canonical form of an attribute block (docs/format.md, section Canonical form):
 * the ID, then the classes, then the pairs, with one space between them. A value of the form [A-Za-z0-9_:-]+ is bare.
 * Each other value has double quotes, with `\"` for `"` and `\\` for `\`.
 */
export function renderAttributes(attributes: Attributes): string {
  const parts: string[] = [];
  if (attributes.id !== undefined) parts.push(`#${attributes.id}`);
  for (const name of attributes.classes) parts.push(`.${name}`);
  for (const { key, value } of attributes.pairs) {
    parts.push(`${key}=${bareForm.test(value) ? value : `"${value.replace(/["\\]/g, "\\$&")}"`}`);
  }
  return `{${parts.join(" ")}}`;
}
