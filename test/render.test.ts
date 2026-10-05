import { describe, expect, test } from "bun:test";
import { escapeLine, parse, render, renderBlock, unescapeLine, validate, type Table } from "../src/index.ts";

function table(text: string): Table {
  const result = parse(text);
  if (!result.ok) throw new Error(`unexpected errors: ${JSON.stringify(result.errors)}`);
  return result.table;
}

const lines = (...l: string[]) => l.join("\n");

describe("the example of docs/format.md", () => {
  test("renders in its canonical form", () => {
    const source = lines(
      "model: Model",
      "price: Price",
      "note: Note",
      "--",
      "model: Opus",
      "price: $15",
      "note: Good for research.",
      "Second line of the same cell.",
      "hint\\: this line is text, not a key.",
      "Note: a capital letter is never a key, so this line needs no escape.",
      "-- {#a1b2c3d4}",
      "m: Haiku",
      "p: $1",
    );
    const canonical = lines(
      "model: Model",
      "price: Price",
      "note: Note",
      "--",
      "model: Opus",
      "price: $15",
      "note: Good for research.",
      "Second line of the same cell.",
      "hint\\: this line is text, not a key.",
      "Note: a capital letter is never a key, so this line needs no escape.",
      "-- {#a1b2c3d4}",
      "model: Haiku",
      "price: $1",
    );
    expect(render(table(source))).toBe(canonical);
  });
});

describe("the canonical form", () => {
  test("full keys in header order, no empty lines, no empty cells", () => {
    const source = lines("", "a: A", "bb: B", "", "--", "", "b: 2", "", "a: 1", "", "--", "a:", "", "b: x", "");
    expect(render(table(source))).toBe(lines("a: A", "bb: B", "--", "a: 1", "bb: 2", "--", "bb: x"));
  });

  test("an empty cell text gives no line", () => {
    expect(render({ columns: [{ key: "a", title: "A" }], rows: [{ cells: { a: "" } }] })).toBe(lines("a: A", "--"));
  });

  const canonical: Record<string, string> = {
    "an escape with one backslash": lines("a: A", "--", "a: x", "hint\\: y", "a\\:", "\\--", "\\-- {#x}"),
    "an escape with several backslashes": lines("a: A", "--", "a: x", "hint\\\\: y", "k\\\\\\:", "\\\\--", "\\\\\\-- {#x}"),
    "lines of other forms keep their backslashes": lines("a: A", "--", "a: x", "\\x", "Hint\\: y", "\\-- foo", "-- foo", "--x"),
    "an empty first line": lines("a: A", "--", "a:", "second"),
    "an empty first line and an empty line inside": lines("a: A", "--", "a:", "", "third"),
    "an empty title": lines("a:", "b: B", "--", "a: 1"),
    "a title with spaces": lines("a:   A  ", "--", "a:  x "),
    "a row with no cells": lines("a: A", "--", "--", "a: 1", "--"),
    "IDs": lines("a: A", "-- {#r1}", "a: 1", "-- {#X_y-2}", "--"),
    "a header with no rows": "a: A",
    "leading spaces and lines of only spaces": lines("a: A", "--", "a: x", "  y", "   ", "z"),
    "backtick lines": lines("a: A", "--", "a: ```", "````", "   `````  "),
  };
  for (const [name, text] of Object.entries(canonical)) {
    test(`render(parse(t)) is t: ${name}`, () => {
      expect(render(table(text))).toBe(text);
    });
  }

  test("parse(render(T)) is T", () => {
    const t: Table = {
      columns: [
        { key: "a", title: "" },
        { key: "ab", title: " x " },
      ],
      rows: [
        { id: "id-1", cells: { a: "\nab: no key\n--\n\\-- {#z}\nk\\\\: v", ab: "a: 1" } },
        { cells: {} },
        { cells: { ab: "```\n````" } },
      ],
    };
    expect(parse(render(t))).toEqual({ ok: true, table: t });
  });
});

describe("escapeLine", () => {
  test("adds one backslash to the key form and the separator form", () => {
    expect(escapeLine("k: x")).toBe("k\\: x");
    expect(escapeLine("k:")).toBe("k\\:");
    expect(escapeLine("k\\: x")).toBe("k\\\\: x");
    expect(escapeLine("--")).toBe("\\--");
    expect(escapeLine("-- {#a}")).toBe("\\-- {#a}");
    expect(escapeLine("\\\\--")).toBe("\\\\\\--");
  });

  test("keeps a line of another form", () => {
    for (const line of ["K: x", "k:x", "-- foo", "--- ", "\\x", "\\-- {#a.b}", ""]) expect(escapeLine(line)).toBe(line);
  });

  test("unescapeLine undoes it", () => {
    for (const line of ["k: x", "k\\\\: x", "--", "\\-- {#a}", "plain"]) expect(unescapeLine(escapeLine(line))).toBe(line);
  });
});

