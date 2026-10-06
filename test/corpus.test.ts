// Unit tests of the pure parts of the corpus test (corpus/). They need no network: getFile gets a fake fetch.
// The corpus run itself is `mise run corpus`, not part of `mise run test`.
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Root } from "mdast";
import { getFile } from "../corpus/fetch.ts";
import {
  Budget,
  cachePath,
  cacheRoot,
  checkConfig,
  compareTexts,
  FILE_CAP,
  firstDifference,
  normalize,
  parseTree,
  rawUrl,
  readCapped,
  roundTrip,
  sha256,
  splitDocuments,
  TOTAL_CAP,
  blankTable,
  verify,
  type Config,
} from "../corpus/lib.ts";
import { findTables, type FoundGfm } from "../src/markdown.ts";
import { tempDir } from "./helpers.ts";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const bytes = (text: string) => new TextEncoder().encode(text);

function stream(chunks: Uint8Array[]): { body: ReadableStream<Uint8Array>; cancelled: () => boolean; pulled: () => number } {
  let i = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]!);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  return { body, cancelled: () => cancelled, pulled: () => i };
}

describe("checkConfig", () => {
  const file = { path: "README.md", kind: "markdown" as const, size: 10, sha256: "a".repeat(64) };
  const config = (overrides: object = {}, fileOverrides: object = {}): Config => ({
    sources: [{ repo: "owner/name", commit: COMMIT, license: "MIT", files: [{ ...file, ...fileOverrides }], ...overrides }],
  });

  test("accepts a valid configuration", () => {
    expect(checkConfig(config())).toEqual([]);
  });

  test("names the source of each problem", () => {
    expect(checkConfig(config({ commit: "main" }))).toEqual(["owner/name: the commit must be a full SHA-1 of 40 hex digits."]);
    expect(checkConfig(config({ repo: "name" }))[0]).toContain("name: the repo must be");
    expect(checkConfig(config({ license: "" }))).toEqual(["owner/name: the source has no license."]);
    expect(checkConfig(config({}, { path: "../x.md" }))[0]).toStartWith("owner/name/../x.md: the path must be relative");
    expect(checkConfig(config({}, { kind: "html" }))[0]).toContain('the kind "html" is unknown');
    expect(checkConfig(config({}, { sha256: "abc" }))[0]).toContain("the sha256 must have 64 hex digits");
  });

  test("applies the caps for one file and for all files", () => {
    expect(checkConfig(config({}, { size: FILE_CAP }))).toEqual([]);
    expect(checkConfig(config({}, { size: FILE_CAP + 1 }))[0]).toContain(`at most ${FILE_CAP} bytes`);
    const many: Config = { sources: [{ repo: "o/n", commit: COMMIT, license: "MIT", files: [] }] };
    for (let i = 0; i < 9; i++) many.sources[0]!.files.push({ ...file, path: `f${i}.md`, size: FILE_CAP });
    expect(checkConfig(many)).toEqual([`The files have ${9 * FILE_CAP} bytes together, more than the cap of ${TOTAL_CAP} bytes.`]);
  });
});

describe("the cache place and the URL", () => {
  test("uses $XDG_CACHE_HOME, else ~/.cache", () => {
    expect(cacheRoot({ XDG_CACHE_HOME: "/var/cache/me" }, "/users/me")).toBe("/var/cache/me/tbl-md/corpus");
    expect(cacheRoot({}, "/users/me")).toBe("/users/me/.cache/tbl-md/corpus");
    // The XDG spec says to ignore a relative path.
    expect(cacheRoot({ XDG_CACHE_HOME: "cache" }, "/users/me")).toBe("/users/me/.cache/tbl-md/corpus");
  });

  test("puts a file at <root>/<owner>/<repo>/<commit>/<path>", () => {
    expect(cachePath("/c", "nodejs/node", COMMIT, "doc/api/fs.md")).toBe(`/c/nodejs/node/${COMMIT}/doc/api/fs.md`);
  });

  test("refuses a path that leaves the cache", () => {
    expect(() => cachePath("/c", "o/n", COMMIT, "../../etc/passwd")).toThrow('o/n/../../etc/passwd: the path must be relative, with no "." or ".." part.');
    expect(() => cachePath("/c", "o/n", COMMIT, "/etc/passwd")).toThrow("the path must be relative");
  });

  test("gets a file from raw.githubusercontent.com at the commit", () => {
    expect(rawUrl("o/n", COMMIT, "docs/a b.md")).toBe(`https://raw.githubusercontent.com/o/n/${COMMIT}/docs/a%20b.md`);
  });
});

