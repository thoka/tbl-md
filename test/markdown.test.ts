import { describe, expect, test } from "bun:test";
import { findTables, type Found, type FoundGfm } from "../src/index.ts";
import { escapedSplit, lineStarts, splitRow } from "../src/markdown.ts";

const find = (source: string) => findTables(source);

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

  test("an unclosed fence runs to the end of the last line of the text", () => {
    const source = "```tbl\na: A\n";
    expect(find(source)).toMatchObject([{ kind: "tbl", text: "a: A", start: 0, end: source.length - 1 }]);
    expect(find("```tbl\na: A")).toMatchObject([{ kind: "tbl", text: "a: A", start: 0, end: 11 }]);
  });

  test("info text after tbl goes into meta", () => {
    expect(find("```tbl id=1\na: A\n```\n")).toMatchObject([{ kind: "tbl", meta: "id=1" }]);
    expect(find("~~~tbl  a  b \na: A\n~~~\n")).toMatchObject([{ kind: "tbl", meta: "a  b" }]);
  });

  test("the info string is read after its character references, as markdown-it reads the language", () => {
    expect(find("```&#116;bl\na: A\n```\n")).toMatchObject([{ kind: "tbl", meta: null }]);
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

  test("the text keeps a NUL of the source, although markdown-it reads it as U+FFFD", () => {
    expect(find("> ```tbl\n> a: x\u0000y\uFFFD\u0000\n> ```\n")).toMatchObject([{ kind: "tbl", text: "a: x\u0000y\uFFFD\u0000" }]);
  });

  test("the text has LF line ends, also in a file with CRLF or CR", () => {
    expect(find("```tbl\r\na: A\r\n--\r\na: x\r\n```\r\n")).toMatchObject([{ kind: "tbl", text: "a: A\n--\na: x", end: 27 }]);
    expect(find("```tbl\ra: A\r--\ra: x\r```\r")).toMatchObject([{ kind: "tbl", text: "a: A\n--\na: x", end: 23 }]);
  });
});

describe("findTables: GFM tables", () => {
  test("a table at top level", () => {
    const source = "text\n\n| a | b |\n| :- | - |\n| 1 | 2 |\n";
    expect(find(source)).toEqual([
      {
        kind: "gfm",
        start: 6,
        end: source.length - 1,
        line: 3,
        column: 1,
        align: ["left", null],
        header: {
          line: 3,
          cells: [
            { text: "a", line: 3, column: 3 },
            { text: "b", line: 3, column: 7 },
          ],
        },
        rows: [
          {
            line: 5,
            cells: [
              { text: "1", line: 5, column: 3 },
              { text: "2", line: 5, column: 7 },
            ],
          },
        ],
      },
    ]);
  });

  test("the alignment of each column", () => {
    expect(gfm("| a | b | c | d |\n| :-- | :-: | --: | --- |\n")[0]!.align).toEqual(["left", "center", "right", null]);
  });

  test("the cells keep their escapes, and a short row and an excess cell keep their number of cells", () => {
    const [table] = gfm("| a | b |\n| - | - |\n| x\\|y |\n| 1 | 2 | 3 |\n|  | z |\n|\n");
    expect(table!.rows.map((r) => r.cells.map((c) => c.text))).toEqual([["x\\|y"], ["1", "2", "3"], ["", "z"], []]);
  });

  test("a pipe after two backslashes is no delimiter", () => {
    const [table] = gfm("| a | b |\n| - | - |\n| x\\\\|y | z |\n");
    expect(table!.rows[0]!.cells.map((c) => c.text)).toEqual(["x\\\\|y", "z"]);
  });

  test("an empty cell has the column after its spaces", () => {
    const [table] = gfm("| a | b |\n| - | - |\n|   | z |\n");
    expect(table!.rows[0]!.cells[0]).toEqual({ text: "", line: 3, column: 5 });
  });

  test("the trim removes U+00A0 at the edges of a cell", () => {
    const [table] = gfm("| a | b |\n| - | - |\n|\u00a0x\u00a0| y |\n");
    expect(table!.rows[0]!.cells[0]).toEqual({ text: "x", line: 3, column: 3 });
  });

  test("a header line with no pipe is no table", () => {
    expect(kinds("h1\n| --- |\n| a |\n")).toEqual([]);
    expect(kinds("h1\n:-:\na\n")).toEqual([]);
  });

  test("a header row that starts with # or a list marker is a table if a delimiter row follows", () => {
    expect(gfm("# | h2\n--|--\na | b\n")[0]!.header.cells.map((c) => c.text)).toEqual(["#", "h2"]);
    expect(gfm("-   h1|h2\n---|---\na|b\n")[0]!.header.cells.map((c) => c.text)).toEqual(["-   h1", "h2"]);
    expect(kinds("# a | b\n| x |\n| - |\n")).toEqual(["gfm"]);
    expect(gfm("# a | b\n| x |\n| - |\n")[0]!.line).toBe(2);
  });

  test("a table in a block quote, with the columns and the offsets of the original text", () => {
    const source = "> intro\n>\n> | a | b |\n> | - | - |\n>  | c |  d |\n";
    const [table] = gfm(source);
    expect(table).toMatchObject({ line: 3, column: 3, start: 12 });
    expect(source.slice(table!.start, table!.end)).toBe("| a | b |\n> | - | - |\n>  | c |  d |");
    expect(table!.rows[0]!.cells).toEqual([
      { text: "c", line: 5, column: 6 },
      { text: "d", line: 5, column: 11 },
    ]);
  });

  test("a table in a list item, with the columns and the offsets of the original text", () => {
    const source = "- x\n\n  | a | b |\n  | - | - |\n  | c | d |\n";
    const [table] = gfm(source);
    expect(table).toMatchObject({ line: 3, column: 3, start: 7, end: source.length - 1 });
    expect(table!.header.cells.map((c) => c.column)).toEqual([5, 9]);
    expect(gfm("-\t| a |\n \t| - |\n \t| 1 |\n")[0]).toMatchObject({ column: 3, start: 2, rows: [{ cells: [{ text: "1", column: 5 }] }] });
  });

  test("a table in a block quote", () => {
    expect(find("> | a |\n> | - |\n> | 1 |\n")).toMatchObject([{ kind: "gfm", line: 1, column: 3 }]);
  });

  test("a table inside a code block is not found", () => {
    expect(kinds("```\n| a |\n| - |\n```\n")).toEqual([]);
  });
});

