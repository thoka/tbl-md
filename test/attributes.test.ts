import { describe, expect, test } from "bun:test";
import {
  parseAttributes,
  renderAttributes,
  validateAttributes,
  type AttributeErrorCode,
  type AttributePlace,
  type Attributes,
} from "../src/index.ts";

function ok(block: string, place?: AttributePlace): Attributes {
  const result = parseAttributes(block, place);
  if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
  return result.attributes;
}

describe("parseAttributes: the grammar of rule 14", () => {
  test("reads an ID, classes, and pairs in source order", () => {
    expect(ok('{#a1 .new .b-2 align=right note="a b" k=x:y_z-1}')).toEqual({
      id: "a1",
      classes: ["new", "b-2"],
      pairs: [
        { key: "align", value: "right" },
        { key: "note", value: "a b" },
        { key: "k", value: "x:y_z-1" },
      ],
    });
  });

  test("a block with only classes has no id field", () => {
    expect(ok("{.x}")).toStrictEqual({ classes: ["x"], pairs: [] });
  });

  test("spaces and tabs around the parts and after the `}` do not count", () => {
    expect(ok("{ \t#a\t .b  k=v }\t ")).toEqual({ id: "a", classes: ["b"], pairs: [{ key: "k", value: "v" }] });
  });

  test("a quoted value can be empty and can hold `\\\"`, `\\\\`, `}`, `#`, and spaces", () => {
    expect(ok('{e="" q="a \\"b\\" \\\\ } #c"}').pairs).toEqual([
      { key: "e", value: "" },
      { key: "q", value: 'a "b" \\ } #c' },
    ]);
  });

  test("the parts can come in any order", () => {
    expect(ok("{k=v .c #i}")).toEqual({ id: "i", classes: ["c"], pairs: [{ key: "k", value: "v" }] });
  });

  test("keys are case-sensitive, so `Align` and `ID` are unknown keys", () => {
    expect(ok("{Align=middle ID=x}", "row").pairs).toEqual([
      { key: "Align", value: "middle" },
      { key: "ID", value: "x" },
    ]);
  });

  test("an unknown key is kept, at each place", () => {
    for (const place of ["column", "row", "cell"] as const) expect(ok("{width=10}", place).pairs).toEqual([{ key: "width", value: "10" }]);
  });

  // Each grammar error with its code and the 0-based offset of the first bad character.
  const cases: [string, AttributeErrorCode, number, string][] = [
    ["{.hl !}", "attr-unexpected-char", 5, 'The attribute block has the unexpected character "!".'],
    ["{=v}", "attr-unexpected-char", 1, 'The attribute block has the unexpected character "=".'],
    ["{.a}x}", "attr-unexpected-char", 3, 'The attribute block has a "}" before its end.'],
    ['{k="a"!}', "attr-unexpected-char", 6, 'The attribute block has the unexpected character "!" after the value of "k".'],
    [" {.a}", "attr-unexpected-char", 0, 'An attribute block starts with "{"'],
    ["{.a", "attr-unexpected-char", 3, 'An attribute block ends with "}".'],
    ["{#a.b}", "attr-no-space", 3, 'Two parts of the attribute block have no space between them. Add a space before ".".'],
    ["{.a#b}", "attr-no-space", 3, 'Add a space before "#".'],
    ['{k="a".b}', "attr-no-space", 6, 'Add a space before ".".'],
    ['{k="a"x=1}', "attr-no-space", 6, 'Add a space before "x".'],
    ["{}", "attr-empty", 1, "The attribute block is empty."],
    ["{ \t}", "attr-empty", 3, "The attribute block is empty."],
    ["{#}", "attr-bad-id", 2, 'The ID is empty. Write the ID after "#"'],
    ["{# a}", "attr-bad-id", 2, "The ID is empty."],
    ["{#a:b}", "attr-bad-id", 3, 'The ID has the character ":".'],
    ["{.}", "attr-bad-class", 2, 'The class is empty. Write a name after "."'],
    ["{.1a}", "attr-bad-class", 2, 'The class starts with "1". A class starts with a letter'],
    ["{.a:b}", "attr-bad-class", 3, 'The class has the character ":".'],
    ["{1k=v}", "attr-bad-key", 1, 'A key starts with "1". A key starts with a letter'],
    ["{_k=v}", "attr-bad-key", 1, 'A key starts with "_".'],
    ["{k:v}", "attr-bad-key", 2, 'The key "k" has the character ":".'],
    ["{#a #b}", "attr-duplicate-id", 4, "The attribute block has more than one ID. Keep only one ID."],
    ["{.a .b .a}", "attr-duplicate-class", 7, 'The attribute block has the class "a" two times. Remove one.'],
    ["{k=1 k=2}", "attr-duplicate-key", 5, 'The attribute block has the key "k" two times. Remove one.'],
    ["{id=x}", "attr-reserved-key", 1, 'The key "id" is not allowed. Write the ID as #x.'],
    ["{.a class=b}", "attr-reserved-key", 4, 'The key "class" is not allowed. Write the class as .x.'],
    ["{k}", "attr-no-value", 2, 'The key "k" has no value. Write "=" and a value, for example k=x, or k="" for an empty value.'],
    ["{k=}", "attr-no-value", 3, 'The key "k" has no value.'],
    ["{k= v}", "attr-no-value", 3, 'The key "k" has no value.'],
    ["{k=a.b}", "attr-bad-bare-value", 4, 'The value of "k" has the character ".". A value with no quotes has only letters, digits, "_", ":", and "-". Put the value in double quotes: k="a.b".'],
    ['{k=a"b}', "attr-bad-bare-value", 4, 'Put the value in double quotes: k="a\\"b".'],
    ["{k='a'}", "attr-single-quotes", 3, 'The value of "k" has single quotes. Use double quotes: k="...".'],
    ['{k="a}', "attr-unclosed-quote", 3, 'The value of "k" has no closing quote.'],
    ['{k="a\\"}', "attr-unclosed-quote", 3, 'The value of "k" has no closing quote.'],
    ['{k="a\\}', "attr-unclosed-quote", 3, 'The value of "k" has no closing quote.'],
    ['{k="a\\b"}', "attr-bad-escape", 5, 'The value of "k" has a backslash before "b". In a quoted value, only \\" and \\\\ are escapes.'],
  ];
  for (const [block, code, offset, message] of cases) {
    test(`${code}: ${block}`, () => {
      const result = parseAttributes(block);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toMatchObject({ code, offset });
      expect(result.error.message).toContain(message);
    });
  }

  test("it stops at the first error", () => {
    const result = parseAttributes("{#a #b .1}");
    expect(result).toMatchObject({ ok: false, error: { code: "attr-duplicate-id", offset: 4 } });
  });
});

