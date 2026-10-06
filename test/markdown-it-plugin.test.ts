// Tests of the markdown-it plugin (src/markdown-it.ts): the token stream, the HTML with the engine of each flavor,
// the attributes and their hook, an invalid block, the order of the core rules, and the single-file bundle.
import { beforeAll, describe, expect, test } from "bun:test";
import fc from "fast-check";
import markdownit from "markdown-it";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { bundle, ENTRY, GLOBAL_NAME } from "../scripts/bundle.ts";
import { createEngine } from "../src/engine.ts";
import { FLAVORS } from "../src/flavor.ts";
import { keysFromTitles, renderBlock, toGfm, type Attributes, type Column, type Row, type Table } from "../src/index.ts";
import tblPlugin, { type TblOpenMeta, type TblPlace, type TblPluginError, type TblPluginOptions } from "../src/markdown-it.ts";

const ROOT = resolve(import.meta.dir, "..");

/** `markdownit()` with the plugin. */
function plain(options?: TblPluginOptions) {
  return markdownit().use(tblPlugin, options);
}

/** The engine of the flavor `discourse` with the plugin. */
function discourse(options?: TblPluginOptions) {
  return createEngine("discourse").use(tblPlugin, options);
}

const BLOCK = [
  "```tbl",
  "model: Model",
  "{#c1 .m}",
  "price: Price",
  "{align=right}",
  "-- {#r1 .new}",
  "m: *Opus*",
  "second line",
  "{.top}",
  "p: $15",
  "--",
  "m: Haiku",
  "```",
  "",
].join("\n");

const BLOCK_HTML = `<table>
<thead>
<tr>
<th id="c1" class="m">Model</th>
<th style="text-align:right">Price</th>
</tr>
</thead>
<tbody>
<tr id="r1" class="new">
<td class="m top"><em>Opus</em><br>
second line</td>
<td style="text-align:right">$15</td>
</tr>
<tr>
<td class="m">Haiku</td>
<td style="text-align:right"></td>
</tr>
</tbody>
</table>
`;

describe("the token stream", () => {
  test("a valid block becomes tbl_open, the table tokens, and tbl_close, each with the map of the fence", () => {
    const tokens = plain().parse(`Intro\n\n${BLOCK}`, {});
    const types = tokens.map((t) => t.type);
    expect(types).toEqual([
      "paragraph_open", "inline", "paragraph_close",
      "tbl_open", "table_open",
      "thead_open", "tr_open", "th_open", "inline", "th_close", "th_open", "inline", "th_close", "tr_close", "thead_close",
      "tbody_open",
      "tr_open", "td_open", "inline", "td_close", "td_open", "inline", "td_close", "tr_close",
      "tr_open", "td_open", "inline", "td_close", "td_open", "inline", "td_close", "tr_close",
      "tbody_close", "table_close", "tbl_close",
    ]);
    const block = tokens.slice(3);
    for (const token of block) {
      expect(token.map).toEqual([2, 15]);
      expect(token.block).toBe(true);
    }
    expect(block.map((t) => [t.tag, t.nesting]).slice(0, 4)).toEqual([["", 1], ["table", 1], ["thead", 1], ["tr", 1]]);
    expect(block.at(-1)!.nesting).toBe(-1);
    // The levels nest as in a token stream of the block parser.
    expect(block.map((t) => t.level).slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 4]);
    expect(block.at(-1)!.level).toBe(0);

    const open = block[0]!;
    expect(open.markup).toBe("```");
    expect(open.info).toBe("tbl");
    const meta = open.meta as unknown as TblOpenMeta;
    expect(meta.source).toBe(BLOCK.split("\n").slice(1, -2).join("\n"));
    expect(meta.table.columns.map((c) => c.key)).toEqual(["model", "price"]);
    expect(meta.table.rows).toHaveLength(2);

    const th = block[4]!;
    expect(th.attrs).toEqual([["id", "c1"], ["class", "m"]]);
    const inlines = block.filter((t) => t.type === "inline");
    expect(inlines.map((t) => t.content)).toEqual(["Model", "Price", "*Opus*\nsecond line", "$15", "Haiku", ""]);
    // The core rule inline parsed each cell with the inline rules of the engine.
    expect(inlines[2]!.children!.map((c) => c.type)).toEqual(["em_open", "text", "em_close", "hardbreak", "text"]);
  });

  test("a table with no rows has no tbody", () => {
    const types = plain().parse("```tbl\na: A\n```\n", {}).map((t) => t.type);
    expect(types).not.toContain("tbody_open");
    expect(types).toEqual(["tbl_open", "table_open", "thead_open", "tr_open", "th_open", "inline", "th_close", "tr_close", "thead_close", "table_close", "tbl_close"]);
  });

  test("renderInline and a text with no fence do not change", () => {
    const md = plain();
    expect(md.renderInline("a *b*")).toBe("a <em>b</em>");
    expect(md.render("a\nb")).toBe("<p>a\nb</p>\n");
  });
});

