// The engines of the flavors (src/engine.ts), and the statements of docs/format.md (version 0.3.0) about them.
// The flavor `markdown-it` is `markdownit()`. The flavor `discourse` reproduces Discourse with the table feature of
// Discourse. That file is GPL-2.0-only, so it is not in this repository: the tests with it run only when the corpus
// cache has it (corpus/markdown-it-lib.ts). The tests without it use the engine of the flavor alone, which has the
// same table rule except for the link pipes (step 18b).
import { describe, expect, test } from "bun:test";
import markdownit from "markdown-it";
import { cachedTableFeature, discourseEngine, type DiscourseFeature } from "../corpus/markdown-it-lib.ts";
import { createEngine, engineOf } from "../src/engine.ts";
import { FLAVORS } from "../src/flavor.ts";

const tableFeature = await cachedTableFeature();

describe("the engines of the flavors", () => {
  test("discourse has the options of Discourse: html, breaks, linkify, typographer, the quotes, and the TLDs", () => {
    const md = createEngine("discourse");
    expect(md.options).toMatchObject({ html: true, xhtmlOut: false, breaks: true, linkify: true, typographer: true });
    expect(md.render('"q" \'s\'')).toBe("<p>“q” ‘s’</p>\n");
    expect(md.render("a\nb")).toBe("<p>a<br>\nb</p>\n");
    expect(md.render("see example.de and example.xyz")).toBe('<p>see <a href="http://example.de">example.de</a> and example.xyz</p>\n');
  });

  test("markdown-it has the default options of markdownit()", () => {
    const md = createEngine("markdown-it");
    expect(md.options).toEqual(markdownit().options);
    expect(md.render("a\nb <br>")).toBe("<p>a\nb &lt;br&gt;</p>\n");
  });

  test("engineOf caches one engine per flavor, and its recorders change no output", () => {
    const doc = '| a | b |\n| :-- | --: |\n| `x\\|y` | [l](u) |\n\n```tbl\na: "A"\n```\n> | c |\n> | - |\n';
    for (const flavor of FLAVORS) {
      expect(engineOf(flavor)).toBe(engineOf(flavor));
      expect(engineOf(flavor).render(doc)).toBe(createEngine(flavor).render(doc));
    }
  });

  test("an engine does not change the URL decode characters of the shared mdurl module", () => {
    const md = createEngine("discourse");
    const before = md.utils.lib.mdurl.decode.defaultChars;
    engineOf("discourse");
    expect(md.utils.lib.mdurl.decode.defaultChars).toBe(before);
  });

  test("discourseEngine applies the plugins of a Discourse feature", () => {
    let used = false;
    const feature: DiscourseFeature = {
      setup(helper) {
        helper.allowList(["table"]);
        helper.registerPlugin(() => {
          used = true;
        });
      },
    };
    discourseEngine(feature);
    expect(used).toBe(true);
  });
});

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
    ["discourse without the table feature", createEngine("discourse")],
    ["markdown-it", createEngine("markdown-it")],
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
    const discourse = discourseEngine(tableFeature);
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
  const plain = createEngine("markdown-it");

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
    const md = discourseEngine(tableFeature);
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
