// The engines of the flavors (src/engine.ts), and the statements of docs/format.md (version 0.3.0) about them.
// The flavor `markdown-it` is `markdownit()`. The flavor `discourse` reproduces Discourse with the table feature of
// Discourse. That file is GPL-2.0-only, so it is not in this repository: the tests with it run only when the corpus
// cache has it (corpus/markdown-it-lib.ts, mise run corpus-discourse). The tests without it use the engine of the
// flavor alone, with the link pipe rule of tbl-md (src/discourse.ts).
import { describe, expect, test } from "bun:test";
import markdownit from "markdown-it";
import { cachedTableFeature, discourseEngine, type DiscourseFeature } from "../corpus/markdown-it-lib.ts";
import { linkPipes } from "../src/discourse.ts";
import { createEngine, engineOf } from "../src/engine.ts";
import { FLAVORS } from "../src/flavor.ts";
import { findTables, type FoundGfm } from "../src/markdown.ts";

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
    engineOf("discourse").render("<http://a.com/x%20y>");
    expect(md.utils.lib.mdurl.decode.defaultChars).toBe(before);
  });

  test("the URL decode of a link text keeps the space only with discourse", () => {
    const link = "<http://a.com/x%20y%3Bz%41>";
    expect(createEngine("discourse").renderInline(link)).toBe('<a href="http://a.com/x%20y%3Bz%41">http://a.com/x%20y%3BzA</a>');
    expect(createEngine("markdown-it").renderInline(link)).toBe('<a href="http://a.com/x%20y%3Bz%41">http://a.com/x y%3BzA</a>');
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

  // The cases of docs/format.md, section The link pipe rule of `discourse`, as [row line, HTML of each cell].
  const linkCases: [string, string[]][] = [
    ["| [x|y](https://example.com) | b |", ['<a href="https://example.com">x|y</a>', "b"]],
    ["| [x](https://example.com/a|b) | b |", ['<a href="https://example.com/a%7Cb">x</a>', "b"]],
    ['| [x](https://example.com "t|u") | b |', ['<a href="https://example.com" title="t|u">x</a>', "b"]],
    ["| ![x|100x50](https://example.com/a.png) | b |", ['<img src="https://example.com/a.png" alt="x|100x50">', "b"]],
    ["| [x|y][r] | b |", ["[x|y][r]", "b"]],
    ["| [x|y][] | b |", ["[x|y][]", "b"]],
    ["| [x][r|s] | b |", ["[x][r|s]", "b"]],
    // A shortcut reference is no complete link.
    ["| [x|y] | b |", ["[x", "y]"]],
    // A protected pipe keeps its backslash, so a code span in a link shows it.
    ["| [`x\\|y`](https://example.com) | b |", ['<a href="https://example.com"><code>x\\|y</code></a>', "b"]],
    ["| [`x|y`](https://example.com) | b |", ['<a href="https://example.com"><code>x|y</code></a>', "b"]],
    // A `[` in a code span, an autolink, or after a backslash starts no link.
    ["| `[x|y](u)` | b |", ["`[x", "y](u)`"]],
    ["| \\[x|y](u) | b |", ["[x", "y](u)"]],
    // A link text cannot hold another link: only the inner link is complete.
    ["| [a [b|c](u) d|e](v) | b |", ['[a <a href="u">b|c</a> d', "e](v)"]],
    ["| [x|y] (u) | b |", ["[x", "y] (u)"]],
  ];

  test("the flavor discourse does not split at a pipe in a complete link or image", () => {
    const md = createEngine("discourse");
    for (const [line, cells] of linkCases) expect([line, cellsOf(md, line)]).toEqual([line, cells]);
  });

  test.skipIf(!tableFeature)("the table feature of Discourse gives the same cells for the link cases", () => {
    const md = discourseEngine(tableFeature);
    for (const [line, cells] of linkCases) expect([line, cellsOf(md, line)]).toEqual([line, cells]);
  });

  test("a link pipe in the header row counts no extra column with discourse", () => {
    const doc = "| [a|b](u) | c |\n| - | - |\n| x | y |\n";
    expect(createEngine("discourse").render(doc)).toStartWith('<table>\n<thead>\n<tr>\n<th><a href="u">a|b</a></th>');
    expect(createEngine("markdown-it").render(doc)).not.toContain("<table>");
  });

  test("findTables gives the cells of the engine of each flavor", () => {
    const doc = `${header}| [x|y](u) | \`a|b\` | ![i|1x1](p) |\n`;
    const cells = (flavor: "discourse" | "markdown-it") =>
      (findTables(doc, { flavor })[0] as FoundGfm).rows[0]!.cells.map((c) => [c.text, c.column]);
    expect(cells("discourse")).toEqual([["[x|y](u)", 3], ["`a", 14], ["b`", 17], ["![i|1x1](p)", 22]]);
    expect(cells("markdown-it")).toEqual([["[x", 3], ["y](u)", 6], ["`a", 14], ["b`", 17], ["![i", 22], ["1x1](p)", 26]]);
  });

  test("linkPipes gives the offsets of the kept pipes", () => {
    const md = createEngine("discourse");
    expect([...linkPipes(md, "[a|b](u|v) | c")]).toEqual([2, 7]);
    expect([...linkPipes(md, "a | b")]).toEqual([]);
    expect([...linkPipes(md, "[a|b] | c")]).toEqual([]);
  });

  test.skipIf(!tableFeature)("the table feature of Discourse renders random rows the same as the flavor discourse", () => {
    // A fixed generator, so that a failure repeats. Discourse wraps each table in a div, which is not part of the split.
    const theirs = discourseEngine(tableFeature);
    const ours = createEngine("discourse");
    const atoms = ["[", "]", "(", ")", "![", "|", "|", "\\", "`", "<", ">", "x", " ", '"', "[]", "](u)", "http://a.com", "<a>", "*"];
    let seed = 7;
    const next = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let i = 0; i < 3000; i++) {
      let text = "";
      for (let k = 2 + next(12); k > 0; k--) text += atoms[next(atoms.length)];
      const doc = next(3) === 0 ? `| ${text} | h |\n| - | - |\n| ${text} | b |\n` : `${header}| ${text} | b |\n`;
      const html = theirs.render(doc).replace(/<div class="md-table">\n|<\/div>/g, "");
      expect([doc, ours.render(doc)]).toEqual([doc, html]);
    }
  });
});