describe("the HTML", () => {
  for (const [name, engine] of [["markdown-it", plain], ["discourse", discourse]] as const) {
    test(`with the engine of the flavor ${name}`, () => {
      expect(engine().render(BLOCK)).toBe(BLOCK_HTML);
    });
  }

  test("a line break of a cell is a <br> also with breaks: false, and a line break outside a cell stays", () => {
    const md = plain();
    expect(md.options.breaks).toBe(false);
    expect(md.render("a\nb\n\n```tbl\na: A\n--\na: x\ny\n```\n")).toBe(
      "<p>a\nb</p>\n<table>\n<thead>\n<tr>\n<th>A</th>\n</tr>\n</thead>\n<tbody>\n<tr>\n<td>x<br>\ny</td>\n</tr>\n</tbody>\n</table>\n",
    );
  });

  test("a missing cell is an empty td, and an escaped line is text (rule 10)", () => {
    const html = plain().render("```tbl\na: A\nb: B\n--\nb: x\n\\--\nk\\: v\n```\n");
    expect(html).toContain("<tr>\n<td></td>\n<td>x<br>\n--<br>\nk: v</td>\n</tr>");
  });

  test("a block in a list item, in a block quote, and with a tilde fence", () => {
    const md = plain();
    expect(md.render("- ```tbl\n  a: A\n  ```\n")).toBe("<ul>\n<li>\n<table>\n<thead>\n<tr>\n<th>A</th>\n</tr>\n</thead>\n</table>\n</li>\n</ul>\n");
    expect(md.render("> ```tbl\n> a: A\n> ```\n")).toBe("<blockquote>\n<table>\n<thead>\n<tr>\n<th>A</th>\n</tr>\n</thead>\n</table>\n</blockquote>\n");
    expect(md.render("~~~tbl\na: A\n~~~\n")).toBe("<table>\n<thead>\n<tr>\n<th>A</th>\n</tr>\n</thead>\n</table>\n");
  });

  test("a fence with the info TBL or tbl-x is no tbl block and gets no errors", () => {
    const md = plain();
    for (const info of ["TBL", "tbl-x"]) {
      const tokens = md.parse(`\`\`\`${info}\na: A\n\`\`\`\n`, {});
      expect(tokens.map((t) => t.type)).toEqual(["fence"]);
      expect(tokens[0]!.meta).toBeNull();
    }
  });

  test("a host can set the renderer rules of tbl_open and tbl_close", () => {
    const md = plain();
    md.renderer.rules.tbl_open = () => '<div class="tbl">\n';
    md.renderer.rules.tbl_close = () => "</div>\n";
    expect(md.render("```tbl\na: A\n```\n")).toStartWith('<div class="tbl">\n<table>');
    // A rule that the host set before the plugin stays.
    const before = markdownit();
    before.renderer.rules.tbl_open = () => "<section>";
    before.use(tblPlugin);
    expect(before.render("```tbl\na: A\n```\n")).toStartWith("<section><table>");
  });
});

