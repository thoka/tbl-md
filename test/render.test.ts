import { describe, expect, test } from "bun:test";
import { escapeLine, parse, render, renderBlock, shortKeys, unescapeLine, validate, type Column, type Table } from "../src/index.ts";

function table(text: string): Table {
  const result = parse(text);
  if (!result.ok) throw new Error(`unexpected errors: ${JSON.stringify(result.errors)}`);
  return result.table;
}

const lines = (...l: string[]) => l.join("\n");

describe("the example of docs/format.md", () => {
  test("with attributes renders in its canonical form", () => {
    const source = lines(
      "model: Model",
      "price: Price",
      "{align=right}",
      "note: Note",
      "--",
      "model: Opus",
      "price: $15",
      "note: Good for research.",
      "\\{this line is text, not an attribute line}",
      "-- {#a1b2c3d4 .new}",
      "m: Haiku",
      "p: $1",
      "{.cheap}",
    );
    const canonical = source.replace("model: Opus\nprice: $15\nnote: Good", "m: Opus\np: $15\nn: Good");
    expect(render(table(source))).toBe(canonical);
  });

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
      "m: Opus",
      "p: $15",
      "n: Good for research.",
      "Second line of the same cell.",
      "hint\\: this line is text, not a key.",
      "Note: a capital letter is never a key, so this line needs no escape.",
      "-- {#a1b2c3d4}",
      "m: Haiku",
      "p: $1",
    );
    expect(render(table(source))).toBe(canonical);
  });
});

describe("the canonical form", () => {
  test("short keys in header order, no empty lines, no empty cells", () => {
    const source = lines("", "a: A", "bb: B", "", "--", "", "bb: 2", "", "a: 1", "", "--", "a:", "", "bb: x", "");
    expect(render(table(source))).toBe(lines("a: A", "bb: B", "--", "a: 1", "b: 2", "--", "b: x"));
  });

  const headers: [string, string[], string[]][] = [
    ["model, price, note", ["model", "price", "note"], ["m", "p", "n"]],
    ["error, example", ["error", "example"], ["er", "ex"]],
    ["price, price-2", ["price", "price-2"], ["price", "price-"]],
    ["a, ab", ["a", "ab"], ["a", "ab"]],
  ];
  const columnsOf = (keys: string[]): Column[] => keys.map((key) => ({ key, title: key }));

  test.each(headers)("shortKeys: %s", (_, keys, short) => {
    expect(shortKeys(columnsOf(keys))).toEqual(Object.fromEntries(keys.map((k, i) => [k, short[i]!])));
  });

  test.each(headers)("parse resolves each short key to its column: %s", (_, keys) => {
    const columns = columnsOf(keys);
    const short = shortKeys(columns);
    const text = lines(...keys.map((k) => `${k}: ${k}`), "--", ...keys.map((k) => `${short[k]}: cell ${k}`));
    const cells = Object.fromEntries(keys.map((k) => [k, `cell ${k}`]));
    expect(parse(text)).toEqual({ ok: true, table: { columns, rows: [{ cells }] } });
    expect(render(table(text))).toBe(text);
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
    "attributes at each place": lines("a: A", "{#c .x align=left}", "b: B", "-- {#r .new k=v}", "a: 1", "{.c}", "b:", '{q="a \\"b\\" \\\\"}'),
    "a value that needs quotes and an empty value": lines("a: A", '{k="a.b" e=""}'),
    "escaped attribute lines": lines("a: A", "--", "a: x", "\\{.x}", "\\\\{}", "\\-- {.y}", "\\--\t{!}"),
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
        { attributes: { id: "id-1", classes: [], pairs: [] }, cells: { a: "\nab: no key\n--\n\\-- {#z}\nk\\\\: v", ab: "a: 1" } },
        { cells: {} },
        { cells: { ab: "```\n````" } },
      ],
    };
    expect(parse(render(t))).toEqual({ ok: true, table: t });
  });
});

