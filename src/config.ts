// The configuration file of the lint: `.tbl-md.json` (docs/cli.md, section Configuration).
// Only `node:` modules, so that it runs on Node and on Bun.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FLAVORS, type Flavor } from "./flavor.ts";

/** The name of the configuration file. */
export const CONFIG_FILE = ".tbl-md.json";

/** The content of a valid configuration file. */
export interface Config {
  /** The attribute keys of the project, in the key form of rule 14. An empty list if the file has no `attributeKeys`. */
  attributeKeys: string[];
  /** The flavor of the project (docs/format.md, section Flavors). Absent if the file has no `flavor`. */
  flavor?: Flavor;
}

/** A problem of a configuration file. `line` is set only where `JSON.parse` gives the position of a syntax error. */
export interface ConfigError {
  file: string;
  line?: number;
  message: string;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; error: ConfigError };

/** The key form of rule 14 of docs/format.md. */
const keyForm = /^[A-Za-z][A-Za-z0-9_-]*$/;
const BOM = "﻿";

/**
 * Finds the configuration file for a folder. The search starts in the folder and goes up.
 * It stops at the first folder with `.tbl-md.json` and gives that file. It also stops at the first folder with a `.git`
 * entry (a folder or a file) and at the root, and gives null there. The path is absolute.
 */
export function findConfig(folder: string): string | null {
  let current = resolve(folder);
  for (;;) {
    const file = join(current, CONFIG_FILE);
    if (existsSync(file)) return file;
    if (existsSync(join(current, ".git"))) return null;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Reads and checks a configuration file. A file that cannot be read is a configuration error too. */
export function readConfig(file: string): ConfigResult {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const why = code === "ENOENT" ? "no such file" : code === "EISDIR" ? "it is a folder" : (code ?? (error as Error).message);
    return { ok: false, error: { file, message: `Cannot read the configuration file: ${why}.` } };
  }
  return parseConfig(text, file);
}

/**
 * Checks the text of a configuration file. `file` names the file in the error.
 * The file is one JSON object with the keys `$schema` (a string, which the loader ignores), `attributeKeys`
 * (a list of keys), and `flavor` (one of FLAVORS). Each other key, a value of a wrong type, a key with a bad form,
 * an unknown flavor, and invalid JSON are errors.
 */
export function parseConfig(text: string, file: string): ConfigResult {
  const fail = (message: string, line?: number): ConfigResult => ({
    ok: false,
    error: line === undefined ? { file, message } : { file, line, message },
  });
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch (error) {
    const message = (error as Error).message;
    return fail(`The file is not valid JSON: ${message.replace(/\.$/, "")}.`, syntaxErrorLine(message, source));
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return fail('The file must hold one JSON object, for example {"attributeKeys": ["status"]}.');
  }
  const object = data as Record<string, unknown>;
  for (const key of Object.keys(object)) {
    if (key !== "$schema" && key !== "attributeKeys" && key !== "flavor") {
      return fail(`The key "${key}" is unknown. The file can have only the keys "$schema", "attributeKeys", and "flavor".`);
    }
  }
  if ("$schema" in object && typeof object.$schema !== "string") {
    return fail('The value of "$schema" must be a string, the URL of the JSON Schema of the file.');
  }
  const config: Config = { attributeKeys: [] };
  if ("flavor" in object) {
    const flavor = object.flavor;
    if (typeof flavor !== "string" || !(FLAVORS as readonly string[]).includes(flavor)) {
      const shown = typeof flavor === "string" ? `"${flavor}"` : JSON.stringify(flavor);
      return fail(`The value ${shown} of "flavor" is not a flavor. Give one of ${FLAVORS.map((f) => `"${f}"`).join(", ")}.`);
    }
    config.flavor = flavor as Flavor;
  }
  if (!("attributeKeys" in object)) return { ok: true, config };
  const keys = object.attributeKeys;
  if (!Array.isArray(keys)) {
    return fail('The value of "attributeKeys" must be a list of keys, for example ["status", "owner"].');
  }
  for (const [i, key] of keys.entries()) {
    if (typeof key !== "string") return fail(`attributeKeys[${i}] must be a string, for example "status".`);
    if (!keyForm.test(key)) {
      return fail(`attributeKeys[${i}] "${key}" is not a key. A key starts with a letter, then letters, digits, "_", and "-".`);
    }
  }
  config.attributeKeys = keys as string[];
  return { ok: true, config };
}

/**
 * The 1-based line of a JSON syntax error, from the message of `JSON.parse`.
 * Node gives "line L column C" or "at position P" in some messages. Bun gives no position, and then the line is unknown.
 */
function syntaxErrorLine(message: string, source: string): number | undefined {
  const line = /\bline (\d+)/.exec(message);
  if (line) return Number(line[1]);
  const position = /\bposition (\d+)/.exec(message);
  if (!position) return undefined;
  const before = source.slice(0, Number(position[1]));
  return before.split(/\r\n|\r|\n/).length;
}
