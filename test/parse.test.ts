import { describe, expect, test } from "bun:test";
import { locate, parse, unescapeLine, type Table, type TblError, type TblErrorCode } from "../src/index.ts";

function table(text: string): Table {
  const result = parse(text);
  if (!result.ok) throw new Error(`unexpected errors: ${JSON.stringify(result.errors)}`);
  return result.table;
}

function errors(text: string): TblError[] {
  const result = parse(text);
  if (result.ok) throw new Error("expected errors, got a table");
  return result.errors;
}

const lines = (...l: string[]) => l.join("\n");
const header = lines("model: Model", "price: Price", "note: Note");

const ids = (id: string) => ({ id, classes: [], pairs: [] });

describe("the example of docs/format.md", () => {
  test("gives the expected table", () => {
    const text = lines(
      "model: Model",
      "price: Price",
      "{align=right}",
      "note: Note",
      "--",
      "model: Opus",
      "price: $15",
      "note: Good for research.",
      "Second line of the same cell.",
      "hint\\: this line is text, not a key.",
      "Note: a capital letter is never a key, so this line needs no escape.",
      "\\{this line is text, not an attribute line}",
      "-- {#a1b2c3d4 .new}",
      "m: Haiku",
      "p: $1",
      "{.cheap}",
    );
    expect(parse(text)).toStrictEqual({
      ok: true,
      table: {
        columns: [
          { key: "model", title: "Model" },
          { key: "price", title: "Price", attributes: { classes: [], pairs: [{ key: "align", value: "right" }] } },
          { key: "note", title: "Note" },
        ],
        rows: [
          {
            cells: {
              model: "Opus",
              price: "$15",
              note: [
                "Good for research.",
                "Second line of the same cell.",
                "hint: this line is text, not a key.",
                "Note: a capital letter is never a key, so this line needs no escape.",
                "{this line is text, not an attribute line}",
              ].join("\n"),
            },
          },
          {
            attributes: { id: "a1b2c3d4", classes: ["new"], pairs: [] },
            cells: { model: "Haiku", price: "$1" },
            cellAttributes: { price: { classes: ["cheap"], pairs: [] } },
          },
        ],
      },
    });
  });

  test("a 0.1 table with no row ID gives the same objects as in 0.1", () => {
    expect(parse(lines("a: A", "--", "a: 1"))).toStrictEqual({
      ok: true,
      table: { columns: [{ key: "a", title: "A" }], rows: [{ cells: { a: "1" } }] },
    });
  });
});

describe("rule 2: the header", () => {
  test("gives the columns in header order", () => {
    expect(table(lines("b: Bee", "a: A")).columns).toEqual([
      { key: "b", title: "Bee" },
      { key: "a", title: "A" },
    ]);
  });

  test("a title can be empty", () => {
    expect(table(lines("a:", "b: B")).columns).toEqual([
      { key: "a", title: "" },
      { key: "b", title: "B" },
    ]);
  });

  test("a header with zero data rows is valid", () => {
    expect(table("a: A")).toEqual({ columns: [{ key: "a", title: "A" }], rows: [] });
  });

  test("two equal keys are header-duplicate-key", () => {
    expect(errors(lines("a: A", "a: Again"))).toEqual([
      { line: 2, column: 1, code: "header-duplicate-key", message: 'The header has the key "a" two times.' },
    ]);
  });

  test("a line that is no key line is header-not-key", () => {
    const e = errors(lines("a: A", "Title", "b: B"));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ line: 2, column: 1, code: "header-not-key" });
  });

  test("an empty line followed by a key line is header-not-key", () => {
    const e = errors(lines("a: A", "", "b: B"));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ line: 2, code: "header-not-key" });
  });

  test("an escaped line is header-not-key", () => {
    expect(errors(lines("a: A", "b\\: B"))[0]).toMatchObject({ line: 2, code: "header-not-key" });
  });
});