describe("parseAttributes: the known keys of rule 15", () => {
  test("`align` with left, center, or right is valid on a column", () => {
    for (const value of ["left", "center", "right", '"right"']) {
      expect(ok(`{align=${value}}`, "column").pairs).toEqual([{ key: "align", value: value.replaceAll('"', "") }]);
    }
  });

  test("a bad value of `align` is attr-bad-value at the value, and the message lists the values", () => {
    expect(parseAttributes("{.a align=middle}", "column")).toEqual({
      ok: false,
      error: { code: "attr-bad-value", offset: 10, message: 'The value "middle" of "align" is not valid. Use left, center, or right.' },
    });
    expect(parseAttributes('{align="Right"}', "column")).toMatchObject({ ok: false, error: { code: "attr-bad-value", offset: 7 } });
  });

  test("`align` at a row or a cell is attr-key-place at the key", () => {
    for (const place of ["row", "cell"] as const) {
      expect(parseAttributes("{.a align=right}", place)).toEqual({
        ok: false,
        error: {
          code: "attr-key-place",
          offset: 4,
          message: `The key "align" is allowed only on a column, not on a ${place}. Remove it, or write it in the attribute line of the column.`,
        },
      });
    }
  });

  test("with no place, the known keys are not checked", () => {
    expect(ok("{align=middle}").pairs).toEqual([{ key: "align", value: "middle" }]);
  });
});

