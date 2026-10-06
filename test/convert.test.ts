import { describe, expect, test } from "bun:test";
import { convert, findTables, type ConvertResult } from "../src/index.ts";

function output(result: ConvertResult): string {
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.output;
}

function errors(result: ConvertResult) {
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  expect("output" in result).toBe(false);
  return result.errors;
}

/** Checks that the text before and after the range of each table stays the same, byte for byte. */
function keepsFrame(source: string, out: string) {
  const before = findTables(source);
  const after = findTables(out);
  expect(after.length).toBe(before.length);
  expect(out.slice(0, after[0]?.start ?? out.length)).toBe(source.slice(0, before[0]?.start ?? source.length));
  before.forEach((f, i) => {
    const nextBefore = before[i + 1]?.start ?? source.length;
    const nextAfter = after[i + 1]?.start ?? out.length;
    expect(out.slice(after[i]!.end, nextAfter)).toBe(source.slice(f.end, nextBefore));
  });
}

const gfm = "| Model | Price |\n| --- | --- |\n| Opus | $15 |";
const tbl = "```tbl\nmodel: Model\nprice: Price\n--\nmodel: Opus\nprice: $15\n```";
/** Writes each line after the first with the prefix. */
const indent = (text: string, prefix: string) => text.replaceAll("\n", `\n${prefix}`);

describe("convert: places of a table", () => {
  test("a table at top level", () => {
    const source = `# Title\n\n${gfm}\n\ntail\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`# Title\n\n${tbl}\n\ntail\n`);
    keepsFrame(source, out);
    expect(output(convert(out, { to: "gfm" }))).toBe(source);
  });

  test("a table with spaces and tabs after the last pipe of each row", () => {
    const source = "| Model | Price | \n| --- | --- |\t\n| Opus | $15 | \n\ntail\n";
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`${tbl}\n\ntail\n`);
    expect(output(convert(out, { to: "gfm" }))).toBe(`${gfm}\n\ntail\n`);
  });

  test("a table in a list item", () => {
    const source = `- item\n\n  ${indent(gfm, "  ")}\n- next\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`- item\n\n  ${indent(tbl, "  ")}\n- next\n`);
    keepsFrame(source, out);
  });

  test("a table on the line of the list marker", () => {
    const source = `1. ${indent(gfm, "   ")}\n`;
    expect(output(convert(source, { to: "tbl" }))).toBe(`1. ${indent(tbl, "   ")}\n`);
  });

  test("a table in a nested list", () => {
    const source = `- outer\n  - inner\n\n    ${indent(gfm, "    ")}\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`- outer\n  - inner\n\n    ${indent(tbl, "    ")}\n`);
    expect(output(convert(out, { to: "gfm" }))).toBe(source);
  });

  test("a table in a block quote", () => {
    const source = `> quote\n>\n> ${indent(gfm, "> ")}\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`> quote\n>\n> ${indent(tbl, "> ")}\n`);
    expect(output(convert(out, { to: "gfm" }))).toBe(source);
  });

  test("a table in a list item in a block quote", () => {
    const source = `> 1. ${indent(tbl, ">    ")}\n`;
    const out = output(convert(source, { to: "gfm" }));
    expect(out).toBe(`> 1. ${indent(gfm, ">    ")}\n`);
    expect(output(convert(out, { to: "tbl" }))).toBe(source);
  });

  test("an empty line of the new block gets the prefix with no trailing space", () => {
    const source = "> | A |\n> | --- |\n> | x<br><br>y |\n";
    expect(output(convert(source, { to: "tbl" }))).toBe("> ```tbl\n> a: A\n> --\n> a: x\n>\n> y\n> ```\n");
    const list = "- | A |\n  | --- |\n  | x<br><br>y |\n";
    expect(output(convert(list, { to: "tbl" }))).toBe("- ```tbl\n  a: A\n  --\n  a: x\n\n  y\n  ```\n");
  });

  test("a tilde fence converts to GFM", () => {
    const source = "~~~tbl\nmodel: Model\nprice: Price\n--\nm: Opus\np: $15\n~~~\n";
    expect(output(convert(source, { to: "gfm" }))).toBe(`${gfm}\n`);
  });

  test("a table inside another code block stays as it is", () => {
    const source = `\`\`\`\`markdown\n${tbl}\n\n${gfm}\n\`\`\`\`\n`;
    expect(convert(source, { to: "tbl" })).toEqual({ ok: true, output: source, count: 0 });
    expect(convert(source, { to: "gfm" })).toEqual({ ok: true, output: source, count: 0 });
  });

  test("a table of the target kind stays as it is, also an invalid tbl block", () => {
    const source = `${gfm}\n\n\`\`\`tbl id=1\nb: x\n\`\`\`\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`${tbl}\n\n\`\`\`tbl id=1\nb: x\n\`\`\`\n`);
    expect(convert(`| A |\n| - |\n`, { to: "gfm" })).toEqual({ ok: true, output: "| A |\n| - |\n", count: 0 });
  });
});

