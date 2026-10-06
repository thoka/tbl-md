// Property tests of the two laws of the renderer, on random valid tables with random attributes:
// parse(render(T)) gives T back, and render(parse(render(T)).table) is render(T).
// The second part checks the laws of the GFM conversion.
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
  convert,
  findTables,
  fromGfm,
  keysFromTitles,
  parse,
  render,
  renderBlock,
  toGfm,
  validate,
  type AttributePlace,
  type Attributes,
  type Column,
  type FoundGfm,
  type Row,
  type Table,
} from "../src/index.ts";
import { gfmView } from "../src/gfm.ts";
import { engineOf } from "../src/engine.ts";
import { FLAVORS, type Flavor } from "../src/flavor.ts";

const runs = { numRuns: 1000 };

// A small alphabet, so that keys often share a prefix.
const key = fc.stringMatching(/^[a-z0-9_-]{1,3}$/);
const id = fc.stringMatching(/^[A-Za-z0-9_-]{1,6}$/);

// Characters that build the line forms of rule 10, and a few others. No CR and no LF (rule 12).
const char = fc.constantFrom("a", "k", "K", " ", ":", "-", "\\", "`", "{", "#", "}", "x", "é", "\t", "|");
const randomLine = fc.array(char, { maxLength: 8 }).map((c) => c.join(""));
const formLine = fc.constantFrom(
  "",
  " ",
  "--",
  "\\--",
  "\\\\--",
  "-- {#x}",
  "\\-- {#x}",
  "\\\\-- {#a-1}",
  "-- foo",
  "\\-- foo",
  "k: v",
  "k:",
  "a: x",
  "k\\: v",
  "k\\\\:",
  "K: v",
  "https://example.com",
  "```",
  "````",
  "   `````  ",
  "    ```",
  "  lead",
  "trail  ",
  "{.x}",
  "{}",
  "{!} ",
  "\\{.x}",
  "\\\\{#a k=v}",
  "-- {.x}",
  "--\t{!}",
  "\\-- {.y}",
  "{.x} y",
);
const line = fc.oneof(formLine, randomLine);

// A cell text never ends with an empty line (rule 7), and an empty text is no cell (rule 8).
const cellText = fc
  .array(line, { minLength: 1, maxLength: 5 })
  .map((lines) => {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  })
  .filter((text) => text !== "");

// Random attributes (rules 13 to 15): an optional ID, classes, and pairs, with values that need quotes and escapes.
const className = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,3}$/);
const pairKey = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,3}$/).filter((k) => k !== "id" && k !== "class" && k !== "align");
const value = fc.array(fc.constantFrom("a", "Z", "1", ":", "-", "_", " ", "\t", '"', "\\", "{", "}", "#", ".", "=", "'", "é"), { maxLength: 6 }).map((c) => c.join(""));
const pair = fc.record({ key: pairKey, value });
function attributesArb(place: AttributePlace): fc.Arbitrary<Attributes> {
  const align = place === "column" ? fc.option(fc.constantFrom("left", "center", "right"), { nil: undefined }) : fc.constant(undefined);
  return fc
    .record({
      id: fc.option(id, { nil: undefined }),
      classes: fc.uniqueArray(className, { maxLength: 3 }),
      pairs: fc.uniqueArray(pair, { maxLength: 3, selector: (p) => p.key }),
      align,
    })
    .map(({ id: attrId, classes, pairs, align: alignValue }) => {
      const attributes: Attributes = { classes, pairs: alignValue === undefined ? pairs : [...pairs, { key: "align", value: alignValue }] };
      if (attrId !== undefined) attributes.id = attrId;
      return attributes;
    })
    .filter((a) => a.id !== undefined || a.classes.length > 0 || a.pairs.length > 0);
}
const maybe = <T>(arb: fc.Arbitrary<T>) => fc.option(arb, { nil: undefined, freq: 3 });

