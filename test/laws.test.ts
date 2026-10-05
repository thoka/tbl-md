// Property tests of the two laws of the renderer, on random valid tables:
// parse(render(T)) gives T back, and render(parse(render(T)).table) is render(T).
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { parse, render, renderBlock, validate, type Row, type Table } from "../src/index.ts";

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