describe("convert: the file", () => {
  test("a file with no tables stays the same", () => {
    const source = "# Title\n\nText with a | pipe.\n";
    expect(convert(source, { to: "tbl" })).toEqual({ ok: true, output: source, count: 0 });
    expect(convert("", { to: "gfm" })).toEqual({ ok: true, output: "", count: 0 });
  });

  test("several tables convert, and the text between them stays", () => {
    const source = `intro\n\n${gfm}\n\nmiddle | text\n\n- item\n\n  ${indent(gfm, "  ")}\n\n> ${indent(gfm, "> ")}\n\nend`;
    const result = convert(source, { to: "tbl" });
    expect(result).toMatchObject({ ok: true, count: 3 });
    const out = output(result);
    keepsFrame(source, out);
    expect(output(convert(out, { to: "gfm" }))).toBe(source);
  });

  test("a CRLF file keeps CRLF", () => {
    const source = `a\r\n\r\n${gfm.replaceAll("\n", "\r\n")}\r\n\r\nb\r\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`a\r\n\r\n${tbl.replaceAll("\n", "\r\n")}\r\n\r\nb\r\n`);
    expect(output(convert(out, { to: "gfm" }))).toBe(source);
  });

  test("a CR file keeps CR", () => {
    const source = `> ${indent(tbl, "> ").replaceAll("\n", "\r")}\r`;
    const out = output(convert(source, { to: "gfm" }));
    expect(out).toBe(`> ${indent(gfm, "> ").replaceAll("\n", "\r")}\r`);
    expect(output(convert(out, { to: "tbl" }))).toBe(source);
  });

  test("an error in one table gives no output for the file", () => {
    const source = `${gfm}\n\n| A |\n| --- |\n| x<br> |\n`;
    expect(errors(convert(source, { to: "tbl" }))).toEqual([
      { line: 7, column: 1, message: 'Row 1, cell "a": the text ends with `<br>`. A tbl cell never ends with a line break, so remove the last `<br>`.' },
    ]);
  });

  test("the errors of all tables come sorted by line", () => {
    const source = "```tbl\na: A\n--\nb: x\n```\n\n```tbl x\na: A\n```\n\n```tbl\na: A\n--\nzz: y\n```\n";
    expect(errors(convert(source, { to: "gfm" })).map((e) => e.line)).toEqual([4, 7, 14]);
  });
});

describe("convert: error lines", () => {
  test("a parse error is at its file line and the column of the fence", () => {
    const source = "text\n\n> ```tbl\n> a: A\n> --\n> b: x\n> ```\n";
    expect(errors(convert(source, { to: "gfm" }))).toEqual([
      { line: 6, column: 3, message: 'The key "b" matches no header key. The header keys are: a.' },
    ]);
  });

  test("info text is at the fence line", () => {
    expect(errors(convert("- ```tbl id=1\n  a: A\n  ```\n", { to: "gfm" }))).toEqual([
      { line: 1, column: 3, message: 'The info string has text after `tbl`: "id=1". The info string must be exactly `tbl`.' },
    ]);
  });

  test("a cell error of toGfm is at the key line of the cell", () => {
    const source = "intro\n\n```tbl\nmodel: Model\nnote: Note\n--\nm: Opus\n--\nnote: first\nsecond\\\nthird\n```\n";
    const [error] = errors(convert(source, { to: "gfm" }));
    expect(error).toMatchObject({ line: 9, column: 1 });
    expect(error!.message).toStartWith('Row 2, cell "note": line 2 ends with a backslash');
  });

  test("a cell error with a prefix key is at the line of the prefix key", () => {
    const source = "> ```tbl\n> model: Model\n> note: Note\n> --\n> n:  padded\n> m: Opus\n> ```\n";
    const [error] = errors(convert(source, { to: "gfm" }));
    expect(error).toMatchObject({ line: 5, column: 3 });
    expect(error!.message).toStartWith('Row 1, cell "note": the text starts or ends with a space');
  });

  test("a title error is at the header key line", () => {
    const source = "```tbl\na: A\nb: B|\\|\n```\n";
    const [error] = errors(convert(source, { to: "gfm" }));
    expect(error).toMatchObject({ line: 3, column: 1 });
    expect(error!.message).toStartWith('The title of column "b" has a pipe after 1 backslash');
  });

  test("a fromGfm error is at the line of the cell", () => {
    const source = "- | A |\n  | - |\n  | x | y |\n";
    expect(errors(convert(source, { to: "tbl" }))).toEqual([
      { line: 3, column: 7, message: "Row 1 has more cells than the header (1). GFM drops cell 2, so add a column for it or remove it." },
    ]);
  });
});

describe("convert: the self-check", () => {
  const absorbed =
    "GFM would read the line after the new table as a row of it. A GFM table needs an empty line or another block directly after it. Add an empty line after the tbl block.";

  test("a tbl block directly after a paragraph line converts, because a GFM table can interrupt a paragraph", () => {
    const source = `text\n${tbl}\n`;
    const out = output(convert(source, { to: "gfm" }));
    expect(out).toBe(`text\n${gfm}\n`);
    expect(output(convert(out, { to: "tbl" }))).toBe(source);
  });

  test("a tbl block directly before a paragraph line fails, because GFM reads the line as a row", () => {
    expect(errors(convert(`intro\n\n${tbl}\ntext\n`, { to: "gfm" }))).toEqual([{ line: 3, column: 1, message: absorbed }]);
  });

  test("a tbl block in a list item directly before an indented line fails", () => {
    expect(errors(convert(`- ${indent(tbl, "  ")}\n  text\n`, { to: "gfm" }))).toEqual([{ line: 1, column: 3, message: absorbed }]);
  });

  test("a tbl block in a list item before a line outside the item converts", () => {
    const source = `- ${indent(tbl, "  ")}\ntext\n`;
    expect(output(convert(source, { to: "gfm" }))).toBe(`- ${indent(gfm, "  ")}\ntext\n`);
  });

  test("a tbl block in a block quote before a lazy line converts, because a table row is never lazy", () => {
    const source = `> ${indent(tbl, "> ")}\nlazy\n`;
    const out = output(convert(source, { to: "gfm" }));
    expect(out).toBe(`> ${indent(gfm, "> ")}\nlazy\n`);
    expect(findTables(out)[0]).toMatchObject({ kind: "gfm" });
    expect(output(convert(out, { to: "tbl" }))).toBe(source);
  });

  test("a tbl block in a block quote before a quoted text line fails", () => {
    expect(errors(convert(`> ${indent(tbl, "> ")}\n> text\n`, { to: "gfm" }))).toEqual([{ line: 1, column: 3, message: absorbed }]);
  });

  test("two tbl blocks with no empty line between them give one error", () => {
    expect(errors(convert(`${tbl}\n${tbl}\n`, { to: "gfm" }))).toEqual([{ line: 1, column: 1, message: absorbed }]);
  });

  test("a tbl block directly before a GFM table fails", () => {
    expect(errors(convert(`${tbl}\n| X |\n| - |\n`, { to: "gfm" }))).toEqual([{ line: 1, column: 1, message: absorbed }]);
  });

  test("a GFM table directly before a block converts to tbl", () => {
    const source = `${gfm}\n# Heading\n${gfm}\n- item\n`;
    const out = output(convert(source, { to: "tbl" }));
    expect(out).toBe(`${tbl}\n# Heading\n${tbl}\n- item\n`);
  });
});