describe("rule 3: keys and key lines", () => {
  test("keys are case-sensitive, so `Note: x` is text", () => {
    expect(table(lines("note: Note", "--", "note: a", "Note: x")).rows[0]!.cells).toEqual({ note: "a\nNote: x" });
  });

  test("`https://example.com` is no key line", () => {
    expect(table(lines("u: URL", "--", "u: link", "https://example.com")).rows[0]!.cells).toEqual({
      u: "link\nhttps://example.com",
    });
  });

  test("the text starts after the colon and one space, and more spaces are content", () => {
    expect(table(lines("a: A", "--", "a:   x")).rows[0]!.cells).toEqual({ a: "  x" });
  });

  test("`key:` alone is an empty first line", () => {
    expect(table(lines("a: A", "--", "a:", "x")).rows[0]!.cells).toEqual({ a: "\nx" });
  });

  test("trailing spaces are kept", () => {
    expect(table(lines("a: A  ", "--", "a: x  ", "y "))).toEqual({
      columns: [{ key: "a", title: "A  " }],
      rows: [{ cells: { a: "x  \ny " } }],
    });
  });

  test("keys can have digits, `_`, and `-`", () => {
    expect(table(lines("a_1-b: X", "--", "a_1-b: y")).rows[0]!.cells).toEqual({ "a_1-b": "y" });
  });
});

describe("rule 4: separators and IDs", () => {
  test("`--` starts a record, and an ID marker gives the row ID", () => {
    expect(table(lines("a: A", "--", "a: 1", "-- {#x_Y-9}", "a: 2")).rows).toEqual([
      { cells: { a: "1" } },
      { attributes: ids("x_Y-9"), cells: { a: "2" } },
    ]);
  });

  test("`-- foo` is text", () => {
    expect(table(lines("a: A", "--", "a: 1", "-- foo")).rows).toEqual([{ cells: { a: "1\n-- foo" } }]);
  });

  test("`--- `, `--x`, and `-- ` with no block are text", () => {
    expect(table(lines("a: A", "--", "a: 1", "--- ", "--x", "-- ")).rows).toEqual([{ cells: { a: "1\n--- \n--x\n-- " } }]);
  });
});

describe("rule 5: prefix keys", () => {
  test("a unique prefix resolves to the full key", () => {
    expect(table(lines(header, "--", "m: Opus", "pr: $15", "n: ok")).rows[0]!.cells).toEqual({
      model: "Opus",
      price: "$15",
      note: "ok",
    });
  });

  test("an exact key wins over a longer key with the same prefix", () => {
    expect(table(lines("a: A", "ab: AB", "--", "a: 1", "ab: 2")).rows[0]!.cells).toEqual({ a: "1", ab: "2" });
  });

  test("an ambiguous prefix is ambiguous-key and lists the keys", () => {
    expect(errors(lines("ab: AB", "ac: AC", "--", "a: 1"))).toEqual([
      { line: 4, column: 1, code: "ambiguous-key", message: 'The key "a" is a prefix of more than one header key: ab, ac.' },
    ]);
  });

  test("a key that matches no header key is unknown-key and lists the header keys", () => {
    expect(errors(lines(header, "--", "cost: 1"))).toEqual([
      {
        line: 5,
        column: 1,
        code: "unknown-key",
        message: 'The key "cost" matches no header key. The header keys are: model, price, note.',
      },
    ]);
  });
});

describe("rule 6: continuation lines", () => {
  test("leading spaces and empty lines inside a cell are content", () => {
    expect(table(lines("a: A", "b: B", "--", "a: 1", "", "  indented", "b: 2")).rows[0]!.cells).toEqual({
      a: "1\n\n  indented",
      b: "2",
    });
  });

  test("a line before the first key of a record is orphan-line", () => {
    expect(errors(lines("a: A", "--", "text", "a: 1"))).toEqual([
      {
        line: 3,
        column: 1,
        code: "orphan-line",
        message: "This line comes before the first key of the record, so it belongs to no cell.",
      },
    ]);
  });
});

describe("rule 7: empty lines that are not content", () => {
  test("at the block start, after `--`, before `--`, before a key line, and at the block end", () => {
    const text = lines("", "", "a: A", "b: B", "", "--", "", "a: 1", "", "", "b: 2", "", "--", "", "a: 3", "", "");
    expect(table(text)).toEqual({
      columns: [
        { key: "a", title: "A" },
        { key: "b", title: "B" },
      ],
      rows: [{ cells: { a: "1", b: "2" } }, { cells: { a: "3" } }],
    });
  });

  test("a trailing newline of the block text is not content", () => {
    expect(table("a: A\n--\na: 1\n").rows).toEqual([{ cells: { a: "1" } }]);
  });
});

