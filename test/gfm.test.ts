import { describe, expect, test } from "bun:test";
import { findTables, fromGfm, keysFromTitles, toGfm, type FoundGfm, type Table } from "../src/index.ts";

/** Reads the first GFM table of a Markdown text. */
function read(source: string) {
  const found = findTables(source).filter((f): f is FoundGfm => f.kind === "gfm");
  expect(found.length).toBe(1);
  return fromGfm(source, found[0]!);
}

function gfm(table: Table): string {
  const result = toGfm(table);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.text;
}

/** One column "a" with the title "A" and one row with the cell text. */
const one = (text: string, id?: string): Table => ({
  columns: [{ key: "a", title: "A" }],
  rows: [id === undefined ? { cells: { a: text } } : { id, cells: { a: text } }],
});

/** toGfm, then fromGfm, of a table with one cell. Returns the GFM cell text and the table. */
function roundTrip(table: Table) {
  const text = gfm(table);
  const back = read(text);
  expect(back).toStrictEqual({ ok: true, table });
  return text;
}

describe("keysFromTitles", () => {
  test("lower case, and each run of other characters becomes one -", () => {
    expect(keysFromTitles(["Model", "Price ($)", "(Price)", "Long  Name!", "a_b", "Ünits 2"])).toEqual([
      "model",
      "price",
      "price-2",
      "long-name",
      "a-b",
      "nits-2",
    ]);
  });

  test("a duplicate gets -2, -3", () => {
    expect(keysFromTitles(["Name", "name", "NAME"])).toEqual(["name", "name-2", "name-3"]);
  });

  test("an empty key becomes c and the column number", () => {
    expect(keysFromTitles(["", "A", "()", "é"])).toEqual(["c1", "a", "c3", "c4"]);
  });

  test("a suffix skips the key of another title", () => {
    expect(keysFromTitles(["a", "a", "a-2"])).toEqual(["a", "a-3", "a-2"]);
    expect(keysFromTitles(["a", "a", "a", "a-3"])).toEqual(["a", "a-2", "a-4", "a-3"]);
  });

  test("an empty title can collide with a title like c1", () => {
    expect(keysFromTitles(["", "c1"])).toEqual(["c1", "c1-2"]);
  });
});