describe("convert: round trips", () => {
  test("to tbl and back to gfm gives the canonical GFM", () => {
    const source = "| Price ($) | Note |\n| :-- | --: |\n| 1 | a<br>b |\n|  | x \\| y {#r1} |\n";
    const canonical = "| Price ($) | Note |\n| :--- | ---: |\n| 1 | a<br>b |\n|  | x \\| y {#r1} |\n";
    const there = output(convert(source, { to: "tbl" }));
    expect(output(convert(there, { to: "gfm" }))).toBe(canonical);
  });

  test("to tbl and back to gfm drops the empty excess cells", () => {
    const source = "# APIs\n\n| API | Auth |\n|---|---|\n| Cats | no | |\n| Dogs | key | \t | |\n\nEnd.\n";
    const canonical = "# APIs\n\n| API | Auth |\n| --- | --- |\n| Cats | no |\n| Dogs | key |\n\nEnd.\n";
    const there = output(convert(source, { to: "tbl" }));
    expect(output(convert(there, { to: "gfm" }))).toBe(canonical);
  });

  test("a table in a list item with an empty excess cell converts", () => {
    const source = "- | A |\n  | - |\n  | x | |\n";
    expect(output(convert(source, { to: "tbl" }))).toBe("- ```tbl\n  a: A\n  --\n  a: x\n  ```\n");
  });

  test("to gfm and back to tbl gives the canonical tbl when the keys come from the titles", () => {
    const source = "```tbl\nprice: Price ($)\nnote: Note\n--\nn: a\nb\np: 1\n-- {#r1}\nnote: x | y\n```\n";
    const canonical = "```tbl\nprice: Price ($)\nnote: Note\n--\nprice: 1\nnote: a\nb\n-- {#r1}\nnote: x | y\n```\n";
    const there = output(convert(source, { to: "gfm" }));
    expect(output(convert(there, { to: "tbl" }))).toBe(canonical);
  });
});