describe("findTables: the flavor", () => {
  const source = "| a |\n| - |\n<div>\n";

  test("discourse is the default, and its option html makes <div> an HTML block that ends the table", () => {
    expect(gfm(source)[0]!.rows).toEqual([]);
    expect(findTables(source, { flavor: "discourse" })).toEqual(findTables(source));
  });

  test("with markdown-it, the option html is off, so <div> is a row of the table", () => {
    const [table] = findTables(source, { flavor: "markdown-it" }) as FoundGfm[];
    expect(table!.rows).toEqual([{ line: 3, cells: [{ text: "<div>", line: 3, column: 1 }] }]);
    expect(table!.end).toBe(source.length - 1);
  });

  test("a tbl block in an HTML block is found only with markdown-it", () => {
    const html = "<div>\n```tbl\na: A\n```\n</div>\n";
    expect(kinds(html)).toEqual([]);
    expect(findTables(html, { flavor: "markdown-it" }).map((f) => f.kind)).toEqual(["tbl"]);
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

  test("CRLF line ends give the right lines, columns, and offsets", () => {
    const source = "a\r\n\r\n```tbl\r\nk: K\r\n```\r\n\r\n> | a |\r\n> | - |\r\n> | b |\r\n";
    expect(find(source).map((f) => [f.kind, f.line, f.column])).toEqual([
      ["tbl", 3, 1],
      ["gfm", 7, 3],
    ]);
    const slices = find(source).map((f) => source.slice(f.start, f.end));
    expect(slices).toEqual(["```tbl\r\nk: K\r\n```", "| a |\r\n> | - |\r\n> | b |"]);
    expect((find(source)[1] as FoundGfm).rows[0]!.cells).toEqual([{ text: "b", line: 9, column: 5 }]);
  });

  test("lone CR line ends give the right lines, columns, and offsets", () => {
    const source = "a\r\r```tbl\rk: K\r```\r\r- | a |\r  | - |\r  | b |\r";
    expect(find(source).map((f) => [f.kind, f.line, f.column])).toEqual([
      ["tbl", 3, 1],
      ["gfm", 7, 3],
    ]);
    const slices = find(source).map((f) => source.slice(f.start, f.end));
    expect(slices).toEqual(["```tbl\rk: K\r```", "| a |\r  | - |\r  | b |"]);
    expect((find(source)[1] as FoundGfm).rows[0]!.cells).toEqual([{ text: "b", line: 9, column: 5 }]);
  });
});

/** The GFM tables of a text with the default flavor. */
function gfm(source: string): FoundGfm[] {
  return findTables(source).filter((f): f is FoundGfm => f.kind === "gfm");
}

describe("escapedSplit", () => {
  test("splits at each pipe with no backslash before it", () => {
    expect(escapedSplit("a|b|c").map((p) => p.text)).toEqual(["a", "b", "c"]);
  });

  test("a pipe after any run of backslashes is no delimiter, and the part loses one backslash", () => {
    expect(escapedSplit("x\\|y").map((p) => p.text)).toEqual(["x|y"]);
    expect(escapedSplit("x\\\\|y").map((p) => p.text)).toEqual(["x\\|y"]);
    expect(escapedSplit("x\\\\\\|y").map((p) => p.text)).toEqual(["x\\\\|y"]);
  });

  test("gives the offsets of the raw part", () => {
    expect(escapedSplit("ab|c\\|d|").map(({ start, end }) => [start, end])).toEqual([
      [0, 2],
      [3, 7],
      [8, 8],
    ]);
  });
});

describe("splitRow", () => {
  const contents = (line: string) => splitRow(line).map((c) => c.content);

  test("drops an empty first and an empty last part", () => {
    expect(contents("| a | b |")).toEqual(["a", "b"]);
    expect(contents("a | b")).toEqual(["a", "b"]);
    expect(contents("| a | b |   ")).toEqual(["a", "b"]);
    expect(contents("|")).toEqual([]);
  });

  test("keeps an excess cell and an empty cell in the middle", () => {
    expect(contents("| a | b | c |")).toEqual(["a", "b", "c"]);
    expect(contents("|  | b |")).toEqual(["", "b"]);
  });

  test("the trim offsets point at the cell text in the line", () => {
    const line = "  | a  |\tb\\|c | ";
    for (const cell of splitRow(line)) {
      expect(line.slice(cell.trimStart, cell.trimEnd).replace("\\|", "|")).toBe(cell.content);
    }
  });

  test("an empty cell has an empty trimmed range", () => {
    const [cell] = splitRow("|   | b |");
    expect(cell!.trimStart).toBe(cell!.trimEnd);
  });

  test("trims Unicode spaces such as U+00A0, as String.prototype.trim does", () => {
    expect(contents("|\u00a0a\u00a0| b |")).toEqual(["a", "b"]);
  });
});

describe("lineStarts", () => {
  test("knows LF, CRLF, and CR", () => {
    expect(lineStarts("a\nb\r\nc\rd")).toEqual([0, 2, 5, 7]);
  });
});
