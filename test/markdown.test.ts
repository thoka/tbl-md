import { describe, expect, test } from "bun:test";
import { findTables, type Found } from "../src/index.ts";

/** The found tables with no mdast node, so that the tests compare plain data. */
const find = (source: string) => findTables(source).map(({ node, ...rest }) => rest);

const kinds = (source: string) => findTables(source).map((f) => f.kind);

describe("findTables: tbl blocks", () => {
  test("a block at top level", () => {
    const source = "# Title\n\n```tbl\na: A\n--\na: x\n```\n";
    expect(find(source)).toEqual([
      { kind: "tbl", start: 9, end: source.length - 1, line: 3, column: 1, contentLine: 4, text: "a: A\n--\na: x", meta: null },
    ]);
  });

  test("a block in a list item", () => {
    const source = "- item\n\n  ```tbl\n  a: A\n  ```\n";
    expect(find(source)).toEqual([
      { kind: "tbl", start: 10, end: source.length - 1, line: 3, column: 3, contentLine: 4, text: "a: A", meta: null },
    ]);
  });

  test("a block in a nested list", () => {
    const source = "- outer\n  - inner\n\n    ```tbl\n    a: A\n    ```\n";
    const [found] = find(source);
    expect(found).toMatchObject({ kind: "tbl", line: 4, column: 5, contentLine: 5, text: "a: A" });
  });

  test("a block in a block quote", () => {
    const source = "> ```tbl\n> a: A\n> ```\n";
    expect(find(source)).toEqual([
      { kind: "tbl", start: 2, end: source.length - 1, line: 1, column: 3, contentLine: 2, text: "a: A", meta: null },
    ]);
  });

  test("a tilde fence", () => {
    expect(find("~~~tbl\na: A\n~~~\n")).toMatchObject([{ kind: "tbl", text: "a: A" }]);
  });

  test("a fence of four backticks keeps a line of three backticks as content", () => {
    expect(find("````tbl\na: A\n```\n````\n")).toMatchObject([{ kind: "tbl", text: "a: A\n```" }]);
  });

  test("an unclosed fence runs to the end of the text", () => {
    const source = "```tbl\na: A\n";
    expect(find(source)).toMatchObject([{ kind: "tbl", text: "a: A", start: 0, end: source.length }]);
  });

  test("info text after tbl goes into meta", () => {
    expect(find("```tbl id=1\na: A\n```\n")).toMatchObject([{ kind: "tbl", meta: "id=1" }]);
  });

  test("spaces around tbl in the info string are not info text", () => {
    expect(find("```  tbl   \na: A\n```\n")).toMatchObject([{ kind: "tbl", meta: null }]);
  });

  test("the language is case-sensitive", () => {
    expect(kinds("```TBL\na: A\n```\n")).toEqual([]);
  });

  test("another language is no tbl block", () => {
    expect(kinds("```tbl-x\na: A\n```\n\n```tblx\na: A\n```\n\n```ts\nx\n```\n")).toEqual([]);
  });

  test("an indented code block is no tbl block", () => {
    expect(kinds("    ```tbl\n    a: A\n    ```\n")).toEqual([]);
  });

  test("a tbl block inside a markdown block is not found", () => {
    expect(kinds("````markdown\n```tbl\na: A\n```\n````\n")).toEqual([]);
  });

  test("a tbl block inside an HTML block is not found", () => {
    expect(kinds("<div>\n```tbl\na: A\n```\n</div>\n")).toEqual([]);
  });
});

describe("findTables: GFM tables", () => {
  test("a table at top level", () => {
    const source = "text\n\n| a | b |\n| - | - |\n| 1 | 2 |\n";
    expect(find(source)).toEqual([{ kind: "gfm", start: 6, end: source.length - 1, line: 3, column: 1 }]);
  });

  test("a table in a block quote", () => {
    expect(find("> | a |\n> | - |\n> | 1 |\n")).toMatchObject([{ kind: "gfm", line: 1, column: 3 }]);
  });

  test("a table inside a code block is not found", () => {
    expect(kinds("```\n| a |\n| - |\n```\n")).toEqual([]);
  });
});

describe("findTables: positions", () => {
  test("several tables come in document order", () => {
    const source = "| a |\n| - |\n\n```tbl\na: A\n```\n\n- x\n\n  | b |\n  | - |\n";
    expect(find(source).map((f) => [f.kind, f.line])).toEqual([
      ["gfm", 1],
      ["tbl", 4],
      ["gfm", 10],
    ]);
  });

  test("the offsets slice the exact source of each node", () => {
    const source = "intro\n\n> ```tbl\n> a: A\n> ```\n\n| a |\n| - |\n| 1 |\n\ntail\n";
    const slices = findTables(source).map((f: Found) => source.slice(f.start, f.end));
    expect(slices).toEqual(["```tbl\n> a: A\n> ```", "| a |\n| - |\n| 1 |"]);
  });

  test("CRLF line ends give the right lines", () => {
    const source = "a\r\n\r\n```tbl\r\nk: K\r\n```\r\n\r\n| a |\r\n| - |\r\n";
    expect(find(source).map((f) => [f.kind, f.line])).toEqual([
      ["tbl", 3],
      ["gfm", 7],
    ]);
  });

  test("lone CR line ends give the right lines", () => {
    const source = "a\r\r```tbl\rk: K\r```\r\r| a |\r| - |\r";
    expect(find(source).map((f) => [f.kind, f.line])).toEqual([
      ["tbl", 3],
      ["gfm", 7],
    ]);
  });
});
