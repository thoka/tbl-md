import { describe, expect, test } from "bun:test";
import { lint } from "../src/index.ts";

/** The problems as [line, column, code], so that the tests stay short. */
const where = (source: string) => lint(source).map((p) => [p.line, p.column, p.code]);

describe("lint", () => {
  test("a valid file gives no problems", () => {
    const source = "# Title\n\n```tbl\nmodel: Model\n--\nm: Opus\n```\n\n- list\n\n  ```tbl\n  a: A\n  ```\n";
    expect(lint(source)).toEqual([]);
  });

  test("a file with no tables gives no problems", () => {
    expect(lint("# Title\n\nText.\n")).toEqual([]);
  });

  test("a GFM table gives gfm-table at its start", () => {
    const problems = lint("text\n\n| a |\n| - |\n| 1 |\n");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ line: 3, column: 1, code: "gfm-table" });
    expect(problems[0]!.message).toContain("tbl block");
  });

  test("a GFM table in a block quote", () => {
    expect(where("> | a |\n> | - |\n")).toEqual([[1, 3, "gfm-table"]]);
  });

  test("a GFM table inside a code block gives no problem", () => {
    expect(lint("```\n| a |\n| - |\n```\n")).toEqual([]);
  });

  test("an error maps to its file line", () => {
    const source = "intro\n\n```tbl\na: A\n--\nz: x\n```\n";
    const problems = lint(source);
    expect(problems).toMatchObject([{ line: 6, column: 1, code: "unknown-key" }]);
    expect(problems[0]!.message).toContain('"z"');
  });

  test("an empty block gives no-header at the first line inside the fence", () => {
    expect(where("text\n\n```tbl\n```\n")).toEqual([[4, 1, "no-header"]]);
  });

  test("an unclosed fence is read to the end of the text", () => {
    expect(where("```tbl\na: A\n--\nb: x\n")).toEqual([[4, 1, "unknown-key"]]);
  });

  test("an error in a list item has the column of the fence", () => {
    expect(where("- item\n\n  ```tbl\n  a: A\n  --\n  b: x\n  ```\n")).toEqual([[6, 3, "unknown-key"]]);
  });

  test("an error in a nested list", () => {
    expect(where("- outer\n  - inner\n\n    ```tbl\n    not a key\n    ```\n")).toEqual([[5, 5, "header-not-key"]]);
  });

  test("an error in a block quote", () => {
    expect(where("> ```tbl\n> a: A\n> a: B\n> ```\n")).toEqual([[3, 3, "header-duplicate-key"]]);
  });

  test("a tilde fence is linted", () => {
    expect(where("~~~tbl\n--\n~~~\n")).toEqual([[2, 1, "no-header"]]);
  });

  test("info text after tbl gives info-text at the fence line", () => {
    const problems = lint("text\n\n```tbl id=1\na: A\n```\n");
    expect(problems).toMatchObject([{ line: 3, column: 1, code: "info-text" }]);
    expect(problems[0]!.message).toContain("id=1");
  });

  test("info text and a parse error both count", () => {
    expect(where("```tbl x\n--\n```\n")).toEqual([
      [1, 1, "info-text"],
      [2, 1, "no-header"],
    ]);
  });

  test("other code blocks are not linted", () => {
    const source = "```tbl-x\n--\n```\n\n````markdown\n```tbl\n--\n```\n````\n\n    ```tbl\n    --\n";
    expect(lint(source)).toEqual([]);
  });

  test("CRLF line ends give the right lines", () => {
    expect(where("a\r\n\r\n```tbl\r\na: A\r\n--\r\nb: x\r\n```\r\n")).toEqual([[6, 1, "unknown-key"]]);
  });

  test("lone CR line ends give the right lines", () => {
    expect(where("a\r\r```tbl\ra: A\r--\rb: x\r```\r")).toEqual([[6, 1, "unknown-key"]]);
  });

  test("several tables and errors are sorted by line", () => {
    const source = [
      "| a |", // 1
      "| - |", // 2
      "", // 3
      "```tbl", // 4
      "a: A", // 5
      "ab: B", // 6
      "--", // 7
      "x: 1", // 8
      "a: 2", // 9
      "--", // 10
      "lost", // 11
      "```", // 12
      "", // 13
      "> ```tbl extra", // 14
      "> k: K", // 15
      "> ```", // 16
      "", // 17
      "| b |", // 18
      "| - |", // 19
      "",
    ].join("\n");
    expect(where(source)).toEqual([
      [1, 1, "gfm-table"],
      [8, 1, "unknown-key"],
      [11, 1, "orphan-line"],
      [14, 3, "info-text"],
      [18, 1, "gfm-table"],
    ]);
  });
});
