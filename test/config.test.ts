import { describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_FILE, findConfig, parseConfig, readConfig } from "../src/index.ts";
import { tempDir } from "./helpers.ts";

const root = join(import.meta.dir, "..");
const schema = JSON.parse(readFileSync(join(root, "schema/tbl-md.schema.json"), "utf8")) as Schema;

describe("parseConfig", () => {
  test("a file with $schema and attributeKeys", () => {
    const text = '{"$schema": "https://example.com/s.json", "attributeKeys": ["status", "owner-2"]}';
    expect(parseConfig(text, "c.json")).toEqual({ ok: true, config: { attributeKeys: ["status", "owner-2"] } });
  });

  test("a file with no attributeKeys has an empty list", () => {
    expect(parseConfig("{}", "c.json")).toEqual({ ok: true, config: { attributeKeys: [] } });
  });

  test("a BOM before the JSON is allowed", () => {
    expect(parseConfig('﻿{"attributeKeys": ["a"]}', "c.json")).toMatchObject({ ok: true });
  });

  test.each([
    ["not an object", "[]", "must hold one JSON object"],
    ["null", "null", "must hold one JSON object"],
    ["an unknown key", '{"attributeKey": []}', 'The key "attributeKey" is unknown'],
    ["$schema that is not a string", '{"$schema": 1}', '"$schema" must be a string'],
    ["attributeKeys that is not a list", '{"attributeKeys": "status"}', '"attributeKeys" must be a list'],
    ["a key that is not a string", '{"attributeKeys": ["a", 1]}', "attributeKeys[1] must be a string"],
    ["a key that starts with a digit", '{"attributeKeys": ["1a"]}', 'attributeKeys[0] "1a" is not a key'],
    ["a key with a dot", '{"attributeKeys": ["a", "b.c"]}', 'attributeKeys[1] "b.c" is not a key'],
    ["an empty key", '{"attributeKeys": [""]}', 'attributeKeys[0] "" is not a key'],
  ])("%s is an error that names the file", (_, text, message) => {
    const result = parseConfig(text, "dir/.tbl-md.json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.file).toBe("dir/.tbl-md.json");
    expect(result.error.line).toBeUndefined();
    expect(result.error.message).toContain(message);
  });

  test("invalid JSON is an error with the message of JSON.parse", () => {
    const result = parseConfig('{\n"attributeKeys": ["a"],\n}', "c.json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toStartWith("The file is not valid JSON: ");
    // Node gives the position of this error, and Bun does not.
    if (result.error.line !== undefined) expect(result.error.line).toBe(3);
  });

  test("an empty file is invalid JSON", () => {
    expect(parseConfig("", "c.json")).toMatchObject({ ok: false, error: { file: "c.json" } });
  });
});

describe("readConfig", () => {
  test("reads a file", () => {
    const dir = tempDir("config");
    writeFileSync(join(dir, CONFIG_FILE), '{"attributeKeys": ["a"]}');
    expect(readConfig(join(dir, CONFIG_FILE))).toEqual({ ok: true, config: { attributeKeys: ["a"] } });
  });

  test("a missing file is an error", () => {
    const file = join(tempDir("config"), CONFIG_FILE);
    expect(readConfig(file)).toEqual({ ok: false, error: { file, message: "Cannot read the configuration file: no such file." } });
  });

  test("a folder is an error", () => {
    const file = join(tempDir("config"), CONFIG_FILE);
    mkdirSync(file);
    expect(readConfig(file)).toMatchObject({ ok: false, error: { message: "Cannot read the configuration file: it is a folder." } });
  });
});

describe("findConfig", () => {
  /** A tree: root/.git, root/.tbl-md.json, root/a/b, and root/sub with its own .tbl-md.json and folder c. */
  function tree(): string {
    const dir = tempDir("find");
    mkdirSync(join(dir, ".git"));
    writeFileSync(join(dir, CONFIG_FILE), "{}");
    mkdirSync(join(dir, "a", "b"), { recursive: true });
    mkdirSync(join(dir, "sub", "c"), { recursive: true });
    writeFileSync(join(dir, "sub", CONFIG_FILE), "{}");
    return dir;
  }

  test("finds the file in the folder itself and in a parent", () => {
    const dir = tree();
    expect(findConfig(dir)).toBe(join(dir, CONFIG_FILE));
    expect(findConfig(join(dir, "a", "b"))).toBe(join(dir, CONFIG_FILE));
  });

  test("the nearest file wins", () => {
    const dir = tree();
    expect(findConfig(join(dir, "sub", "c"))).toBe(join(dir, "sub", CONFIG_FILE));
  });

  test("the search stops at a .git folder", () => {
    const dir = tempDir("find");
    writeFileSync(join(dir, CONFIG_FILE), "{}");
    mkdirSync(join(dir, "repo", ".git"), { recursive: true });
    mkdirSync(join(dir, "repo", "docs"));
    expect(findConfig(join(dir, "repo", "docs"))).toBeNull();
  });

  test("the search stops at a .git file, as in a git worktree", () => {
    const dir = tempDir("find");
    writeFileSync(join(dir, CONFIG_FILE), "{}");
    mkdirSync(join(dir, "worktree"));
    writeFileSync(join(dir, "worktree", ".git"), "gitdir: ../.git/worktrees/x\n");
    expect(findConfig(join(dir, "worktree"))).toBeNull();
  });

  test("a relative folder gives an absolute path", () => {
    const found = findConfig(".");
    if (found !== null) expect(found).toStartWith("/");
  });
});

/** The keywords of JSON Schema that the schema of tbl-md uses. A test fails on another keyword, so that this check stays complete. */
interface Schema {
  $schema?: string;
  title?: string;
  description?: string;
  type?: "object" | "array" | "string";
  properties?: Record<string, Schema>;
  additionalProperties?: false;
  items?: Schema;
  pattern?: string;
}

const KEYWORDS = ["$schema", "title", "description", "type", "properties", "additionalProperties", "items", "pattern"];

/** A small validator for the keywords of `Schema`, so that the test needs no JSON Schema library. */
function valid(schema: Schema, value: unknown): boolean {
  for (const keyword of Object.keys(schema)) if (!KEYWORDS.includes(keyword)) throw new Error(`The test does not know the keyword ${keyword}.`);
  if (schema.type === "object" && (typeof value !== "object" || value === null || Array.isArray(value))) return false;
  if (schema.type === "array" && !Array.isArray(value)) return false;
  if (schema.type === "string" && typeof value !== "string") return false;
  if (schema.pattern !== undefined && typeof value === "string" && !new RegExp(schema.pattern, "u").test(value)) return false;
  if (schema.items !== undefined && Array.isArray(value) && !value.every((item) => valid(schema.items!, item))) return false;
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      const property = schema.properties?.[key];
      if (property === undefined) {
        if (schema.additionalProperties === false) return false;
      } else if (!valid(property, item)) return false;
    }
  }
  return true;
}