describe("rule 8: missing keys and order", () => {
  test("keys can come in any order, and a missing key is an empty cell", () => {
    expect(table(lines(header, "--", "n: last", "m: first")).rows[0]!.cells).toEqual({ note: "last", model: "first" });
  });

  test("a cell with only an empty text counts as missing", () => {
    expect(table(lines("a: A", "b: B", "--", "a:", "", "b: 2")).rows[0]!.cells).toEqual({ b: "2" });
  });

  test("a record with no cells is a row of empty cells", () => {
    expect(table(lines("a: A", "--", "--", "a: 1")).rows).toEqual([{ cells: {} }, { cells: { a: "1" } }]);
  });

  test("a duplicate key is duplicate-key, also after the prefix resolution", () => {
    expect(errors(lines(header, "--", "m: a", "model: b"))).toEqual([
      { line: 6, column: 1, code: "duplicate-key", message: 'The record has the key "model" more than one time.' },
    ]);
  });
});

describe("rule 9: errors", () => {
  test("an empty block is no-header at line 1", () => {
    expect(errors("")).toEqual([
      {
        line: 1,
        column: 1,
        code: "no-header",
        message: "The block has no header. The first record must map each key to a title, for example `key: Title`.",
      },
    ]);
  });

  test("a block that starts with `--` is no-header at line 1", () => {
    expect(errors(lines("--", "a: 1"))).toEqual([expect.objectContaining({ line: 1, code: "no-header" })]);
  });

  test("the parser collects all errors with their lines", () => {
    const text = lines("a: A", "a: B", "x", "--", "orphan", "z: 1", "a: 2", "a: 3");
    expect(errors(text).map((e) => [e.line, e.column, e.code])).toEqual([
      [2, 1, "header-duplicate-key"],
      [3, 1, "header-not-key"],
      [5, 1, "orphan-line"],
      [6, 1, "unknown-key"],
      [8, 1, "duplicate-key"],
    ]);
  });
});

describe("rule 10: escapes", () => {
  test("one backslash goes from the key form", () => {
    expect(table(lines("a: A", "--", "a: x", "hint\\: y", "hint\\:")).rows[0]!.cells).toEqual({
      a: "x\nhint: y\nhint:",
    });
  });

  test("multiple backslashes lose exactly one", () => {
    expect(table(lines("a: A", "--", "a: x", "hint\\\\: x", "\\\\--", "\\-- {#id}")).rows[0]!.cells).toEqual({
      a: "x\nhint\\: x\n\\--\n-- {#id}",
    });
  });

  test("a line of another form keeps each backslash", () => {
    expect(table(lines("a: A", "--", "a: x", "\\x", "Hint\\: y", "\\-- foo")).rows[0]!.cells).toEqual({
      a: "x\n\\x\nHint\\: y\n\\-- foo",
    });
  });

  test("an escaped line before the first key of a record is orphan-line", () => {
    expect(errors(lines("a: A", "--", "hint\\: x"))).toEqual([expect.objectContaining({ line: 3, code: "orphan-line" })]);
  });

  test("unescapeLine removes one backslash only from the escaped forms", () => {
    expect(unescapeLine("k\\\\\\: x")).toBe("k\\\\: x");
    expect(unescapeLine("\\--")).toBe("--");
    expect(unescapeLine("k: x")).toBe("k: x");
    expect(unescapeLine("\\- x")).toBe("\\- x");
  });
});