describe("the hash check", () => {
  test("passes on the correct SHA-256", () => {
    expect(sha256(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(() => verify("o/n:a.md", bytes("abc"), sha256(bytes("abc")))).not.toThrow();
  });

  test("fails with an error that names the file", () => {
    expect(() => verify("o/n:a.md", bytes("abd"), sha256(bytes("abc")))).toThrow(/^o\/n:a\.md: the SHA-256 is [0-9a-f]{64}, but sources\.json has ba7816bf/);
  });
});

describe("readCapped", () => {
  test("joins the chunks", async () => {
    const { body } = stream([bytes("ab"), bytes("cd")]);
    expect(new TextDecoder().decode(await readCapped("f", body, 4, new Budget()))).toBe("abcd");
  });

  test("stops at the file cap and cancels the download", async () => {
    const s = stream([bytes("ab"), bytes("cd"), bytes("ef"), bytes("gh")]);
    await expect(readCapped("o/n:big.md", s.body, 3, new Budget())).rejects.toThrow("o/n:big.md: the file is larger than the cap of 3 bytes.");
    expect(s.cancelled()).toBe(true);
    expect(s.pulled()).toBeLessThan(4);
  });

  test("stops at the total cap of the run", async () => {
    const budget = new Budget(5);
    await readCapped("a", stream([bytes("abc")]).body, 10, budget);
    await expect(readCapped("o/n:b.md", stream([bytes("abc")]).body, 10, budget)).rejects.toThrow(
      "o/n:b.md: the downloads of this run pass the total cap of 5 bytes.",
    );
  });
});

describe("getFile", () => {
  const content = bytes("| a |\n| - |\n| 1 |\n");
  const hash = sha256(content);

  function fakeFetch(body: Uint8Array, status = 200, headers: Record<string, string> = {}) {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url);
      return new Response(status === 200 ? body : "not found", { status, headers });
    };
    return { fetch, urls };
  }

  test("downloads a file once, then reads it from the cache", async () => {
    const root = tempDir("corpus");
    const fake = fakeFetch(content);
    const first = await getFile("o/n", COMMIT, "docs/t.md", hash, { root, budget: new Budget(), fetch: fake.fetch });
    expect(first.downloaded).toBe(true);
    expect(fake.urls).toEqual([`https://raw.githubusercontent.com/o/n/${COMMIT}/docs/t.md`]);
    expect(readFileSync(join(root, "o", "n", COMMIT, "docs", "t.md"))).toEqual(Buffer.from(content));

    const second = await getFile("o/n", COMMIT, "docs/t.md", hash, { root, budget: new Budget(), fetch: fake.fetch });
    expect(second.downloaded).toBe(false);
    expect(second.bytes).toEqual(content);
    expect(fake.urls.length).toBe(1);
  });

  test("fails on a wrong hash and writes nothing to the cache", async () => {
    const root = tempDir("corpus");
    const fake = fakeFetch(bytes("changed\n"));
    await expect(getFile("o/n", COMMIT, "t.md", hash, { root, budget: new Budget(), fetch: fake.fetch })).rejects.toThrow(
      `o/n@${COMMIT.slice(0, 12)}:t.md: the SHA-256 is`,
    );
    expect(() => readFileSync(cachePath(root, "o/n", COMMIT, "t.md"))).toThrow();
  });

  test("downloads again if the cached file has a wrong hash", async () => {
    const root = tempDir("corpus");
    const place = cachePath(root, "o/n", COMMIT, "t.md");
    mkdirSync(dirname(place), { recursive: true });
    writeFileSync(place, "broken");
    const fake = fakeFetch(content);
    const got = await getFile("o/n", COMMIT, "t.md", hash, { root, budget: new Budget(), fetch: fake.fetch });
    expect(got.downloaded).toBe(true);
    expect(readFileSync(place)).toEqual(Buffer.from(content));
  });

  test("fails on an HTTP error and on a Content-Length above the cap", async () => {
    const root = tempDir("corpus");
    await expect(getFile("o/n", COMMIT, "t.md", hash, { root, budget: new Budget(), fetch: fakeFetch(content, 404).fetch })).rejects.toThrow(
      `o/n@${COMMIT.slice(0, 12)}:t.md: the download failed with HTTP 404.`,
    );
    const big = fakeFetch(content, 200, { "content-length": String(FILE_CAP + 1) });
    await expect(getFile("o/n", COMMIT, "t.md", hash, { root, budget: new Budget(), fetch: big.fetch })).rejects.toThrow(
      `the file is larger than the cap of ${FILE_CAP} bytes.`,
    );
  });

  test("with no hash (the pin command), takes the file as it is", async () => {
    const root = tempDir("corpus");
    const got = await getFile("o/n", COMMIT, "t.md", null, { root, budget: new Budget(), fetch: fakeFetch(content).fetch });
    expect(got.bytes).toEqual(content);
  });
});

