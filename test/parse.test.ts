import { describe, expect, test } from "bun:test";
import { parse, unescapeLine, type Table, type TblError } from "../src/index.ts";

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

describe("the example of docs/format.md", () => {
  test("gives the expected table", () => {
    const text = lines(
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
    expect(parse(text)).toEqual({
      ok: true,
      table: {
        columns: [
          { key: "model", title: "Model" },
          { key: "price", title: "Price" },
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
              ].join("\n"),
            },
          },
          { id: "a1b2c3d4", cells: { model: "Haiku", price: "$1" } },
        ],
      },
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
      { id: "x_Y-9", cells: { a: "2" } },
    ]);
  });

  test("`-- foo` is text", () => {
    expect(table(lines("a: A", "--", "a: 1", "-- foo")).rows).toEqual([{ cells: { a: "1\n-- foo" } }]);
  });

  test("an invalid ID marker or a space after `--` is text", () => {
    expect(table(lines("a: A", "--", "a: 1", "-- {#a.b}", "--- ", "--x")).rows).toEqual([
      { cells: { a: "1\n-- {#a.b}\n--- \n--x" } },
    ]);
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