describe("the canonical form of attributes", () => {
  test("a block in another form renders in the canonical form", () => {
    const source = lines("a: A", '{ k="v" .c #i }  ', "--\t{.r}", "a: 1", "", "", "{ .x}");
    expect(render(table(source))).toBe(lines("a: A", "{#i .c k=v}", "-- {.r}", "a: 1", "{.x}"));
  });

  test("the attribute line of a cell is its last line, after an escaped text line", () => {
    const t: Table = {
      columns: [{ key: "a", title: "A" }],
      rows: [{ cells: { a: "x\n{.y}\n-- {.z}" }, cellAttributes: { a: { classes: ["c"], pairs: [] } } }],
    };
    expect(render(t)).toBe(lines("a: A", "--", "a: x", "\\{.y}", "\\-- {.z}", "{.c}"));
    expect(parse(render(t))).toEqual({ ok: true, table: t });
  });

  test("a cell with attributes and no text has the key line `key:`", () => {
    const t: Table = {
      columns: [
        { key: "a", title: "A" },
        { key: "b", title: "B" },
      ],
      rows: [{ cells: { b: "y" }, cellAttributes: { a: { id: "x", classes: [], pairs: [] } } }],
    };
    expect(render(t)).toBe(lines("a: A", "b: B", "--", "a:", "{#x}", "b: y"));
    expect(parse(render(t))).toStrictEqual({ ok: true, table: t });
  });

  test("an empty cell text with attributes renders as a cell with no text", () => {
    const t: Table = { columns: [{ key: "a", title: "A" }], rows: [{ cells: { a: "" }, cellAttributes: { a: { classes: ["x"], pairs: [] } } }] };
    expect(render(t)).toBe(lines("a: A", "--", "a:", "{.x}"));
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

  test("adds one backslash to the attribute form and the separator form with a block, also a block that does not parse", () => {
    expect(escapeLine("{.x}")).toBe("\\{.x}");
    expect(escapeLine("{} \t")).toBe("\\{} \t");
    expect(escapeLine("\\{.x}")).toBe("\\\\{.x}");
    expect(escapeLine("-- {.x}")).toBe("\\-- {.x}");
    expect(escapeLine("--\t{!}")).toBe("\\--\t{!}");
    expect(escapeLine("\\-- {#a.b}")).toBe("\\\\-- {#a.b}");
  });

  test("keeps a line of another form", () => {
    for (const line of ["K: x", "k:x", "-- foo", "--- ", "\\x", "\\-- foo", "-- ", " {.x}", "{.x", "x {.y}", ""]) expect(escapeLine(line)).toBe(line);
  });

  test("unescapeLine undoes it", () => {
    for (const line of ["k: x", "k\\\\: x", "--", "\\-- {#a}", "plain", "{.x}", "\\{.x} ", "-- {!}"]) expect(unescapeLine(escapeLine(line))).toBe(line);
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
      { columns: ok.columns, rows: [{ attributes: { id: "a.b", classes: [], pairs: [] }, cells: {} }] },
      'Row 1 has the ID "a.b". An ID must have the form [A-Za-z0-9_-]+.',
    ],
    [
      "an empty attribute block of a column",
      { columns: [{ key: "a", title: "A", attributes: { classes: [], pairs: [] } }], rows: [] },
      'Column 1 (key "a") has an empty attribute block. Give it an ID, a class, or a pair, or remove it.',
    ],
    [
      "a bad value of align at a column",
      { columns: [{ key: "a", title: "A", attributes: { classes: [], pairs: [{ key: "align", value: "middle" }] } }], rows: [] },
      'Column 1 (key "a"): The value "middle" of "align" is not valid. Use left, center, or right.',
    ],
    [
      "align at a row",
      { columns: ok.columns, rows: [{ attributes: { classes: [], pairs: [{ key: "align", value: "left" }] }, cells: {} }] },
      'Row 1: The key "align" is allowed only on a column, not on a row. Remove it, or write it in the attribute line of the column.',
    ],
    [
      "a repeated class of a cell",
      { columns: ok.columns, rows: [{ cells: {}, cellAttributes: { a: { classes: ["x", "x"], pairs: [] } } }] },
      'Row 1, cell "a" has the class "x" two times.',
    ],
    [
      "a value with a line break",
      { columns: ok.columns, rows: [{ cells: {}, cellAttributes: { a: { classes: [], pairs: [{ key: "k", value: "a\nb" }] } } }] },
      'Row 1, cell "a" has a value of "k" with a line break. A value has one line and no CR.',
    ],
    [
      "cell attributes with a key that no column has",
      { columns: ok.columns, rows: [{ cells: {}, cellAttributes: { b: { classes: ["x"], pairs: [] } } }] },
      'Row 1 has attributes for a cell with the key "b", but no column has this key.',
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
    const t: Table = { columns: [{ key: "A", title: "x\ny" }], rows: [{ attributes: { id: "", classes: [], pairs: [] }, cells: { a: "1" } }] };
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
