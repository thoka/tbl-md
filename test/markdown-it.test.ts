// Unit tests of the pure parts of the markdown-it measurement (corpus/markdown-it-lib.ts, tbl-md step 16).
// They need no network: they use markdown-it with the options of Discourse, without the table feature of Discourse.
// The measurement itself is `mise run corpus-markdown-it`, not part of `mise run test`.
import { describe, expect, test } from "bun:test";
import markdownit from "markdown-it";
import {
  compareTables,
  discourseEngine,
  escapedSplit,
  lineStarts,
  markdownItTables,
  micromarkTables,
  splitRow,
  type DiscourseFeature,
  type SeenTable,
} from "../corpus/markdown-it-lib.ts";

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
    expect(contents("| a | b |")).toEqual(["a", "b"]);
  });
});

describe("lineStarts", () => {
  test("knows LF, CRLF, and CR", () => {
    expect(lineStarts("a\nb\r\nc\rd")).toEqual([0, 2, 5, 7]);
  });
});

describe("markdownItTables", () => {
  const md = discourseEngine({ record: true });
  const cells = (text: string) => markdownItTables(md, text).tables.map((t) => t.rows.map((r) => r.cells));

  test("the recorder changes no output", () => {
    const doc = "| a | b |\n| :-- | --: |\n| `x\\|y` | [l](u) |\n";
    expect(md.render(doc)).toBe(discourseEngine().render(doc));
  });

  test("the cell text comes from the source, and the check finds no mismatch", () => {
    const doc = "| a | b |\n| --- | --- |\n| x\\|y | `c\\\\|d` |\n";
    const result = markdownItTables(md, doc);
    expect(result.mismatches).toEqual([]);
    expect(result.tables[0]!.rows.map((r) => r.cells)).toEqual([
      ["a", "b"],
      ["x\\|y", "`c\\\\|d`"],
    ]);
  });

  test("finds the source in a block quote, in a list item, and with CRLF line ends", () => {
    expect(cells("> | a | b |\n> | - | - |\n> |  c | d |\n")).toEqual([[["a", "b"], ["c", "d"]]]);
    expect(cells("- x\n\n  | a | b |\n  | - | - |\n  | c | d |\n")).toEqual([[["a", "b"], ["c", "d"]]]);
    expect(cells("| a | b |\r\n| - | - |\r\n| c | d |\r\n")).toEqual([[["a", "b"], ["c", "d"]]]);
    expect(markdownItTables(md, "> | a | b |\r\n> | - | - |\r\n> | c | d |\r\n").mismatches).toEqual([]);
  });

  test("gives the alignment and the 1-based lines", () => {
    const [table] = markdownItTables(md, "text\n\n| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n").tables;
    expect(table!.align).toEqual(["left", "center", "right"]);
    expect(table!.line).toBe(3);
    expect(table!.rows.map((r) => r.line)).toEqual([3, 5]);
  });

  test("applies the plugins of a Discourse feature", () => {
    let used = false;
    const feature: DiscourseFeature = {
      setup(helper) {
        helper.allowList(["table"]);
        helper.registerPlugin(() => {
          used = true;
        });
      },
    };
    discourseEngine({ tableFeature: feature });
    expect(used).toBe(true);
  });

  test("uses the options of Discourse: html, breaks, linkify, typographer", () => {
    const engine = discourseEngine();
    expect(engine.options).toMatchObject({ html: true, breaks: true, linkify: true, typographer: true });
    expect(engine.render('"q"')).toBe("<p>“q”</p>\n");
    expect(engine.render("a\nb")).toBe("<p>a<br>\nb</p>\n");
    expect(markdownit().render("a\nb")).toBe("<p>a\nb</p>\n");
  });
});

describe("compareTables", () => {
  const table = (line: number, rows: string[][], align: string[] = rows[0]!.map(() => "")): SeenTable => ({
    line,
    align,
    rows: rows.map((cells, i) => ({ line: line + (i === 0 ? 0 : i + 1), cells })),
  });

  test("pairs by line and reports the kinds", () => {
    const a = [table(1, [["a", "b"], ["x\\", "y"]]), table(10, [["c"]]), table(20, [["d"]], ["left"])];
    const b = [table(1, [["a", "b"], ["x\\|y"]]), table(20, [["d"]], ["right"]), table(30, [["e"]])];
    const { paired, diffs } = compareTables(a, b);
    expect(paired).toBe(2);
    expect(diffs.map((d) => [d.line, d.kinds])).toEqual([
      [1, ["cells", "content"]],
      [10, ["only-micromark"]],
      [20, ["align"]],
      [30, ["only-markdown-it"]],
    ]);
    expect(diffs[0]!.example).toEqual({ line: 3, micromark: ["x\\", "y"], markdownIt: ["x\\|y"] });
  });

  test("micromark and markdown-it differ on a pipe after two backslashes", () => {
    const doc = "| a | b |\n| - | - |\n| x\\\\|y | z |\n";
    const { diffs } = compareTables(micromarkTables(doc), markdownItTables(discourseEngine({ record: true }), doc).tables);
    expect(diffs.map((d) => d.kinds)).toEqual([["cells", "content"]]);
  });
});