const tableArb: fc.Arbitrary<Table> = fc
  .uniqueArray(key, { minLength: 1, maxLength: 4 })
  .chain((keys) =>
    fc.record({
      columns: fc.tuple(
        ...keys.map((k) =>
          fc.tuple(line, maybe(attributesArb("column"))).map(([title, attributes]) => {
            const column: Column = { key: k, title };
            if (attributes !== undefined) column.attributes = attributes;
            return column;
          }),
        ),
      ),
      rows: fc.array(
        fc
          .tuple(
            maybe(attributesArb("row")),
            fc.tuple(...keys.map(() => fc.tuple(fc.option(cellText, { nil: undefined }), maybe(attributesArb("cell"))))),
          )
          .map(([rowAttributes, cellParts]) => {
            const cells: Record<string, string> = {};
            const cellAttributes: Record<string, Attributes> = {};
            cellParts.forEach(([text, attributes], i) => {
              if (text !== undefined) cells[keys[i]!] = text;
              if (attributes !== undefined) cellAttributes[keys[i]!] = attributes;
            });
            const row: Row = { cells };
            if (rowAttributes !== undefined) row.attributes = rowAttributes;
            if (Object.keys(cellAttributes).length > 0) row.cellAttributes = cellAttributes;
            return row;
          }),
        { maxLength: 4 },
      ),
    }),
  );