describe("toGfm", () => {
  test("the header, the delimiter row, and one line per row, with no final newline", () => {
    const table: Table = {
      columns: [
        { key: "model", title: "Model" },
        { key: "price", title: "Price" },
      ],
      rows: [{ cells: { model: "Opus", price: "$15" } }, { cells: { price: "$1" } }],
    };
    expect(gfm(table)).toBe("| Model | Price |\n| --- | --- |\n| Opus | $15 |\n|  | $1 |");
    roundTrip(table);
  });

  test("a table with no body rows", () => {
    const table: Table = { columns: [{ key: "a", title: "A" }], rows: [] };
    expect(gfm(table)).toBe("| A |\n| --- |");
    roundTrip(table);
  });

  test("an empty title", () => {
    const table: Table = { columns: [{ key: "c1", title: "" }], rows: [{ cells: { c1: "x" } }] };
    expect(gfm(table)).toBe("|  |\n| --- |\n| x |");
    roundTrip(table);
  });

  test("a line break becomes <br>", () => {
    expect(roundTrip(one("x\ny\n\nz"))).toBe("| A |\n| --- |\n| x<br>y<br><br>z |");
    expect(roundTrip(one("\nx"))).toEndWith("| <br>x |");
  });

  test("a literal <br> gets one backslash more", () => {
    expect(roundTrip(one("a<br>b"))).toEndWith("| a\\<br>b |");
    expect(roundTrip(one("a\\<br>b"))).toEndWith("| a\\\\<br>b |");
    expect(roundTrip(one("a<br>"))).toEndWith("| a\\<br> |");
  });

  test("<br/> and <BR> stay text", () => {
    expect(roundTrip(one("a<br/>b<BR>c"))).toEndWith("| a<br/>b<BR>c |");
  });

  test("a title keeps <br> as it is", () => {
    const table: Table = { columns: [{ key: "a-br-b", title: "a<br>b" }], rows: [] };
    expect(gfm(table)).toBe("| a<br>b |\n| --- |");
    roundTrip(table);
  });

  test("a pipe after an even number of backslashes gets one backslash more", () => {
    expect(roundTrip(one("x|y"))).toEndWith("| x\\|y |");
    expect(roundTrip(one("x\\\\|y"))).toEndWith("| x\\\\\\|y |");
    expect(roundTrip(one("`x|y`"))).toEndWith("| `x\\|y` |");
    expect(roundTrip(one("|"))).toEndWith("| \\| |");
  });

  test("a pipe in a title gets one backslash more", () => {
    const table: Table = { columns: [{ key: "a-b", title: "a|b" }], rows: [] };
    expect(gfm(table)).toBe("| a\\|b |\n| --- |");
    roundTrip(table);
  });

  test("the ID goes to the end of the first cell, after one space", () => {
    const table: Table = {
      columns: [
        { key: "a", title: "A" },
        { key: "b", title: "B" },
      ],
      rows: [{ id: "x1", cells: { a: "text", b: "y" } }],
    };
    expect(gfm(table)).toBe("| A | B |\n| --- | --- |\n| text {#x1} | y |");
    roundTrip(table);
  });

  test("an ID with an empty first cell", () => {
    const table: Table = {
      columns: [
        { key: "a", title: "A" },
        { key: "b", title: "B" },
      ],
      rows: [{ id: "x1", cells: { b: "y" } }],
    };
    expect(gfm(table)).toBe("| A | B |\n| --- | --- |\n| {#x1} | y |");
    roundTrip(table);
  });

  test("a first cell with the marker form and no ID gets one backslash more", () => {
    expect(roundTrip(one("x {#a}"))).toEndWith("| x \\{#a} |");
    expect(roundTrip(one("{#a}"))).toEndWith("| \\{#a} |");
    expect(roundTrip(one("x \\{#a}"))).toEndWith("| x \\\\{#a} |");
  });

  test("text that is not the marker form keeps its backslashes", () => {
    expect(roundTrip(one("x\\{#a}"))).toEndWith("| x\\{#a} |");
    expect(roundTrip(one("x\n{#a}"))).toEndWith("| x<br>{#a} |");
    expect(roundTrip(one("x {#a b}"))).toEndWith("| x {#a b} |");
  });

  test("with an ID, a marker form in the text needs no escape", () => {
    expect(roundTrip(one("x {#a}", "b"))).toEndWith("| x {#a} {#b} |");
    expect(roundTrip(one("x \\{#a}", "b"))).toEndWith("| x \\{#a} {#b} |");
  });

  test("the marker form in another cell than the first stays as it is", () => {
    const table: Table = {
      columns: [
        { key: "a", title: "A" },
        { key: "b", title: "B" },
      ],
      rows: [{ cells: { a: "x", b: "y {#c}" } }],
    };
    expect(gfm(table)).toEndWith("| x | y {#c} |");
    roundTrip(table);
  });

  test("a cell that ends with a backslash", () => {
    expect(roundTrip(one("x\\"))).toEndWith("| x\\ |");
    expect(roundTrip(one("x\\", "i"))).toEndWith("| x\\ {#i} |");
  });

  test("an invalid table gives the problems of validate", () => {
    const result = toGfm({ columns: [], rows: [] });
    expect(result).toStrictEqual({ ok: false, errors: [{ message: "The table has no columns. A table needs one column at least." }] });
  });

  test("a title that starts or ends with a space or a tab fails", () => {
    for (const title of [" A", "A ", "\tA", "A\t"]) {
      const result = toGfm({ columns: [{ key: "a", title }], rows: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({ key: "a" });
        expect(result.errors[0]!.row).toBeUndefined();
        expect(result.errors[0]!.message).toContain("space or a tab");
      }
    }
  });

  test("a cell that starts or ends with a space or a tab fails, with the row and the key", () => {
    for (const text of [" x", "x ", "\tx", "x\t", "x\n "]) {
      const result = toGfm(one(text));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toMatchObject({ row: 1, key: "a" });
        expect(result.errors[0]!.message).toStartWith('Row 1, cell "a": the text starts or ends with a space or a tab.');
      }
    }
  });

  test("a pipe after an odd number of backslashes fails and names the fix", () => {
    const result = toGfm(one("x\\|y"));
    expect(result).toStrictEqual({
      ok: false,
      errors: [
        {
          row: 1,
          key: "a",
          message:
            'Row 1, cell "a": has a pipe after 1 backslash. In GFM, this pipe would split the cell. Write the pipe with no backslash (`|`), or with one backslash more (`\\\\|`).',
        },
      ],
    });
    const three = toGfm(one("x\\\\\\|y"));
    expect(three.ok).toBe(false);
    if (!three.ok) expect(three.errors[0]!.message).toContain("after 3 backslashes");
  });

  test("a pipe after an odd number of backslashes in a title fails", () => {
    const result = toGfm({ columns: [{ key: "a", title: "x\\|y" }], rows: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatchObject({ key: "a" });
  });

  test("a line that ends with a backslash before a line break fails", () => {
    const result = toGfm(one("a\nb\\\nc"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.message).toStartWith('Row 1, cell "a": line 2 ends with a backslash, and a line follows.');
    }
  });

  test("it collects all errors", () => {
    const table: Table = {
      columns: [
        { key: "a", title: " A" },
        { key: "b", title: "B" },
      ],
      rows: [{ cells: { a: "x ", b: "y" } }, { cells: { b: "\\|" } }],
    };
    const result = toGfm(table);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => [e.row, e.key])).toEqual([[undefined, "a"], [1, "a"], [2, "b"]]);
  });
});

