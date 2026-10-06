// Unit tests of the pure parts of the markdown-it measurement (corpus/markdown-it-lib.ts, tbl-md step 16).
// They need no network: they use markdown-it with the options of Discourse, without the table feature of Discourse.
// The measurement itself is `mise run corpus-markdown-it`, not part of `mise run test`.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import markdownit from "markdown-it";
import { cachePath, cacheRoot } from "../corpus/lib.ts";
import {
  compareTables,
  DISCOURSE,
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

// The statements of docs/format.md (version 0.3.0) about the two flavors. The flavor `markdown-it` is `markdownit()`.
// The flavor `discourse` is discourseEngine() with the table feature of Discourse. That file is GPL-2.0-only, so it is
// not in this repository: the tests with it run only when `mise run corpus-markdown-it` put it into the cache.
// The tests without it use discourseEngine() alone, which has the same table rule except for the link pipes.

async function cachedTableFeature(): Promise<DiscourseFeature | undefined> {
  const place = cachePath(cacheRoot(), DISCOURSE.repo, DISCOURSE.commit, DISCOURSE.tablePath);
  if (!existsSync(place)) return undefined;
  if (createHash("sha256").update(readFileSync(place)).digest("hex") !== DISCOURSE.tableSha256) return undefined;
  return (await import(pathToFileURL(place).href)) as DiscourseFeature;
}

const tableFeature = await cachedTableFeature();

/** The HTML of each body cell of the first table, or null if the text has no table. */
function bodyCells(html: string): string[][] | null {
  const table = /<table>[\s\S]*?<\/table>/.exec(html);
  if (!table) return null;
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table[0]);
  if (!body) return [];
  return [...body[1]!.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((tr) => [...tr[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => td[1]!));
}

describe("format.md: where a new GFM table can stand", () => {
  // The GFM text of a converted tbl block with one column and one row.
  const table = "| A |\n| --- |\n| x |\n";
  const quoted = (prefix: string) => table.replace(/^/gm, prefix).slice(0, -prefix.length);
  const engines = [
    ["discourse without the table feature", discourseEngine()],
    ["markdown-it", markdownit()],
  ] as const;

  for (const [name, md] of engines) {
    describe(name, () => {
      const rows = (doc: string) => bodyCells(md.render(doc));

      test("directly after a paragraph line: the table interrupts the paragraph", () => {
        expect(md.render(`text\n${table}`)).toStartWith("<p>text</p>\n<table>");
        expect(rows(`text\n${table}`)).toEqual([["x"]]);
      });

      test("directly after a paragraph line of a list item or a block quote: the table lines are lazy lines, no table", () => {
        expect(rows(`- item\n${table}`)).toBeNull();
        expect(rows(`> quote\n${table}`)).toBeNull();
        expect(rows(`1. item\n${table}`)).toBeNull();
      });

      test("directly before a paragraph line: the line is a row", () => {
        expect(rows(`${table}text\n`)).toEqual([["x"], ["text"]]);
      });

      test("directly before a line of the same list item or block quote: the line is a row", () => {
        expect(rows(`- ${quoted("  ").slice(2)}  text\n`)).toEqual([["x"], ["text"]]);
        expect(rows(`${quoted("> ")}> text\n`)).toEqual([["x"], ["text"]]);
      });

      test("directly before a lazy line after a list item or a block quote: the line stays outside", () => {
        expect(rows(`${quoted("> ")}lazy\n`)).toEqual([["x"]]);
        expect(md.render(`${quoted("> ")}lazy\n`)).toEndWith("</blockquote>\n<p>lazy</p>\n");
        expect(rows(`- ${quoted("  ").slice(2)}lazy\n`)).toEqual([["x"]]);
        expect(md.render(`- ${quoted("  ").slice(2)}lazy\n`)).toEndWith("</ul>\n<p>lazy</p>\n");
      });

      test("directly before another block: the block ends the table", () => {
        for (const block of ["# H", "- item", "1. item", "> quote", "```\ncode\n```", "***", "    code"]) {
          expect(rows(`${table}${block}\n`)).toEqual([["x"]]);
        }
      });

      test("directly before an HTML block: it ends the table only with the option html", () => {
        expect(rows(`${table}<div>\n`)).toEqual(md.options.html ? [["x"]] : [["x"], ["&lt;div&gt;"]]);
      });

      test("directly before a GFM table: its lines are rows", () => {
        expect(rows(`${table}| X |\n| - |\n`)).toEqual([["x"], ["X"], ["-"]]);
      });

      test("a heading with a pipe directly before the table stays a heading", () => {
        expect(md.render(`# a | b\n${table}`)).toStartWith("<h1>a | b</h1>\n<table>");
      });

      test("a header line with no pipe gives no table", () => {
        expect(rows("h1\n| --- |\n| a |\n")).toBeNull();
        expect(rows("h1\n:-:\na\n")).toBeNull();
      });

      test("a line that starts with # or a list marker can be the header row", () => {
        expect(md.render("# | h2\n--|--\na | b\n")).toStartWith("<table>\n<thead>\n<tr>\n<th>#</th>");
        expect(md.render("-   h1|h2\n---|---\na|b\n")).toStartWith("<table>\n<thead>\n<tr>\n<th>-   h1</th>");
      });
    });
  }

  test.skipIf(!tableFeature)("the table feature of Discourse gives the same results for these cases", () => {
    const plain = discourseEngine();
    const discourse = discourseEngine({ tableFeature });
    const docs = [
      `text\n${table}`,
      `- item\n${table}`,
      `${table}text\n`,
      `${quoted("> ")}> text\n`,
      `${quoted("> ")}lazy\n`,
      `${table}# H\n`,
      `${table}| X |\n| - |\n`,
      "h1\n| --- |\n| a |\n",
      "# | h2\n--|--\na | b\n",
    ];
    for (const doc of docs) expect(bodyCells(discourse.render(doc))).toEqual(bodyCells(plain.render(doc)));
  });
});

describe("format.md: how markdown-it splits a GFM row", () => {
  const header = "| h1 | h2 |\n| --- | --- |\n";
  const cellsOf = (md: { render(text: string): string }, line: string) => bodyCells(md.render(`${header}${line}\n`))![0];
  const plain = markdownit();

  test("a pipe after one, two, or three backslashes never splits, and the cell loses one backslash", () => {
    expect(cellsOf(plain, "| x\\|y | b |")).toEqual(["x|y", "b"]);
    expect(cellsOf(plain, "| x\\\\|y | b |")).toEqual(["x|y", "b"]);
    expect(cellsOf(plain, "| x\\\\\\|y | b |")).toEqual(["x\\|y", "b"]);
    expect(cellsOf(plain, "| `x\\|y` | b |")).toEqual(["<code>x|y</code>", "b"]);
    expect(cellsOf(plain, "| `x\\\\|y` | b |")).toEqual(["<code>x\\|y</code>", "b"]);
  });

  test("a code span gives no protection", () => {
    expect(cellsOf(plain, "| `x|y` | b |")).toEqual(["`x", "y`"]);
  });

  test("the trim removes each Unicode space, also U+00A0", () => {
    expect(cellsOf(plain, "| a | b |")).toEqual(["a", "b"]);
  });

  test("the flavor markdown-it splits at a pipe in a link or an image", () => {
    expect(cellsOf(plain, "| [x|y](https://example.com) | b |")).toEqual(["[x", "y](https://example.com)"]);
    expect(cellsOf(plain, "| ![x|100x50](https://example.com/a.png) | b |")).toEqual(["![x", "100x50](https://example.com/a.png)"]);
  });

  test.skipIf(!tableFeature)("the flavor discourse does not split at a pipe in a complete link or image", () => {
    const md = discourseEngine({ tableFeature });
    expect(cellsOf(md, "| [x|y](https://example.com) | b |")).toEqual(['<a href="https://example.com">x|y</a>', "b"]);
    expect(cellsOf(md, "| [x](https://example.com/a|b) | b |")).toEqual(['<a href="https://example.com/a%7Cb">x</a>', "b"]);
    expect(cellsOf(md, "| ![x|100x50](https://example.com/a.png) | b |")).toEqual(['<img src="https://example.com/a.png" alt="x|100x50">', "b"]);
    expect(cellsOf(md, "| [x|y][r] | b |")).toEqual(["[x|y][r]", "b"]);
    // A shortcut reference is no complete link.
    expect(cellsOf(md, "| [x|y] | b |")).toEqual(["[x", "y]"]);
    // A protected pipe keeps its backslash, so a code span in a link shows it.
    expect(cellsOf(md, "| [`x\\|y`](https://example.com) | b |")).toEqual(['<a href="https://example.com"><code>x\\|y</code></a>', "b"]);
    expect(cellsOf(md, "| [`x|y`](https://example.com) | b |")).toEqual(['<a href="https://example.com"><code>x|y</code></a>', "b"]);
  });
});
