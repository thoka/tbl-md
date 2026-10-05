// Property tests of the two laws of the renderer, on random valid tables:
// parse(render(T)) gives T back, and render(parse(render(T)).table) is render(T).
// The second part checks the laws of the GFM conversion.
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import type { Paragraph } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import {
  findTables,
  fromGfm,
  keysFromTitles,
  parse,
  render,
  renderBlock,
  toGfm,
  validate,
  type FoundGfm,
  type Row,
  type Table,
} from "../src/index.ts";

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

const tableArb: fc.Arbitrary<Table> = fc
  .uniqueArray(key, { minLength: 1, maxLength: 4 })
  .chain((keys) =>
    fc.record({
      columns: fc.tuple(...keys.map((k) => line.map((title) => ({ key: k, title })))),
      rows: fc.array(
        fc
          .tuple(fc.option(id, { nil: undefined }), fc.tuple(...keys.map(() => fc.option(cellText, { nil: undefined }))))
          .map(([rowId, texts]) => {
            const cells: Record<string, string> = {};
            texts.forEach((text, i) => {
              if (text !== undefined) cells[keys[i]!] = text;
            });
            const row: Row = { cells };
            if (rowId !== undefined) row.id = rowId;
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
const plainPieces = ["a", "B", "r", " ", "\t", "\\", "|", "\\\\|", "<", ">", "{", "#", "}", "`", "*", "é", ":", "-", "&amp;", "[a](b)"];
const piece = fc.constantFrom(...plainPieces, "<br>", "{#x}");
const gfmLine = fc.array(piece, { maxLength: 7 }).map((p) => p.join(""));

/** True if toGfm can convert the text: no space or tab at an edge, no pipe after an odd backslash run, no backslash before a line break. */
function convertible(text: string): boolean {
  if (/^[ \t]|[ \t]$/.test(text)) return false;
  if (/\\\n/.test(text)) return false;
  for (const m of text.matchAll(/(\\*)\|/g)) if (m[1]!.length % 2 === 1) return false;
  return true;
}

const gfmTitle = gfmLine.filter(convertible);
const gfmCell = fc
  .array(gfmLine, { minLength: 1, maxLength: 3 })
  .map((lines) => {
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  })
  .filter((text) => text !== "" && convertible(text));

const gfmTableArb: fc.Arbitrary<Table> = fc.array(gfmTitle, { minLength: 1, maxLength: 4 }).chain((titles) => {
  const keys = keysFromTitles(titles);
  return fc.record({
    columns: fc.constant(titles.map((title, i) => ({ key: keys[i]!, title }))),
    rows: fc.array(
      fc
        .tuple(fc.option(id, { nil: undefined }), fc.tuple(...keys.map(() => fc.option(gfmCell, { nil: undefined }))))
        .map(([rowId, texts]) => {
          const cells: Record<string, string> = {};
          texts.forEach((text, i) => {
            if (text !== undefined) cells[keys[i]!] = text;
          });
          const row: Row = { cells };
          if (rowId !== undefined) row.id = rowId;
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

function onlyGfm(text: string): FoundGfm {
  const found = findTables(text);
  expect(found.map((f) => f.kind)).toEqual(["gfm"]);
  return found[0] as FoundGfm;
}

/** Removes the positions of an mdast tree, so that two trees compare by content. */
function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (node === null || typeof node !== "object") return node;
  const { position: _, ...rest } = node as Record<string, unknown>;
  return Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, strip(v)]));
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
        const node = onlyGfm(toGfmText(t)).node;
        expect(node.children).toHaveLength(t.rows.length + 1);
        for (const row of node.children) expect(row.children).toHaveLength(t.columns.length);
      }),
      gfmRuns,
    );
  });

  // The meaning test: the inline mdast of each GFM cell equals the mdast of the paragraph
  // that the tbl cell text gives, with each line break written as `<br>`. Both trees have no positions.
  // Its tables have no literal `<br>` (it gets a backslash on purpose) and no row ID.
  // It skips a first cell with the marker form, which gets a backslash on purpose.
  // A cell text starts with a letter, so that it parses as a paragraph and not as another block.
  test("a GFM cell has the same inline Markdown as the tbl cell", () => {
    const markerForm = /(^| )\\*\{#[A-Za-z0-9_-]+\}$/;
    let compared = 0;
    fc.assert(
      fc.property(meaningTableArb, (t) => {
        const node = onlyGfm(toGfmText(t)).node;
        t.rows.forEach((row, r) => {
          t.columns.forEach(({ key }, c) => {
            const text = row.cells[key];
            if (text === undefined || (c === 0 && markerForm.test(text))) return;
            const paragraph = fromMarkdown(text.replaceAll("\n", "<br>")).children;
            expect(paragraph.map((n) => n.type)).toEqual(["paragraph"]);
            const expected = strip((paragraph[0] as Paragraph).children);
            expect(strip(node.children[r + 1]!.children[c]!.children)).toStrictEqual(expected);
            compared++;
          });
        });
      }),
      gfmRuns,
    );
    // Most random tables have cells to compare, so the test is not empty.
    expect(compared).toBeGreaterThan(gfmRuns.numRuns);
  });
});