describe("renderAttributes: the canonical form", () => {
  test("the ID, then the classes, then the pairs, with one space between them", () => {
    expect(renderAttributes({ classes: ["c1", "c2"], pairs: [{ key: "k1", value: "v1" }], id: "id" })).toBe("{#id .c1 .c2 k1=v1}");
  });

  test("a value of the form [A-Za-z0-9_:-]+ is bare, each other value has double quotes", () => {
    const pairs = [
      { key: "a", value: "x:Y_1-2" },
      { key: "b", value: "v 2" },
      { key: "c", value: "" },
      { key: "d", value: 'q"b\\s' },
      { key: "e", value: "a.b" },
    ];
    expect(renderAttributes({ classes: [], pairs })).toBe('{a=x:Y_1-2 b="v 2" c="" d="q\\"b\\\\s" e="a.b"}');
  });

  test("parseAttributes reads the canonical form back", () => {
    const attributes: Attributes = {
      id: "r1",
      classes: ["x"],
      pairs: [
        { key: "q", value: '"}\\' },
        { key: "n", value: "1" },
      ],
    };
    expect(ok(renderAttributes(attributes))).toStrictEqual(attributes);
  });
});

describe("validateAttributes", () => {
  const where = "Row 1";
  const cases: [string, Attributes, AttributePlace, string][] = [
    ["an empty block", { classes: [], pairs: [] }, "row", "Row 1 has an empty attribute block. Give it an ID, a class, or a pair, or remove it."],
    ["a bad ID", { id: "a.b", classes: [], pairs: [] }, "row", 'Row 1 has the ID "a.b". An ID must have the form [A-Za-z0-9_-]+.'],
    ["an empty ID", { id: "", classes: [], pairs: [] }, "row", 'Row 1 has the ID "". An ID must have the form [A-Za-z0-9_-]+.'],
    ["a bad class", { classes: ["1a"], pairs: [] }, "row", 'Row 1 has the class "1a". A class must have the form [A-Za-z][A-Za-z0-9_-]*.'],
    ["a repeated class", { classes: ["a", "a"], pairs: [] }, "row", 'Row 1 has the class "a" two times.'],
    ["a bad key", { classes: [], pairs: [{ key: "k.1", value: "v" }] }, "row", 'Row 1 has the attribute key "k.1". A key must have the form [A-Za-z][A-Za-z0-9_-]*.'],
    [
      "a repeated key",
      {
        classes: [],
        pairs: [
          { key: "k", value: "1" },
          { key: "k", value: "2" },
        ],
      },
      "row",
      'Row 1 has the attribute key "k" two times.',
    ],
    ["the key id", { classes: [], pairs: [{ key: "id", value: "x" }] }, "row", 'Row 1 has the attribute key "id". Use the id field instead.'],
    ["the key class", { classes: [], pairs: [{ key: "class", value: "x" }] }, "row", 'Row 1 has the attribute key "class". Use the classes field instead.'],
    ["a value with an LF", { classes: [], pairs: [{ key: "k", value: "a\nb" }] }, "row", 'Row 1 has a value of "k" with a line break. A value has one line and no CR.'],
    ["a value with a CR", { classes: [], pairs: [{ key: "k", value: "a\rb" }] }, "row", 'Row 1 has a value of "k" with a line break. A value has one line and no CR.'],
    [
      "a bad value of align",
      { classes: [], pairs: [{ key: "align", value: "middle" }] },
      "column",
      'Row 1: The value "middle" of "align" is not valid. Use left, center, or right.',
    ],
    [
      "align at a row",
      { classes: [], pairs: [{ key: "align", value: "right" }] },
      "row",
      'Row 1: The key "align" is allowed only on a column, not on a row. Remove it, or write it in the attribute line of the column.',
    ],
  ];
  for (const [name, attributes, place, message] of cases) {
    test(name, () => {
      expect(validateAttributes(attributes, place, where)).toEqual([message]);
    });
  }

  test("valid attributes have no problems", () => {
    expect(validateAttributes({ id: "a", classes: ["b"], pairs: [{ key: "align", value: "left" }, { key: "x", value: "" }] }, "column", where)).toEqual([]);
  });
});