describe("rule 12: line ends", () => {
  test("CRLF gives the same table as LF", () => {
    const lf = lines("a: A", "b: B", "--", "a: 1", "two", "-- {#r}", "b: 2", "");
    expect(parse(lf.replaceAll("\n", "\r\n"))).toEqual(parse(lf));
  });

  test("a lone CR is a line end, as in CommonMark", () => {
    const lf = lines("a: A", "b: B", "--", "a: 1", "two", "-- {#r}", "b: 2", "");
    expect(parse(lf.replaceAll("\n", "\r"))).toEqual(parse(lf));
  });

  test("a mix of LF, CRLF, and CR works", () => {
    expect(table("a: A\r--\na: 1\r\nx\ry").rows).toEqual([{ cells: { a: "1\nx\ny" } }]);
  });

  test("a mix of LF and CRLF works", () => {
    expect(table("a: A\r\n--\na: 1\r\nx").rows).toEqual([{ cells: { a: "1\nx" } }]);
  });
});

describe("details beyond docs/format.md", () => {
  test("a line of only spaces is no empty line, so it is content", () => {
    expect(table(lines("a: A", "--", "a: 1", "  ")).rows[0]!.cells).toEqual({ a: "1\n  " });
  });

  test("a header of only text lines is header-not-key, not no-header", () => {
    expect(errors(lines("text", "--", "a: 1")).map((e) => [e.line, e.code])).toEqual([[1, "header-not-key"]]);
  });
});

describe("rule 13: the places of attributes", () => {
  const x = { classes: ["x"], pairs: [] };

  test("a line in the attribute form directly after a header key line describes that column", () => {
    expect(table(lines("a: A", "{#c1 .x k=v}", "b: B", "{align=center}")).columns).toEqual([
      { key: "a", title: "A", attributes: { id: "c1", classes: ["x"], pairs: [{ key: "k", value: "v" }] } },
      { key: "b", title: "B", attributes: { classes: [], pairs: [{ key: "align", value: "center" }] } },
    ]);
  });

  test("spaces and tabs after the `}` are not part of the block", () => {
    expect(table(lines("a: A", "{.x} \t", "--", "a: 1", "{.x}  ")).rows[0]!.cellAttributes).toEqual({ a: x });
    expect(table(lines("a: A", "{.x} \t")).columns[0]!.attributes).toEqual(x);
  });

  test("the `--` line takes the block of the row after spaces or tabs", () => {
    expect(table(lines("a: A", "-- {#a1 .new}", "--\t {.x}\t", "--")).rows).toStrictEqual([
      { attributes: { id: "a1", classes: ["new"], pairs: [] }, cells: {} },
      { attributes: x, cells: {} },
      { cells: {} },
    ]);
  });

  test("a line in the attribute form as the last line of a cell describes the cell", () => {
    expect(table(lines("a: A", "b: B", "--", "a: 1", "two", "{.x}", "b: 2")).rows).toStrictEqual([
      { cells: { a: "1\ntwo", b: "2" }, cellAttributes: { a: x } },
    ]);
  });

  test("the attribute line of the last cell of a record and of the block", () => {
    expect(table(lines("a: A", "--", "a: 1", "{.x}", "", "--", "a: 2", "{.y}", "")).rows).toEqual([
      { cells: { a: "1" }, cellAttributes: { a: x } },
      { cells: { a: "2" }, cellAttributes: { a: { classes: ["y"], pairs: [] } } },
    ]);
  });

  test("empty lines before the attribute line of a cell are not content (rule 7)", () => {
    expect(table(lines("a: A", "--", "a: 1", "", "two", "", "", "{.x}", "")).rows).toEqual([
      { cells: { a: "1\n\ntwo" }, cellAttributes: { a: x } },
    ]);
  });

  test("a cell can have attributes and no text", () => {
    expect(table(lines("a: A", "b: B", "--", "a:", "{.x}", "b: 2")).rows).toStrictEqual([{ cells: { b: "2" }, cellAttributes: { a: x } }]);
    expect(table(lines("a: A", "--", "a:", "", "{.x}")).rows).toStrictEqual([{ cells: {}, cellAttributes: { a: x } }]);
  });

  test("a cell with a prefix key gets its attributes by the full key", () => {
    expect(table(lines("model: M", "--", "m: x", "{.x}")).rows[0]!.cellAttributes).toEqual({ model: x });
  });

  test("an attribute block on a key line is text", () => {
    expect(table(lines("price: P", "--", "price: $15 {.x}", "p2 {.y}")).rows).toStrictEqual([{ cells: { price: "$15 {.x}\np2 {.y}" } }]);
    expect(table(lines("price: {.x}", "--", "price: {.y}"))).toStrictEqual({
      columns: [{ key: "price", title: "{.x}" }],
      rows: [{ cells: { price: "{.y}" } }],
    });
  });

  test("a line that is not in the attribute form is text", () => {
    expect(table(lines("a: A", "--", "a: 1", " {.x}", "{.x", ".x}", "{.x} y", "x {.y}")).rows[0]!.cells).toEqual({
      a: "1\n {.x}\n{.x\n.x}\n{.x} y\nx {.y}",
    });
  });
});