describe("fromGfm", () => {
  test("the keys come from the titles", () => {
    expect(read("| Price ($) | (Price) | |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n")).toStrictEqual({
      ok: true,
      table: {
        columns: [
          { key: "price", title: "Price ($)" },
          { key: "price-2", title: "(Price)" },
          { key: "c3", title: "" },
        ],
        rows: [{ cells: { price: "1", "price-2": "2", c3: "3" } }],
      },
    });
  });

  test("the alignment is dropped", () => {
    expect(read("| a | b | c |\n| :-: | --: | :-- |\n| x | y | z |")).toStrictEqual({
      ok: true,
      table: {
        columns: [
          { key: "a", title: "a" },
          { key: "b", title: "b" },
          { key: "c", title: "c" },
        ],
        rows: [{ cells: { a: "x", b: "y", c: "z" } }],
      },
    });
  });

  test("a row with fewer cells has empty cells", () => {
    expect(read("| a | b |\n| --- | --- |\n| x |")).toStrictEqual({
      ok: true,
      table: {
        columns: [
          { key: "a", title: "a" },
          { key: "b", title: "b" },
        ],
        rows: [{ cells: { a: "x" } }],
      },
    });
  });

  test("a table with no outer pipes and with extra spaces", () => {
    expect(read("a   |  b\n--- | ---\n  x  |   y  ")).toStrictEqual({
      ok: true,
      table: {
        columns: [
          { key: "a", title: "a" },
          { key: "b", title: "b" },
        ],
        rows: [{ cells: { a: "x", b: "y" } }],
      },
    });
  });

  test("the cell text stays byte for byte, also the inline Markdown", () => {
    const result = read("| a |\n| --- |\n| **x** `c\\|d` [l](u) &amp; \\* |");
    expect(result).toMatchObject({ ok: true, table: { rows: [{ cells: { a: "**x** `c|d` [l](u) &amp; \\*" } }] } });
  });

  test("a table in a block quote and in a list item", () => {
    expect(read("> | a |\n> | --- |\n> | x<br>y |\n")).toMatchObject({ ok: true, table: { rows: [{ cells: { a: "x\ny" } }] } });
    expect(read("- item\n\n  | a |\n  | --- |\n  | x {#i} |\n")).toMatchObject({ ok: true, table: { rows: [{ id: "i", cells: { a: "x" } }] } });
  });

  test("only the last marker is the ID", () => {
    expect(read("| a |\n| --- |\n| x {#a} {#b} |")).toMatchObject({ ok: true, table: { rows: [{ id: "b", cells: { a: "x {#a}" } }] } });
  });

  test("a cell that ends with <br> fails, with the file line and column", () => {
    const result = read("# T\n\n| a | b |\n| --- | --- |\n| x | y<br> |\n");
    expect(result).toStrictEqual({
      ok: false,
      errors: [
        {
          line: 5,
          column: 5,
          message: 'Row 1, cell "b": the text ends with `<br>`. A tbl cell never ends with a line break, so remove the last `<br>`.',
        },
      ],
    });
  });

  test("a cell that ends with an escaped <br> is valid", () => {
    expect(read("| a |\n| --- |\n| y\\<br> |")).toMatchObject({ ok: true, table: { rows: [{ cells: { a: "y<br>" } }] } });
  });

  test("a first cell that ends with <br> before the ID fails", () => {
    const result = read("| a |\n| --- |\n| y<br> {#i} |");
    expect(result.ok).toBe(false);
  });

  test("a row with more cells than the header fails", () => {
    const result = read("| a |\n| --- |\n| x | y |");
    expect(result).toStrictEqual({
      ok: false,
      errors: [
        {
          line: 3,
          column: 5,
          message: "Row 1 has more cells than the header (1). GFM drops cell 2, so add a column for it or remove it.",
        },
      ],
    });
  });

  const ab = { columns: [{ key: "a", title: "a" }, { key: "b", title: "b" }], rows: [{ cells: { a: "x", b: "y" } }] };

  test("an empty excess cell is dropped", () => {
    expect(read("| a | b |\n| --- | --- |\n| x | y | |")).toStrictEqual({ ok: true, table: ab });
  });

  test("an excess cell of only spaces and tabs is dropped", () => {
    expect(read("| a | b |\n| --- | --- |\n| x | y |  \t \t |")).toStrictEqual({ ok: true, table: ab });
  });

  test("two empty excess cells are dropped", () => {
    expect(read("| a | b |\n| --- | --- |\n| x | y | | |")).toStrictEqual({ ok: true, table: ab });
  });

  test("an empty excess cell and then an excess cell with text fail at the cell with text", () => {
    expect(read("| a | b |\n| --- | --- |\n| x | y | | z |")).toStrictEqual({
      ok: false,
      errors: [
        {
          line: 3,
          column: 11,
          message: "Row 1 has more cells than the header (2). GFM drops cell 4, so add a column for it or remove it.",
        },
      ],
    });
  });

  test("two excess cells with text give one error at the first of them", () => {
    expect(read("| a |\n| --- |\n| x | y | z |")).toStrictEqual({
      ok: false,
      errors: [
        {
          line: 3,
          column: 5,
          message: "Row 1 has more cells than the header (1). GFM drops cell 2, so add a column for it or remove it.",
        },
      ],
    });
  });

  test("text before the ID marker that ends with a space fails", () => {
    const result = read("| a |\n| --- |\n| x  {#i} |");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.message).toContain("before the ID marker ends with a space");
  });

  test("toGfm of the result gives the canonical GFM text", () => {
    const result = read("|a|b|\n|:-|-:|\n|x\\|y|{#i}|\n|  {#j}|z\\\\\\|w|");
    expect(result.ok).toBe(true);
    if (result.ok) expect(gfm(result.table)).toBe("| a | b |\n| --- | --- |\n| x\\|y | {#i} |\n| {#j} | z\\\\\\|w |");
  });
});