describe("the attributes", () => {
  const html = (block: string, options?: TblPluginOptions) => plain(options).render(`\`\`\`tbl\n${block}\n\`\`\`\n`);

  test("a pair becomes a data attribute with the key in lower case, on the th, the tr, and the td", () => {
    const out = html("a: A\n{Owner=me}\n-- {state=open}\na: x\n{n=1}");
    expect(out).toContain('<th data-owner="me">A</th>');
    expect(out).toContain('<tr data-state="open">');
    expect(out).toContain('<td data-n="1">x</td>');
  });

  test("the ID and the pairs of a column go only to its th, its classes also to each td", () => {
    const out = html("a: A\n{#ca .wide k=v align=center}\n--\na: x\n{#x1 .c}");
    expect(out).toContain('<th style="text-align:center" id="ca" class="wide" data-k="v">A</th>');
    expect(out).toContain('<td style="text-align:center" class="wide c" id="x1">x</td>');
  });

  test("a class of a cell that the column has already comes once", () => {
    expect(html("a: A\n{.w}\n--\na: x\n{.w .z}")).toContain('<td class="w z">x</td>');
  });

  test("two keys that differ only in case give one data attribute, and the later pair wins", () => {
    expect(html("a: A\n--\na: x\n{Note=first note=second}")).toContain('<td data-note="second">x</td>');
  });

  test("the renderer escapes each value, and no key becomes a plain attribute", () => {
    const out = html('a: A\n-- {onclick=x style="color:red"}\na: x\n{title="a\\"<b>&"}');
    expect(out).toContain('<tr data-onclick="x" data-style="color:red">');
    expect(out).toContain('<td data-title="a&quot;&lt;b&gt;&amp;">x</td>');
    expect(out).not.toContain(" onclick=");
  });

  test("raw HTML in a cell stays text with html: false, as in a paragraph", () => {
    expect(html("a: <script>alert(1)</script>\n--\na: <img src=x onerror=y>")).toContain(
      "<th>&lt;script&gt;alert(1)&lt;/script&gt;</th>",
    );
    expect(html("a: A\n--\na: <img src=x onerror=y>")).toContain("<td>&lt;img src=x onerror=y&gt;</td>");
  });
});

describe("the attributes hook", () => {
  test("it gets each column, row, and cell with its place, with no align, also with no attributes", () => {
    const calls: [TblPlace, Attributes][] = [];
    plain({
      attributes: (attributes, place) => {
        calls.push([place, structuredClone(attributes)]);
        return attributes;
      },
    }).render("```tbl\na: A\n{align=right .r}\nb: B\n--\na: x\n{k=v}\n-- {#r2}\nb: y\n```\n");
    expect(calls).toEqual([
      [{ kind: "column", key: "a" }, { classes: ["r"], pairs: [] }],
      [{ kind: "column", key: "b" }, { classes: [], pairs: [] }],
      [{ kind: "row", row: 1 }, { classes: [], pairs: [] }],
      [{ kind: "cell", key: "a", row: 1 }, { classes: [], pairs: [{ key: "k", value: "v" }] }],
      [{ kind: "cell", key: "b", row: 1 }, { classes: [], pairs: [] }],
      [{ kind: "row", row: 2 }, { id: "r2", classes: [], pairs: [] }],
      [{ kind: "cell", key: "a", row: 2 }, { classes: [], pairs: [] }],
      [{ kind: "cell", key: "b", row: 2 }, { classes: [], pairs: [] }],
    ]);
  });

  test("it can add a prefix to each ID, drop the pairs, and drop all attributes of a place; align stays", () => {
    const out = plain({
      attributes: (attributes, place) => {
        if (place.kind === "row") return null;
        if (attributes.id !== undefined) attributes.id = `tbl-${attributes.id}`;
        attributes.pairs = [];
        return attributes;
      },
    }).render("```tbl\na: A\n{#c align=right k=v}\n-- {#r .x}\na: x\n{#d}\n```\n");
    expect(out).toContain('<th style="text-align:right" id="tbl-c">A</th>');
    expect(out).toContain("<tr>\n");
    expect(out).toContain('<td style="text-align:right" id="tbl-d">x</td>');
    expect(out).not.toContain("data-");
  });

  test("an align pair from the hook is no attribute", () => {
    const out = plain({ attributes: (attributes) => ({ ...attributes, pairs: [{ key: "align", value: "left" }] }) }).render(
      "```tbl\na: A\n--\na: x\n```\n",
    );
    expect(out).not.toContain("align");
  });

  test("a key from the hook that does not have the key form throws", () => {
    const md = plain({ attributes: () => ({ classes: [], pairs: [{ key: 'x" onclick="y', value: "1" }] }) });
    expect(() => md.render("```tbl\na: A\n```\n")).toThrow('tbl-md: the attributes hook gave the key "x" onclick="y".');
  });
});