describe("renderBlock", () => {
  const one = (text: string): Table => ({ columns: [{ key: "a", title: "A" }], rows: [{ cells: { a: text } }] });

  test("writes a fence of three backticks with the info string tbl", () => {
    expect(renderBlock(one("x"))).toBe(lines("```tbl", "a: A", "--", "a: x", "```"));
  });

  test("a code span or a short run needs no longer fence", () => {
    expect(renderBlock(one("`x` and ```y```\n``")).startsWith("```tbl\n")).toBe(true);
  });

  test("a line that CommonMark reads as a closing fence gets a longer fence", () => {
    expect(renderBlock(one("x\n```"))).toBe(lines("````tbl", "a: A", "--", "a: x", "```", "````"));
    expect(renderBlock(one("x\n   `````  \t\n```"))).toStartWith("``````tbl\n");
    expect(renderBlock(one("x\n```")).endsWith("\n````")).toBe(true);
  });

  test("a line with four spaces of indent closes no fence", () => {
    expect(renderBlock(one("x\n    ````"))).toStartWith("```tbl\n");
  });

  test("a backtick line in the first line of a cell closes no fence", () => {
    expect(renderBlock(one("````"))).toStartWith("```tbl\n");
  });
});

describe("validate and the errors of render", () => {
  const ok: Table = { columns: [{ key: "a", title: "A" }], rows: [] };
  const cases: [string, Table, string][] = [
    ["no columns", { columns: [], rows: [] }, "The table has no columns. A table needs one column at least."],
    [
      "an invalid column key",
      { columns: [ok.columns[0]!, { key: "B", title: "" }], rows: [] },
      'Column 2 has the key "B". A key must have the form [a-z0-9_-]+.',
    ],
    [
      "a duplicate column key",
      { columns: [ok.columns[0]!, { key: "a", title: "" }], rows: [] },
      'Column 2 has the key "a", and an earlier column has it too.',
    ],
    [
      "a title with a line break",
      { columns: [{ key: "a", title: "x\ny" }], rows: [] },
      'Column 1 (key "a") has a title with a line break. A title has one line and no CR.',
    ],
    [
      "a title with a CR",
      { columns: [{ key: "a", title: "x\ry" }], rows: [] },
      'Column 1 (key "a") has a title with a line break. A title has one line and no CR.',
    ],
    [
      "a cell key that is no column key",
      { columns: ok.columns, rows: [{ cells: {} }, { cells: { b: "x" } }] },
      'Row 2 has a cell with the key "b", but no column has this key.',
    ],
    [
      "an invalid row ID",
      { columns: ok.columns, rows: [{ id: "a.b", cells: {} }] },
      'Row 1 has the ID "a.b". An ID must have the form [A-Za-z0-9_-]+.',
    ],
    [
      "a cell that ends with a line break",
      { columns: ok.columns, rows: [{ cells: { a: "x\n" } }] },
      'Row 1 has a cell "a" that ends with a line break. A cell never ends with an empty line.',
    ],
    [
      "a cell with a CR",
      { columns: ok.columns, rows: [{ cells: { a: "x\ry" } }] },
      'Row 1 has a cell "a" with a CR character. A CR is a line end, so a cell holds no CR.',
    ],
  ];
  for (const [name, t, message] of cases) {
    test(name, () => {
      expect(validate(t)).toEqual([message]);
      expect(() => render(t)).toThrow(message);
      expect(() => renderBlock(t)).toThrow(message);
    });
  }

  test("a valid table has no problems", () => {
    expect(validate(ok)).toEqual([]);
  });

  test("validate lists all problems, and render throws the first one", () => {
    const t: Table = { columns: [{ key: "A", title: "x\ny" }], rows: [{ id: "", cells: { a: "1" } }] };
    expect(validate(t)).toHaveLength(4);
    expect(() => render(t)).toThrow('Column 1 has the key "A".');
  });
});

describe("rule 12: line ends", () => {
  test("LF, CRLF, and CR give the same table, and render writes LF", () => {
    const lf = lines("a: A", "b:", "--", "a: 1", "", "two", "-- {#r}", "b: 2", "--");
    const crlf = lf.replaceAll("\n", "\r\n");
    const cr = lf.replaceAll("\n", "\r");
    expect(parse(crlf)).toEqual(parse(lf));
    expect(parse(cr)).toEqual(parse(lf));
    expect(render(table(cr))).toBe(lf);
  });
});