describe("the JSON Schema", () => {
  test("is draft 2020-12", () => {
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  const examples: [string, unknown][] = [
    ["empty", {}],
    ["full", { $schema: "https://example.com/s.json", attributeKeys: ["status", "Owner_2", "a-b"] }],
    ["empty list", { attributeKeys: [] }],
    ["only $schema", { $schema: "x" }],
    ["a list", []],
    ["a string", "x"],
    ["null", null],
    ["a number", 1],
    ["unknown key", { attributeKeys: [], other: 1 }],
    ["$schema number", { $schema: 1 }],
    ["attributeKeys string", { attributeKeys: "a" }],
    ["attributeKeys object", { attributeKeys: { a: 1 } }],
    ["a number key", { attributeKeys: [1] }],
    ["a digit first", { attributeKeys: ["1a"] }],
    ["an underscore first", { attributeKeys: ["_a"] }],
    ["a dot", { attributeKeys: ["a.b"] }],
    ["a space", { attributeKeys: ["a b"] }],
    ["an empty key", { attributeKeys: [""] }],
    ["a line end after the key", { attributeKeys: ["a\n"] }],
    ["a non-ASCII letter", { attributeKeys: ["ä"] }],
  ];

  test.each(examples)("the schema and the loader agree on: %s", (_, value) => {
    const loader = parseConfig(JSON.stringify(value), "c.json").ok;
    expect(valid(schema, value)).toBe(loader);
  });

  test("both accept and both refuse some examples", () => {
    const results = examples.map(([, value]) => parseConfig(JSON.stringify(value), "c.json").ok);
    expect(results).toContain(true);
    expect(results).toContain(false);
  });
});