describe("splitDocuments", () => {
  const fence = "`".repeat(32);

  test("a markdown file is one document", () => {
    expect(splitDocuments("markdown", "a\nb\n")).toEqual([{ line: 1, text: "a\nb\n" }]);
  });

  test("a spec file gives one document per example, with → as a tab", () => {
    const text = [
      "# Tables",
      "",
      `${fence} example table`,
      "| a |→b",
      "| - |",
      ".",
      "<table></table>",
      fence,
      "",
      "Text",
      `${fence} example`,
      "x",
      ".",
      "<p>x</p>",
      fence,
      `${fence}`,
    ].join("\n");
    expect(splitDocuments("spec", text)).toEqual([
      { line: 4, text: "| a |\tb\n| - |\n" },
      { line: 12, text: "x\n" },
    ]);
  });

  test("a markdown-it fixture gives the input between the first two dots", () => {
    const text = ["Simple:", ".", "| a |", "| - |", ".", "<table>", ".", "", "", "Empty:", ".", "", ".", "", "."].join("\n");
    expect(splitDocuments("markdown-it", text)).toEqual([
      { line: 3, text: "| a |\n| - |\n" },
      { line: 12, text: "\n" },
    ]);
  });

  test("a goldmark fixture gives the input between the first two separators", () => {
    const sep = "//- - - - - - - - -//";
    const end = "//= = = = = = = = = = = = = = = = = = = = = = = =//";
    const text = ["1", sep, "| a |", "| - |", sep, "<table>", end, "", "", "2", "    OPTIONS: {}", sep, "b", sep, "<p>b</p>", end].join("\n");
    expect(splitDocuments("goldmark", text)).toEqual([
      { line: 3, text: "| a |\n| - |\n" },
      { line: 13, text: "b\n" },
    ]);
  });
});

describe("normalize", () => {
  test("removes the positions", () => {
    expect(normalize(parseTree("a\n"))).toEqual({ type: "root", children: [{ type: "paragraph", children: [{ type: "text", value: "a" }] }] });
  });

  test("pads a short row and removes the excess cells, as GFM shows them", () => {
    const short = normalize(parseTree("| a | b |\n| - | - |\n| 1 |\n| 2 | 3 | 4 |\n"));
    const full = normalize(parseTree("| a | b |\n| - | - |\n| 1 | |\n| 2 | 3 |\n"));
    expect(short).toEqual(full);
  });

  test("keeps the alignment", () => {
    const left = parseTree("| a |\n| :- |\n");
    const none = parseTree("| a |\n| - |\n");
    expect(normalize(left)).not.toEqual(normalize(none));
  });

  test("firstDifference finds the row that differs", () => {
    const a = parseTree("# T\n\n| a |\n| - |\n| 1 |\n| 2 |\n");
    const b = parseTree("# T\n\n| a |\n| - |\n| 1 |\n| 3 |\n");
    expect(firstDifference(a as Root, b as Root).position?.start.line).toBe(6);
  });
});

describe("compareTexts", () => {
  test("a change of the layout only is the same", () => {
    expect(compareTexts("|a|b|\n|-|-|\n|1|2|\n", "| a | b |\n| --- | --- |\n| 1 | 2 |\n")).toEqual([{ kind: "same", line: 1 }]);
  });

  test("a change of the alignment only is different", () => {
    expect(compareTexts("text\n\n| a |\n| :-: |\n| 1 |\n", "text\n\n| a |\n| --- |\n| 1 |\n")).toEqual([
      { kind: "different", line: 3, message: "the table differs after the round trip" },
    ]);
  });

  test("a change of a cell is different, also next to a change of the alignment", () => {
    const original = "| a | b |\n| --- | :-: |\n| x | y |\n";
    expect(compareTexts(original, "| a | b |\n| --- | :-: |\n| x | y \\| |\n")).toEqual([
      { kind: "different", line: 3, message: "the tableRow differs after the round trip" },
    ]);
    expect(compareTexts(original, "| a | b |\n| --- | :-: |\n| x | z |\n")).toEqual([
      { kind: "different", line: 3, message: "the tableRow differs after the round trip" },
    ]);
  });

  test("gives one outcome for each table", () => {
    const original = "| a |\n| - |\n| 1 |\n\n| b |\n| :- |\n| 2 |\n\n| c |\n| - |\n| 3 |\n";
    const back = "| a |\n| - |\n| 1 |\n\n| b |\n| - |\n| 2 |\n\n| c |\n| - |\n| 4 |\n";
    expect(compareTexts(original, back)).toEqual([
      { kind: "same", line: 1 },
      { kind: "different", line: 5, message: "the table differs after the round trip" },
      { kind: "different", line: 11, message: "the tableRow differs after the round trip" },
    ]);
  });

  test("a change outside the tables adds one outcome different", () => {
    expect(compareTexts("a\n\n| a |\n| - |\n", "b\n\n| a |\n| - |\n")).toEqual([
      { kind: "same", line: 3 },
      { kind: "different", line: 1, message: "the text outside the tables differs after the round trip (first at a text)" },
    ]);
  });

  test("a change of the number of tables makes each table different", () => {
    expect(compareTexts("| a |\n| - |\n\n| b |\n| - |\n", "| a |\n| - |\n")).toEqual([
      { kind: "different", line: 1, message: "the document has 1 tables after the round trip, not 2" },
      { kind: "different", line: 4, message: "the document has 1 tables after the round trip, not 2" },
    ]);
  });
});