describe("rule 10: the escape of the attribute form and the separator form with a block", () => {
  test("one backslash goes from each escaped form", () => {
    expect(table(lines("a: A", "--", "a: x", "\\{.x}", "\\\\{.x} ", "\\{}", "\\-- {.x}", "\\--\t{!}", "\\\\-- {#a}")).rows[0]!.cells).toEqual({
      a: "x\n{.x}\n\\{.x} \n{}\n-- {.x}\n--\t{!}\n\\-- {#a}",
    });
  });

  test("an escaped attribute line in the header is header-not-key", () => {
    expect(errors(lines("a: A", "\\{.x}"))).toEqual([expect.objectContaining({ line: 2, column: 1, code: "header-not-key" })]);
  });

  test("an escaped attribute line before the first key of a record is orphan-line", () => {
    expect(errors(lines("a: A", "--", "\\{.x}", "a: 1"))).toEqual([expect.objectContaining({ line: 3, code: "orphan-line" })]);
  });
});

describe("rule 16: the errors of the attributes", () => {
  // A grammar error of each code: the block, the code, and the 0-based offset of the first bad character.
  const grammar: [string, TblErrorCode, number][] = [
    ["{.hl !}", "attr-unexpected-char", 5],
    ["{#a.b}", "attr-no-space", 3],
    ["{}", "attr-empty", 1],
    ["{#a:b}", "attr-bad-id", 3],
    ["{.1a}", "attr-bad-class", 2],
    ["{1k=v}", "attr-bad-key", 1],
    ["{#a #b}", "attr-duplicate-id", 4],
    ["{.a .a}", "attr-duplicate-class", 4],
    ["{k=1 k=2}", "attr-duplicate-key", 5],
    ["{id=x}", "attr-reserved-key", 1],
    ["{k}", "attr-no-value", 2],
    ["{k=a.b}", "attr-bad-bare-value", 4],
    ["{k='a'}", "attr-single-quotes", 3],
    ['{k="a}', "attr-unclosed-quote", 3],
    ['{k="a\\b"}', "attr-bad-escape", 5],
  ];
  for (const [block, code, offset] of grammar) {
    test(`${code} in a column line, a cell line, and a separator line, with its line and column`, () => {
      expect(errors(lines("a: A", block)).map((e) => [e.line, e.column, e.code])).toEqual([[2, offset + 1, code]]);
      expect(errors(lines("a: A", "--", "a: x", block)).map((e) => [e.line, e.column, e.code])).toEqual([[4, offset + 1, code]]);
      expect(errors(lines("a: A", "-- " + block, "a: x")).map((e) => [e.line, e.column, e.code])).toEqual([[2, offset + 4, code]]);
      expect(errors(lines("a: A", "--\t \t" + block + " ", "a: x")).map((e) => [e.line, e.column, e.code])).toEqual([[2, offset + 6, code]]);
    });
  }

  test("a grammar error has the message of parseAttributes", () => {
    expect(errors(lines("a: A", "-- {.x !}"))).toEqual([
      {
        line: 2,
        column: 8,
        code: "attr-unexpected-char",
        message: 'The attribute block has the unexpected character "!". A part is an ID (#id), a class (.class), or a pair (key=value).',
      },
    ]);
  });

  test("a bad value of align in a column line is attr-bad-value at the value", () => {
    expect(errors(lines("a: A", "{.x align=middle}"))).toEqual([
      { line: 2, column: 11, code: "attr-bad-value", message: 'The value "middle" of "align" is not valid. Use left, center, or right.' },
    ]);
  });

  test("align at a row or a cell is attr-key-place at the key", () => {
    expect(errors(lines("a: A", "-- {.x align=left}", "a: 1", "{align=right}")).map((e) => [e.line, e.column, e.code])).toEqual([
      [2, 8, "attr-key-place"],
      [4, 2, "attr-key-place"],
    ]);
    expect(errors(lines("a: A", "--", "a: 1", "{align=right}"))[0]!.message).toBe(
      'The key "align" is allowed only on a column, not on a cell. Remove it, or write it in the attribute line of the column.',
    );
  });

  test("a second attribute line of a column is attr-second-line, also a third one", () => {
    expect(errors(lines("a: A", "{.a}", "{.b}", "{.c}", "b: B"))).toEqual([
      {
        line: 3,
        column: 1,
        code: "attr-second-line",
        message: 'The column "a" has an attribute line already. A column has one attribute line at most, so merge the two blocks into one line.',
      },
      expect.objectContaining({ line: 4, column: 1, code: "attr-second-line" }),
    ]);
  });

  test("a second attribute line of a cell is attr-second-line, also after empty lines", () => {
    expect(errors(lines("a: A", "--", "a: 1", "{.a}", "", "{.b}", "{.c}"))).toEqual([
      {
        line: 6,
        column: 1,
        code: "attr-second-line",
        message: 'The cell "a" has an attribute line already. A cell has one attribute line at most, so merge the two blocks into one line.',
      },
      expect.objectContaining({ line: 7, code: "attr-second-line" }),
    ]);
  });

  test("a place error wins over a grammar error", () => {
    expect(errors(lines("{!}", "a: A", "{.a}", "{!}")).map((e) => [e.line, e.code])).toEqual([
      [1, "attr-misplaced"],
      [3 + 1, "attr-second-line"],
    ]);
    expect(errors(lines("a: A", "--", "{!}", "a: 1", "{!}", "x", "{.a}", "{!}")).map((e) => [e.line, e.code])).toEqual([
      [3, "attr-misplaced"],
      [5, "attr-misplaced"],
      [8, "attr-second-line"],
    ]);
  });

  test("an attribute line before the first header key is attr-misplaced, not header-not-key", () => {
    expect(errors(lines("{.x}", "a: A"))).toEqual([
      {
        line: 1,
        column: 1,
        code: "attr-misplaced",
        message:
          "This attribute line follows no header key line, so it describes no column. Put it directly after the key line of its column, with no empty line between them.",
      },
    ]);
  });

  test("a block of only attribute lines gives attr-misplaced, not no-header", () => {
    expect(errors("{.x}").map((e) => e.code)).toEqual(["attr-misplaced"]);
  });

  test("an attribute line after an empty line in the header is attr-misplaced", () => {
    expect(errors(lines("a: A", "", "{.x}", "b: B")).map((e) => [e.line, e.code])).toEqual([
      [2, "header-not-key"],
      [3, "attr-misplaced"],
    ]);
  });

  test("an attribute line after a text line of the header is attr-misplaced", () => {
    expect(errors(lines("a: A", "text", "{.x}")).map((e) => [e.line, e.code])).toEqual([
      [2, "header-not-key"],
      [3, "attr-misplaced"],
    ]);
  });

  test("an attribute line directly after `--` is attr-misplaced, not orphan-line", () => {
    expect(errors(lines("a: A", "--", "", "{.x}", "a: 1"))).toEqual([
      {
        line: 4,
        column: 1,
        code: "attr-misplaced",
        message:
          "This attribute line comes before the first key of the record, so it describes nothing. Write the attributes of the row on its `--` line, for example `-- {.new}`.",
      },
    ]);
  });

  test("an attribute line in the middle of a cell is attr-misplaced, and the message names the escape", () => {
    expect(errors(lines("a: A", "--", "a: 1", "{.x}  ", "more"))).toEqual([
      {
        line: 4,
        column: 1,
        code: "attr-misplaced",
        message:
          "This attribute line is in the middle of a cell. The attribute line of a cell must be its last line. If the line is text, add a backslash: \\{.x}.",
      },
    ]);
    expect(errors(lines("a: A", "--", "a:", "{.x}", "", "more")).map((e) => [e.line, e.code])).toEqual([[4, "attr-misplaced"]]);
  });

  test("the attribute line after a header key line with an error is still read", () => {
    expect(errors(lines("a: A", "a: B", "{.x}", "{!}")).map((e) => [e.line, e.code])).toEqual([
      [2, "header-duplicate-key"],
      [4, "attr-second-line"],
    ]);
    expect(errors(lines("a: A", "a: B", "{!}")).map((e) => [e.line, e.code])).toEqual([
      [2, "header-duplicate-key"],
      [3, "attr-unexpected-char"],
    ]);
  });

  test("the attribute lines of a cell with a key error are still read", () => {
    expect(errors(lines("a: A", "--", "z: 1", "{.x}", "{.y}")).map((e) => [e.line, e.code])).toEqual([
      [3, "unknown-key"],
      [5, "attr-second-line"],
    ]);
    expect(errors(lines("a: A", "--", "z: 1", "{!}")).map((e) => [e.line, e.code])).toEqual([
      [3, "unknown-key"],
      [4, "attr-unexpected-char"],
    ]);
  });

  test("one error per attribute line, and all errors come sorted by line", () => {
    const text = lines("{.x}", "a: A", "{k}", "{.y}", "--{.z}", "-- {}", "{.w}", "a: 1", "{.v}", "x", "{align=left}");
    expect(errors(text).map((e) => [e.line, e.column, e.code])).toEqual([
      [1, 1, "attr-misplaced"],
      [3, 3, "attr-no-value"],
      [4, 1, "attr-second-line"],
      [5, 1, "header-not-key"],
      [6, 5, "attr-empty"],
      [7, 1, "attr-misplaced"],
      [9, 1, "attr-misplaced"],
      [11, 2, "attr-key-place"],
    ]);
  });
});