describe("convert: attributes", () => {
  const fix = (n: number) => (n === 1 ? "Remove it, or convert with --drop-attributes to drop it." : "Remove them, or convert with --drop-attributes to drop them.");

  test("align converts to the GFM alignment and back", () => {
    const source = "```tbl\na: A\n{align=left}\nb: B\n{align=center}\nc: C\n{align=right}\nd: D\n--\na: 1\nd: 4\n```\n";
    const there = output(convert(source, { to: "gfm" }));
    expect(there).toBe("| A | B | C | D |\n| :--- | :---: | ---: | --- |\n| 1 |  |  | 4 |\n");
    expect(output(convert(there, { to: "tbl" }))).toBe(source);
  });

  test("a GFM alignment becomes the attribute line of the column", () => {
    const source = "> | Price ($) | Note |\n> |--:|:-:|\n> | 1 | x |\n";
    expect(output(convert(source, { to: "tbl" }))).toBe("> ```tbl\n> price: Price ($)\n> {align=right}\n> note: Note\n> {align=center}\n> --\n> price: 1\n> note: x\n> ```\n");
  });

  test("a row ID alone converts, as in 0.1", () => {
    expect(output(convert("```tbl\na: A\n-- {#r1}\na: x\n```\n", { to: "gfm" }))).toBe("| A |\n| --- |\n| x {#r1} |\n");
  });

  test("a column attribute with no GFM form is at its attribute line, at the column of the fence", () => {
    const source = "- ```tbl\n  a: A\n  {.wide align=right}\n  --\n  a: x\n  ```\n";
    expect(errors(convert(source, { to: "gfm" }))).toEqual([
      {
        line: 3,
        column: 3,
        message: `Column "a": the attribute \`.wide\` has no GFM form, because GFM keeps only the align of a column. ${fix(1)}`,
      },
    ]);
  });

  test("a row attribute with no GFM form is at the -- line of the row", () => {
    const source = "Intro\n\n```tbl\na: A\n--\na: x\n-- {#r2 .new k=v}\na: y\n```\n";
    expect(errors(convert(source, { to: "gfm" }))).toEqual([
      { line: 7, column: 1, message: `Row 2: the attributes \`.new k=v\` have no GFM form, because GFM keeps only the ID of a row. ${fix(2)}` },
    ]);
  });

  test("a cell attribute is at the attribute line of the cell, also for a prefix key and a cell with no text", () => {
    const source = "> ```tbl\n> model: Model\n> note: Note\n> --\n> n: a\n>\n> {.c}\n> m:\n> {#i}\n> ```\n";
    expect(errors(convert(source, { to: "gfm" }))).toEqual([
      { line: 7, column: 3, message: `Row 1, cell "note": the attribute \`.c\` has no GFM form, because GFM has no attributes for a cell. ${fix(1)}` },
      { line: 9, column: 3, message: `Row 1, cell "model": the attribute \`#i\` has no GFM form, because GFM has no attributes for a cell. ${fix(1)}` },
    ]);
  });

  test("the errors of all attributes and of the text come sorted by line", () => {
    const source = "```tbl\na: A\n{.w}\n-- {.r}\na: x \n{.c}\n```\n";
    expect(errors(convert(source, { to: "gfm" })).map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });

  test("with dropAttributes, the align and the row IDs stay, and the rest goes", () => {
    const source = "```tbl\na: A\n{#c .wide align=right}\nb: B\n{.x}\n-- {#r1 .new}\na: x\n{.c}\nb:\n{k=v}\n-- {.old}\nb: y\n```\n";
    const result = convert(source, { to: "gfm", dropAttributes: true });
    expect(result).toEqual({ ok: true, count: 1, output: "| A | B |\n| ---: | --- |\n| x {#r1} |  |\n|  | y |\n" });
    expect(output(convert(output(result), { to: "tbl" }))).toBe("```tbl\na: A\n{align=right}\nb: B\n-- {#r1}\na: x\n--\nb: y\n```\n");
  });

  test("dropAttributes changes nothing for a table with no attributes, and nothing for the conversion to tbl", () => {
    expect(output(convert(`${tbl}\n`, { to: "gfm", dropAttributes: true }))).toBe(`${gfm}\n`);
    expect(output(convert("| A |\n| :- |\n", { to: "tbl", dropAttributes: true }))).toBe("```tbl\na: A\n{align=left}\n```\n");
  });

  test("dropAttributes keeps the other errors", () => {
    const [error] = errors(convert("```tbl\na: A\n{.w}\n--\na: x \n```\n", { to: "gfm", dropAttributes: true }));
    expect(error).toMatchObject({ line: 5, column: 1 });
  });

  test("an attribute error is at its line and column in the file", () => {
    expect(errors(convert("- ```tbl\n  a: A\n  -- {.x !}\n  ```\n", { to: "gfm" }))).toEqual([
      {
        line: 3,
        column: 10,
        message: 'The attribute block has the unexpected character "!". A part is an ID (#id), a class (.class), or a pair (key=value).',
      },
    ]);
  });
});