describe("blankTable", () => {
  const gfm = (text: string) => findTables(text).filter((f): f is FoundGfm => f.kind === "gfm");

  test("removes a table and keeps the line count", () => {
    const text = "x\n\n| a |\n| - |\n| 1 |\n\ny\n";
    expect(blankTable(text, gfm(text)[0]!)).toBe("x\n\n\n\n\n\ny\n");
  });

  test("keeps the markers of a block quote and the indent of a list item", () => {
    const quote = "> x\n>\n> | a |\n> | - |\n> | 1 |\n";
    expect(blankTable(quote, gfm(quote)[0]!)).toBe("> x\n>\n>\n>\n>\n");
    const item = "- x\n\n  | a |\n  | - |\n";
    expect(blankTable(item, gfm(item)[0]!)).toBe("- x\n\n\n\n");
  });

  test("keeps the line ends CRLF", () => {
    const text = "| a |\r\n| - |\r\n| 1 |\r\n\r\ny\r\n";
    expect(blankTable(text, gfm(text)[0]!)).toBe("\r\n\r\n\r\n\r\ny\r\n");
  });
});

describe("roundTrip", () => {
  test("gives no outcome for a document with no table", () => {
    expect(roundTrip("# Title\n")).toEqual([]);
  });

  test("reports a conversion error at its line", () => {
    expect(roundTrip("x\n\n| a |\n| - |\n| 1 | 2 |\n")).toMatchObject([{ kind: "error", line: 5 }]);
  });

  test("keeps the alignment", () => {
    expect(roundTrip("| a | b | c |\n| :- | -: | :-: |\n| 1 |\n")).toEqual([{ kind: "same", line: 1 }]);
  });

  test("a plain table is the same, also with short rows and empty excess cells", () => {
    expect(roundTrip("| a | b |\n| - | - |\n| 1 |\n| 2 | 3 | |\n")).toEqual([{ kind: "same", line: 1 }]);
  });

  test("one failing table does not hide the other tables of the document", () => {
    const text = "| a |\n| - |\n| 1 |\n\n| b |\n| - |\n| 1 | 2 |\n\n| c |\n| :- |\n| 3 |\n";
    expect(roundTrip(text)).toMatchObject([
      { kind: "same", line: 1 },
      { kind: "error", line: 7 },
      { kind: "same", line: 9 },
    ]);
  });

  test("one failing and two good tables give 1 error and 2 same", () => {
    const text = "| a |\n| - |\n| 1 | 2 |\n\n| b |\n| - |\n| 1 |\n\n| c |\n| - |\n| 3 |\n";
    const kinds = roundTrip(text).map((o) => o.kind);
    expect(kinds.filter((k) => k === "error")).toHaveLength(1);
    expect(kinds.filter((k) => k === "same")).toHaveLength(2);
  });

  test("keeps the lines of the other tables, also in a block quote after a failing table", () => {
    const text = "> | a |\n> | - |\n> | 1 | 2 |\n>\n> | b |\n> | :- |\n> | 3 |\n\n| c |\n| - |\n| 4 |\n";
    expect(roundTrip(text)).toMatchObject([
      { kind: "error", line: 3 },
      { kind: "same", line: 5 },
      { kind: "same", line: 9 },
    ]);
  });

  test("reports each failing table once, also with several errors in it", () => {
    const text = "| a |\n| - |\n| 1 | 2 |\n| 3 | 4 |\n\n| b |\n| - |\n| 1 | 2 |\n";
    expect(roundTrip(text)).toMatchObject([
      { kind: "error", line: 3 },
      { kind: "error", line: 8 },
    ]);
  });
});