describe("an invalid block", () => {
  test("stays the fence token, with the errors of parse in meta.tblErrors and no error in the HTML", () => {
    const md = plain();
    const source = "```tbl\na: A\n--\nb: x\n```\n";
    const tokens = md.parse(source, {});
    expect(tokens.map((t) => t.type)).toEqual(["fence"]);
    const errors = (tokens[0]!.meta as { tblErrors: TblPluginError[] }).tblErrors;
    expect(errors).toEqual([{ line: 3, column: 1, code: "unknown-key", message: expect.stringContaining('The key "b" matches no header key') }]);
    expect(md.render(source)).toBe(markdownit().render(source));
  });

  test("a fence with text after tbl stays the fence token with the error info-text at line 0, also for a valid table", () => {
    const md = discourse();
    const source = "```tbl x\na: A\n```\n";
    const tokens = md.parse(source, {});
    expect(tokens.map((t) => t.type)).toEqual(["fence"]);
    expect((tokens[0]!.meta as { tblErrors: TblPluginError[] }).tblErrors).toEqual([
      { line: 0, column: 1, code: "info-text", message: 'The info string has text after `tbl`: "x". The info string must be exactly `tbl`.' },
    ]);
    expect(md.render(source)).toBe(createEngine("discourse").render(source));
  });

  test("keeps the meta that another rule gave the fence token", () => {
    const md = plain();
    md.core.ruler.after("block", "mark", (state) => {
      for (const token of state.tokens) token.meta = { mark: 1 };
    });
    const tokens = md.parse("```tbl\n```\n", {});
    expect(tokens[0]!.meta).toMatchObject({ mark: 1, tblErrors: [{ code: "no-header" }] });
  });
});

describe("the order of the core rules", () => {
  test("the plugin reads the fence content after each core rule of the host that comes after the block parse", () => {
    // This stands in for the link pipe restore of Discourse, a core rule after `block` that changes `token.content`.
    // The host adds its rule after the plugin, as a feature that loads later does.
    const md = plain();
    md.core.ruler.after("block", "restore", (state) => {
      for (const token of state.tokens) if (token.type === "fence") token.content = token.content.replaceAll("PIPE", "|");
    });
    expect(md.render("```tbl\na: A\n--\na: xPIPEy\n```\n")).toContain("<td>x|y</td>");
    const names = (md.core.ruler as unknown as { __rules__: { name: string }[] }).__rules__.map((r) => r.name);
    expect(names.indexOf("tbl")).toBe(names.indexOf("inline") - 1);
    expect(names.indexOf("tbl_breaks")).toBe(names.indexOf("inline") + 1);
  });
});