describe("locate", () => {
  test("gives the lines of the header keys and of the cell key lines", () => {
    const text = "model: Model\nnote: Note\n--\nn: a\nb\nm: Opus\n\n-- {#x}\n--\nnote: c";
    expect(locate(text)).toEqual({
      headerLines: { model: 1, note: 2 },
      headerAttributeLines: {},
      rows: [
        { line: 3, cells: { note: 4, model: 6 }, cellAttributeLines: {} },
        { line: 8, cells: {}, cellAttributeLines: {} },
        { line: 9, cells: { note: 10 }, cellAttributeLines: {} },
      ],
    });
  });

  test("an escaped line is no key line", () => {
    expect(locate("a: A\n--\na: x\na\\: y\n\\{.x}")).toEqual({
      headerLines: { a: 1 },
      headerAttributeLines: {},
      rows: [{ line: 2, cells: { a: 3 }, cellAttributeLines: {} }],
    });
  });

  test("reads CRLF and CR lines", () => {
    expect(locate("a: A\r\n{.x}\r--\ra: y\r\n{.c}")).toEqual({
      headerLines: { a: 1 },
      headerAttributeLines: { a: 2 },
      rows: [{ line: 3, cells: { a: 4 }, cellAttributeLines: { a: 5 } }],
    });
  });

  test("gives the attribute lines of the columns and of the cells", () => {
    expect(locate("a: A\n{.x}\nb: B\n-- {.r}\nb: y\n{.c}\na: x")).toEqual({
      headerLines: { a: 1, b: 3 },
      headerAttributeLines: { a: 2 },
      rows: [{ line: 4, cells: { b: 5, a: 7 }, cellAttributeLines: { b: 6 } }],
    });
  });

  test("a cell attribute line after empty lines, a cell with no text, and a prefix key", () => {
    expect(locate("model: Model\nnote: Note\n{align=right}\n--\nn: a\nb\n\n{.c}\nm:\n{#m}")).toEqual({
      headerLines: { model: 1, note: 2 },
      headerAttributeLines: { note: 3 },
      rows: [{ line: 4, cells: { note: 5, model: 9 }, cellAttributeLines: { note: 8, model: 10 } }],
    });
  });

  test("gives null for an invalid block", () => {
    expect(locate("--\na: x")).toBeNull();
  });
});