describe("fromGfm: spaces and tabs after the last pipe", () => {
  // micromark ends the last cell at the end of the line, so these spaces and tabs come after the closing pipe (step 9b).
  const xy: Table = {
    columns: [
      { key: "a", title: "A" },
      { key: "b", title: "B" },
    ],
    rows: [{ cells: { a: "x", b: "y" } }],
  };

  test("spaces after the last pipe of a data row", () => {
    expect(read("| A | B |\n| --- | --- |\n| x | y | \n")).toStrictEqual({ ok: true, table: xy });
  });

  test("a tab after the last pipe of a data row", () => {
    expect(read("| A | B |\n| --- | --- |\n| x | y |\t\n")).toStrictEqual({ ok: true, table: xy });
  });

  test("spaces and tabs after the header row and the delimiter row", () => {
    expect(read("| A | B |  \n| --- | --- | \t\n| x | y |\n")).toStrictEqual({ ok: true, table: xy });
  });

  test("a row with no leading pipe", () => {
    expect(read("A | B | \n--- | --- | \nx | y |\t \n")).toStrictEqual({ ok: true, table: xy });
  });

  test("a row with no trailing pipe", () => {
    expect(read("| A | B  \n| --- | ---\t\n| x | y \t \n")).toStrictEqual({ ok: true, table: xy });
  });

  test("a table in a list item", () => {
    expect(read("- | A | B | \n  | --- | --- | \n  | x | y |\t\n")).toStrictEqual({ ok: true, table: xy });
  });

  test("a table in a block quote", () => {
    expect(read("> | A | B | \n> | --- | --- | \n> | x | y |\t\n")).toStrictEqual({ ok: true, table: xy });
  });

  test("an escaped pipe at the end of the cell stays text", () => {
    expect(read("| A | B |\n| --- | --- |\n| x | y\\| \n")).toMatchObject({ ok: true, table: { rows: [{ cells: { a: "x", b: "y|" } }] } });
  });

  test("a closing pipe after two backslashes is a delimiter", () => {
    expect(read("| A | B |\n| --- | --- |\n| x | y\\\\| \n")).toMatchObject({ ok: true, table: { rows: [{ cells: { a: "x", b: "y\\\\" } }] } });
  });

  test("an ID marker in the only cell", () => {
    expect(read("| A |\n| --- |\n| x {#i} | \n")).toMatchObject({ ok: true, table: { rows: [{ id: "i", cells: { a: "x" } }] } });
  });

  test("the conversion back to GFM gives the canonical text, with no pipe in a cell", () => {
    const result = read("| A | B | \n| --- | --- | \n| x | y |\t\n");
    expect(result.ok).toBe(true);
    if (result.ok) expect(gfm(result.table)).toBe("| A | B |\n| --- | --- |\n| x | y |");
  });
});