describe("the laws of render", () => {
  test("the generator gives valid tables", () => {
    fc.assert(fc.property(tableArb, (t) => validate(t).length === 0), runs);
  });

  test("parse(render(T)) gives T back", () => {
    fc.assert(
      fc.property(tableArb, (t) => {
        expect(parse(render(t))).toStrictEqual({ ok: true, table: t });
      }),
      runs,
    );
  });

  test("render(parse(render(T)).table) is render(T)", () => {
    fc.assert(
      fc.property(tableArb, (t) => {
        const text = render(t);
        const result = parse(text);
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(render(result.table)).toBe(text);
      }),
      runs,
    );
  });

  test("no line of the text closes the fence of renderBlock", () => {
    fc.assert(
      fc.property(tableArb, (t) => {
        const block = renderBlock(t).split("\n");
        const fence = block[0]!.slice(0, -"tbl".length);
        for (const l of block.slice(1, -1)) {
          const match = /^ {0,3}(`{3,})[ \t]*$/.exec(l);
          if (match) expect(match[1]!.length).toBeLessThan(fence.length);
        }
        expect(block[block.length - 1]).toBe(fence);
      }),
      runs,
    );
  });
});

// Property tests of the GFM conversion (docs/format.md, section "Conversion to and from GFM").
// The tables have the keys of keysFromTitles, and no text that toGfm rejects.
const gfmRuns = { numRuns: 500 };

// Pieces that build the forms of the conversion: pipes after backslashes, `<br>`, the ID marker, code spans.
const plainPieces = ["a", "B", "r", " ", "\t", "\u00a0", "\\", "|", "\\|", "\\\\|", "<", ">", "{", "#", "}", "`", "*", "é", ":", "-", "&amp;", "[a](b)"];
const piece = fc.constantFrom(...plainPieces, "<br>", "{#x}");
const gfmLine = fc.array(piece, { maxLength: 7 }).map((p) => p.join(""));

/** True if toGfm can convert the text: no character of the trim at an edge (a line break is none), no backslash before a line break. */
function convertible(text: string): boolean {
  if (/^(?!\n)\s|(?!\n)\s$/.test(text)) return false;
  return !/\\\n/.test(text);
}

const gfmTitle = gfmLine.filter(convertible);
const gfmCell = fc
  .array(gfmLine, { minLength: 1, maxLength: 3 })
  .map((lines) => {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  })
  .filter((text) => text !== "" && convertible(text));

/** A random `align` of a column, or none. */
const alignArb = fc.option(fc.constantFrom("left", "center", "right"), { nil: undefined });

const gfmTableArb: fc.Arbitrary<Table> = fc.array(fc.tuple(gfmTitle, alignArb), { minLength: 1, maxLength: 4 }).chain((parts) => {
  const keys = keysFromTitles(parts.map(([title]) => title));
  return fc.record({
    columns: fc.constant(
      parts.map(([title, align], i) => {
        const column: Column = { key: keys[i]!, title };
        if (align !== undefined) column.attributes = { classes: [], pairs: [{ key: "align", value: align }] };
        return column;
      }),
    ),
    rows: fc.array(
      fc
        .tuple(fc.option(id, { nil: undefined }), fc.tuple(...keys.map(() => fc.option(gfmCell, { nil: undefined }))))
        .map(([rowId, texts]) => {
          const cells: Record<string, string> = {};
          texts.forEach((text, i) => {
            if (text !== undefined) cells[keys[i]!] = text;
          });
          const row: Row = { cells };
          if (rowId !== undefined) row.attributes = { id: rowId, classes: [], pairs: [] };
          return row;
        }),
      { maxLength: 4 },
    ),
  });
});

// Tables for the law of dropAttributes: the titles and the cells of gfmTableArb, with random attributes at each place.
const gfmAttributesTableArb: fc.Arbitrary<Table> = fc.array(fc.tuple(gfmTitle, maybe(attributesArb("column"))), { minLength: 1, maxLength: 4 }).chain((parts) => {
  const keys = keysFromTitles(parts.map(([title]) => title));
  return fc.record({
    columns: fc.constant(
      parts.map(([title, attributes], i) => {
        const column: Column = { key: keys[i]!, title };
        if (attributes !== undefined) column.attributes = attributes;
        return column;
      }),
    ),
    rows: fc.array(
      fc
        .tuple(maybe(attributesArb("row")), fc.tuple(...keys.map(() => fc.tuple(fc.option(gfmCell, { nil: undefined }), maybe(attributesArb("cell"))))))
        .map(([rowAttributes, cellParts]) => {
          const cells: Record<string, string> = {};
          const cellAttributes: Record<string, Attributes> = {};
          cellParts.forEach(([text, attributes], i) => {
            if (text !== undefined) cells[keys[i]!] = text;
            if (attributes !== undefined) cellAttributes[keys[i]!] = attributes;
          });
          const row: Row = { cells };
          if (rowAttributes !== undefined) row.attributes = rowAttributes;
          if (Object.keys(cellAttributes).length > 0) row.cellAttributes = cellAttributes;
          return row;
        }),
      { maxLength: 4 },
    ),
  });
});

// Cells for the meaning test: a letter first, and no `<br>` and no `{#x}` piece.
const meaningLine = fc.array(fc.constantFrom(...plainPieces), { maxLength: 7 }).map((p) => p.join(""));
const meaningCell = fc
  .tuple(fc.constantFrom("a", "B"), fc.array(meaningLine, { minLength: 1, maxLength: 3 }))
  .map(([letter, lines]) => (letter + lines.join("\n")).replace(/\n+$/, ""))
  .filter(convertible);
const meaningTableArb: fc.Arbitrary<Table> = fc.array(gfmTitle, { minLength: 1, maxLength: 3 }).chain((titles) => {
  const keys = keysFromTitles(titles);
  return fc.record({
    columns: fc.constant(titles.map((title, i) => ({ key: keys[i]!, title }))),
    rows: fc.array(
      fc.tuple(...keys.map(() => fc.option(meaningCell, { nil: undefined }))).map((texts) => {
        const cells: Record<string, string> = {};
        texts.forEach((text, i) => {
          if (text !== undefined) cells[keys[i]!] = text;
        });
        return { cells };
      }),
      { minLength: 1, maxLength: 3 },
    ),
  });
});

function toGfmText(t: Table): string {
  const result = toGfm(t);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.text;
}

function onlyGfm(text: string, flavor?: Flavor): FoundGfm {
  const found = findTables(text, { flavor });
  expect(found.map((f) => f.kind)).toEqual(["gfm"]);
  return found[0] as FoundGfm;
}

/** The HTML of each cell of the first GFM table of a text, as the flavor renders the whole text: the header row first. */
function cellHtml(text: string, flavor: Flavor): string[][] {
  const md = engineOf(flavor);
  const env = {};
  const tokens = md.parse(text, env);
  const rows: string[][] = [];
  for (const token of tokens) {
    if (token.type === "tr_open") rows.push([]);
    if (token.type === "inline" && rows.length > 0) rows[rows.length - 1]!.push(md.renderer.renderInline(token.children!, md.options, env));
    if (token.type === "table_close") break;
  }
  return rows;
}

describe("the laws of the GFM conversion", () => {
  test("the generator gives valid tables", () => {
    fc.assert(fc.property(gfmTableArb, (t) => validate(t).length === 0), gfmRuns);
  });

  test("fromGfm(toGfm(T)) gives T back", () => {
    fc.assert(
      fc.property(gfmTableArb, (t) => {
        const text = toGfmText(t);
        expect(fromGfm(text, onlyGfm(text))).toStrictEqual({ ok: true, table: t });
      }),
      gfmRuns,
    );
  });

  test("toGfm of the result gives the same GFM text", () => {
    fc.assert(
      fc.property(gfmTableArb, (t) => {
        const text = toGfmText(t);
        const back = fromGfm(text, onlyGfm(text));
        if (!back.ok) throw new Error(JSON.stringify(back.errors));
        expect(toGfmText(back.table)).toBe(text);
      }),
      gfmRuns,
    );
  });

  test("the GFM text is one table with the header width and the row count", () => {
    fc.assert(
      fc.property(gfmTableArb, (t) => {
        const found = onlyGfm(toGfmText(t));
        expect(found.align).toHaveLength(t.columns.length);
        expect(found.header.cells).toHaveLength(t.columns.length);
        expect(found.rows).toHaveLength(t.rows.length);
        for (const row of found.rows) expect(row.cells).toHaveLength(t.columns.length);
      }),
      gfmRuns,
    );
  });

  test("with dropAttributes, a table with random attributes converts and reads back as its GFM view", () => {
    let dropped = 0;
    fc.assert(
      fc.property(gfmAttributesTableArb, (t) => {
        const result = toGfm(t, { dropAttributes: true });
        if (!result.ok) throw new Error(JSON.stringify(result.errors));
        expect(fromGfm(result.text, onlyGfm(result.text))).toStrictEqual({ ok: true, table: gfmView(t) });
        if (!toGfm(t).ok) dropped++;
      }),
      gfmRuns,
    );
    // Most random tables have an attribute with no GFM form, so the test is not empty.
    expect(dropped).toBeGreaterThan(gfmRuns.numRuns / 2);
  });

  test("with dropAttributes, convert writes the GFM view of a tbl block", () => {
    fc.assert(
      fc.property(gfmAttributesTableArb, (t) => {
        const there = convert(`${renderBlock(t)}\n`, { to: "gfm", dropAttributes: true });
        if (!there.ok) throw new Error(JSON.stringify(there.errors));
        const back = convert(there.output, { to: "tbl" });
        if (!back.ok) throw new Error(JSON.stringify(back.errors));
        expect(back.output).toBe(`${renderBlock(gfmView(t))}\n`);
      }),
      gfmRuns,
    );
  });

  // The meaning test, for each flavor: the HTML of each GFM cell, as the flavor renders the whole GFM table,
  // equals the HTML that the flavor gives for the tbl cell text as inline Markdown, with each line break written as `<br>`.
  // Its tables have no literal `<br>` (it gets a backslash on purpose) and no row ID.
  // It skips a first cell with the marker form, which gets a backslash on purpose.
  // A cell text starts with a letter, so that it is no other block.
  for (const flavor of FLAVORS) {
    test(`a GFM cell has the same HTML as the tbl cell with the flavor ${flavor}`, () => {
      const markerForm = /(^| )\\*\{#[A-Za-z0-9_-]+\}$/;
      const md = engineOf(flavor);
      let compared = 0;
      fc.assert(
        fc.property(meaningTableArb, (t) => {
          const html = cellHtml(toGfmText(t), flavor);
          expect(html).toHaveLength(t.rows.length + 1);
          t.rows.forEach((row, r) => {
            t.columns.forEach(({ key }, c) => {
              const text = row.cells[key];
              if (text === undefined || (c === 0 && markerForm.test(text))) return;
              expect(html[r + 1]![c]).toBe(md.renderInline(text.replaceAll("\n", "<br>")));
              compared++;
            });
          });
        }),
        gfmRuns,
      );
      // Most random tables have cells to compare, so the test is not empty.
      expect(compared).toBeGreaterThan(gfmRuns.numRuns);
    });
  }
});

// Property tests of the conversion of a file: random tables in a random Markdown frame.
// The frame has paragraphs and containers (list items, block quotes) with empty lines around each block.
const fileRuns = { numRuns: 300 };
// A file test parses each text four times, so it gets more time than the default 5 seconds.

/** The first-line prefix and the continuation prefix of a container. */
const container = fc.constantFrom(
  ["", ""],
  ["- ", "  "],
  ["1. ", "   "],
  ["  - ", "    "],
  ["> ", "> "],
  ["> - ", ">   "],
  ["> > ", "> > "],
  ["-\t", " \t"],
);
const paragraph = fc
  .array(fc.constantFrom("Text", "a | b", "*x*", "`c`", "--", "k: v", "1.", "é", " "), { minLength: 1, maxLength: 4 })
  .map((words) => words.join(" ").trim())
  .filter((text) => text !== "" && !/^\d+\.$/.test(text) && !/^[-*]/.test(text));

type Part = { kind: "text"; text: string } | { kind: "table"; table: Table; prefix: [string, string] };
const part: fc.Arbitrary<Part> = fc.oneof(
  paragraph.map((text): Part => ({ kind: "text", text })),
  fc.tuple(gfmTableArb, container).map(([table, prefix]): Part => ({ kind: "table", table, prefix: prefix as [string, string] })),
);
const eolArb = fc.constantFrom("\n", "\r\n", "\r");

/** Writes the parts as a Markdown text, with an empty line between the blocks. Each table is a tbl block or a GFM table. */
function frame(parts: Part[], eol: string, as: "tbl" | "gfm"): string {
  const blocks = parts.map((p) => {
    if (p.kind === "text") return p.text;
    const text = as === "tbl" ? renderBlock(p.table) : toGfmText(p.table);
    const [first, rest] = p.prefix;
    const bare = rest.replace(/[ \t]+$/, "");
    return first + text.split("\n").map((l, i) => (i === 0 ? l : l === "" ? bare : rest + l)).join("\n");
  });
  return blocks.join("\n\n").replaceAll("\n", eol) + eol;
}

/** The text outside the tables, as a list of pieces. */
function frameOf(text: string): string[] {
  const found = findTables(text);
  const pieces: string[] = [];
  let last = 0;
  for (const f of found) {
    pieces.push(text.slice(last, f.start));
    last = f.end;
  }
  pieces.push(text.slice(last));
  return pieces;
}

describe("the laws of the file conversion", () => {
  test("tbl to gfm and back gives the same text, and the frame stays", () => {
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 5 }), eolArb, (parts, eol) => {
        const source = frame(parts, eol, "tbl");
        const there = convert(source, { to: "gfm" });
        if (!there.ok) throw new Error(JSON.stringify(there.errors));
        expect(there.output).toBe(frame(parts, eol, "gfm"));
        expect(there.count).toBe(parts.filter((p) => p.kind === "table").length);
        expect(frameOf(there.output)).toEqual(frameOf(source));
        const back = convert(there.output, { to: "tbl" });
        if (!back.ok) throw new Error(JSON.stringify(back.errors));
        expect(back.output).toBe(source);
      }),
      fileRuns,
    );
  }, 30_000);

  test("gfm to tbl and back gives the same text, and the frame stays", () => {
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 5 }), eolArb, (parts, eol) => {
        const source = frame(parts, eol, "gfm");
        const there = convert(source, { to: "tbl" });
        if (!there.ok) throw new Error(JSON.stringify(there.errors));
        expect(there.output).toBe(frame(parts, eol, "tbl"));
        expect(frameOf(there.output)).toEqual(frameOf(source));
        const back = convert(there.output, { to: "gfm" });
        if (!back.ok) throw new Error(JSON.stringify(back.errors));
        expect(back.output).toBe(source);
      }),
      fileRuns,
    );
  }, 30_000);
});