// The law: for a table with no line breaks and with no attribute other than `align`, the plugin HTML of its tbl block
// equals the HTML of its GFM table from toGfm, with the same engine. The pieces are those of the meaning law in
// test/laws.test.ts: no `<br>` (a literal `<br>` gets a backslash in GFM on purpose) and no row ID.
const pieces = ["a", "B", "r", " ", "\t", " ", "\\", "|", "\\|", "\\\\|", "<", ">", "{", "#", "}", "`", "*", "é", ":", "-", "&amp;", "[a](b)"];
const text = fc.array(fc.constantFrom(...pieces), { maxLength: 7 }).map((p) => p.join(""));
/** True if toGfm can convert the text: no character of the trim at an edge, as in test/laws.test.ts. */
const convertible = (value: string) => !/^\s|\s$/.test(value);
// A first cell that ends with the ID marker form gets a backslash in GFM on purpose, and in a code span the backslash shows.
const markerForm = /(^| )\\*\{#[A-Za-z0-9_-]+\}$/;
const alignTableArb: fc.Arbitrary<Table> = fc
  .array(fc.tuple(text.filter(convertible), fc.option(fc.constantFrom("left", "center", "right"), { nil: undefined })), { minLength: 1, maxLength: 4 })
  .chain((parts) => {
    const keys = keysFromTitles(parts.map(([title]) => title));
    const columns: Column[] = parts.map(([title, align], i) => {
      const column: Column = { key: keys[i]!, title };
      if (align !== undefined) column.attributes = { classes: [], pairs: [{ key: "align", value: align }] };
      return column;
    });
    const cell = fc.option(fc.tuple(fc.constantFrom("a", "B"), text).map(([first, rest]) => first + rest).filter(convertible), { nil: undefined });
    const row = fc.tuple(...keys.map(() => cell)).map((texts): Row => {
      const cells: Record<string, string> = {};
      texts.forEach((value, i) => {
        if (value !== undefined) cells[keys[i]!] = value;
      });
      return { cells };
    });
    return fc.record({ columns: fc.constant(columns), rows: fc.array(row, { maxLength: 3 }) });
  })
  .filter((t) => t.rows.every((row) => !markerForm.test(row.cells[t.columns[0]!.key] ?? "")));

describe("the law of the GFM view", () => {
  for (const flavor of FLAVORS) {
    test(`the plugin HTML of a table with only align equals the HTML of its GFM table, with the flavor ${flavor}`, () => {
      const md = createEngine(flavor).use(tblPlugin);
      fc.assert(
        fc.property(alignTableArb, (t) => {
          const gfm = toGfm(t);
          if (!gfm.ok) throw new Error(JSON.stringify(gfm.errors));
          expect(md.render(`${renderBlock(t)}\n`)).toBe(md.render(`${gfm.text}\n`));
        }),
        { numRuns: 300 },
      );
    });
  }
});

describe("the single-file bundle", () => {
  let code = "";
  beforeAll(async () => {
    code = await bundle(join(ROOT, ENTRY));
  });

  test("has no import, no require, and no node: module", () => {
    expect(code).not.toMatch(/\bimport\s*[("'{*]|\bimport\s+\w|\bfrom\s*["']|\brequire\(|node:/);
    expect(code.length).toBeLessThan(20_000);
  });

  test("runs in an empty context with no require, process, window, or module, and renders a block", () => {
    const context = createContext({});
    runInContext(code, context);
    const global = (context as Record<string, { default: typeof tblPlugin }>)[GLOBAL_NAME]!;
    expect(typeof global.default).toBe("function");
    expect(markdownit().use(global.default).render(BLOCK)).toBe(BLOCK_HTML);
  });

  test("the build fails on a node: import, so a change of the options cannot remove the check", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tbl-md-bundle-"));
    try {
      const entry = join(dir, "entry.ts");
      writeFileSync(entry, 'import { readFileSync } from "node:fs";\nexport default readFileSync;\n');
      await expect(bundle(entry)).rejects.toThrow('Could not resolve "node:fs"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
