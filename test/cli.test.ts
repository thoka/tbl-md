import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { main, USAGE } from "../src/cli.ts";
import { tempDir } from "./helpers.ts";

const root = join(import.meta.dir, "..");

const GFM = "Intro\n\n| A |\n| --- |\n| x<br>y |\n";
const GFM_AS_TBL = "Intro\n\n```tbl\na: A\n--\na: x\ny\n```\n";
const BAD_TBL = "# Title\n\n```tbl\na: A\n--\nb: x\n```\n";
const BAD_GFM = "| A |\n| --- |\n| x<br> |\n";
const PLAIN = "# No tables\n\nText.\n";
const ATTR_TBL = "# T\n\n```tbl\na: A\n{.wide align=right}\n-- {#r1 .new}\na: x\n{.c}\n```\n";

interface Run {
  code: number;
  out: string;
  err: string;
}

async function cli(args: string[], stdin?: string): Promise<Run> {
  let out = "";
  let err = "";
  const code = await main(args, {
    stdout: (t) => (out += t),
    stderr: (t) => (err += t),
    stdin: stdin === undefined ? undefined : async () => stdin,
  });
  return { code, out, err };
}

/** Writes the files into a new temp folder and gives their paths, in the order of the names. */
function files(entries: Record<string, string>): string[] {
  const dir = tempDir("cli");
  return Object.entries(entries).map(([name, text]) => {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  });
}

describe("lint", () => {
  test("a clean file gives exit 0 and no output", async () => {
    const [a] = files({ "a.md": PLAIN });
    expect(await cli(["lint", a!])).toEqual({ code: 0, out: "", err: "" });
  });

  test("each error has the form file:line:column: message (code), in file order and then line order, and a summary ends the output", async () => {
    const [a, b] = files({ "a.md": BAD_TBL + "\n" + GFM, "b.md": GFM });
    const run = await cli(["lint", b!, a!]);
    expect(run.code).toBe(1);
    expect(run.err).toBe("");
    const lines = run.out.trimEnd().split("\n");
    expect(lines).toEqual([
      `${b}:3:1: This is a GFM pipe table. Write it as a tbl block, for example with \`tbl-md convert\`. (gfm-table)`,
      expect.stringMatching(new RegExp(`^${escape(a!)}:6:1: The key "b" matches no header key\\..* \\(unknown-key\\)$`)),
      `${a}:11:1: This is a GFM pipe table. Write it as a tbl block, for example with \`tbl-md convert\`. (gfm-table)`,
      "3 errors and 0 warnings.",
    ]);
  });

  test("the file name - reads stdin and names the file -", async () => {
    const run = await cli(["lint", "-"], GFM);
    expect(run).toEqual({ code: 1, out: "-:3:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)\n1 error and 0 warnings.\n", err: "" });
  });

  test("a BOM does not count in the line or the column", async () => {
    const [a] = files({ "a.md": "﻿| A |\n| --- |\n| x |\n" });
    expect((await cli(["lint", a!])).out).toStartWith(`${a}:1:1: `);
  });

  test("lint does not change the file", async () => {
    const [a] = files({ "a.md": GFM });
    await cli(["lint", a!]);
    expect(readFileSync(a!, "utf8")).toBe(GFM);
  });
});

/** A new temp folder with a `.git` folder, so that the search for `.tbl-md.json` stops there. */
function repo(entries: Record<string, string>): string {
  const dir = tempDir("cli-config");
  mkdirSync(join(dir, ".git"));
  for (const [name, text] of Object.entries(entries)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

const KEYS_TBL = "```tbl\na: A\n{status=open owner=me}\n```\n";

describe("lint with a configuration", () => {
  test("a warning has the form file:line:column: warning: message (code), and the exit code is 0", async () => {
    const dir = repo({ "a.md": KEYS_TBL });
    const run = await cli(["lint", join(dir, "a.md")]);
    expect(run.code).toBe(0);
    expect(run.err).toBe("");
    expect(run.out.trimEnd().split("\n")).toEqual([
      `${dir}/a.md:3:2: warning: The attribute key "status" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. No .tbl-md.json was found, so only "align" is known. (unknown-attribute-key)`,
      expect.stringMatching(/^.*a\.md:3:14: warning: The attribute key "owner" is unknown\..* \(unknown-attribute-key\)$/),
      "0 errors and 2 warnings.",
    ]);
  });

  test("a key in .tbl-md.json gives no warning, and the warning names the file", async () => {
    const dir = repo({ "docs/a.md": KEYS_TBL, ".tbl-md.json": '{"attributeKeys": ["status"]}' });
    const run = await cli(["lint", join(dir, "docs/a.md")]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(
      `${dir}/docs/a.md:3:14: warning: The attribute key "owner" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. The configuration file is ${dir}/.tbl-md.json. (unknown-attribute-key)\n0 errors and 1 warning.\n`,
    );
  });

  test("the nearest .tbl-md.json wins for each file, with no merge", async () => {
    const dir = repo({
      "a.md": KEYS_TBL,
      "sub/b.md": KEYS_TBL,
      ".tbl-md.json": '{"attributeKeys": ["status", "owner"]}',
      "sub/.tbl-md.json": '{"attributeKeys": ["owner"]}',
    });
    const run = await cli(["lint", join(dir, "a.md"), join(dir, "sub/b.md")]);
    expect(run.out).toBe(
      `${dir}/sub/b.md:3:2: warning: The attribute key "status" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. The configuration file is ${dir}/sub/.tbl-md.json. (unknown-attribute-key)\n0 errors and 1 warning.\n`,
    );
  });

  test("the search stops at the .git folder", async () => {
    const outer = repo({ ".tbl-md.json": '{"attributeKeys": ["status", "owner"]}' });
    const inner = join(outer, "inner");
    mkdirSync(join(inner, ".git"), { recursive: true });
    writeFileSync(join(inner, "a.md"), KEYS_TBL);
    const run = await cli(["lint", join(inner, "a.md")]);
    expect(run.out).toContain("No .tbl-md.json was found");
    expect(run.out).toEndWith("0 errors and 2 warnings.\n");
  });

  test("--config replaces the search for all files", async () => {
    const dir = repo({ "a.md": KEYS_TBL, ".tbl-md.json": '{"attributeKeys": []}', "other.json": '{"attributeKeys": ["status", "owner"]}' });
    expect(await cli(["lint", "--config", join(dir, "other.json"), join(dir, "a.md")])).toEqual({ code: 0, out: "", err: "" });
  });

  test("--max-warnings fails the run only for more warnings than the limit", async () => {
    const dir = repo({ "a.md": KEYS_TBL });
    const a = join(dir, "a.md");
    const zero = await cli(["lint", "--max-warnings", "0", a]);
    expect(zero.code).toBe(1);
    expect(zero.out).toEndWith("0 errors and 2 warnings. The warnings are more than --max-warnings 0.\n");
    expect((await cli(["lint", "--max-warnings", "1", a])).code).toBe(1);
    const two = await cli(["lint", "--max-warnings", "2", a]);
    expect(two.code).toBe(0);
    expect(two.out).toEndWith("0 errors and 2 warnings.\n");
  });

  test("an error gives exit code 1 also with warnings under the limit, and the summary counts both", async () => {
    const dir = repo({ "a.md": KEYS_TBL + "\n" + GFM });
    const run = await cli(["lint", "--max-warnings", "5", join(dir, "a.md")]);
    expect(run.code).toBe(1);
    expect(run.out).toEndWith("1 error and 2 warnings.\n");
  });

  test.each([
    ["invalid JSON", "{", /^tbl-md: .*\/\.tbl-md\.json(:1)?: The file is not valid JSON: /],
    ["an unknown key", '{"keys": []}', /^tbl-md: .*\/\.tbl-md\.json: The key "keys" is unknown\./],
    ["a bad key", '{"attributeKeys": ["a b"]}', /^tbl-md: .*\/\.tbl-md\.json: attributeKeys\[0\] "a b" is not a key\./],
  ])("a configuration file with %s stops the run with exit code 2 before any output", async (_, text, message) => {
    const dir = repo({ "a.md": GFM, "sub/b.md": GFM, "sub/.tbl-md.json": text });
    const run = await cli(["lint", join(dir, "a.md"), join(dir, "sub/b.md")]);
    expect(run.code).toBe(2);
    expect(run.out).toBe("");
    expect(run.err).toMatch(message);
    expect(run.err).not.toContain("--help");
  });

  test("a --config file that does not exist is a configuration error", async () => {
    const dir = repo({ "a.md": GFM });
    const run = await cli(["lint", "--config", join(dir, "missing.json"), join(dir, "a.md")]);
    expect(run).toEqual({
      code: 2,
      out: "",
      err: `tbl-md: ${dir}/missing.json: Cannot read the configuration file: no such file.\n`,
    });
  });

  test("for stdin, the search starts in the current folder", () => {
    const dir = repo({ ".tbl-md.json": '{"attributeKeys": ["status"]}' });
    const result = spawnSync(process.execPath, [join(root, "src/cli.ts"), "lint", "-"], { cwd: dir, encoding: "utf8", input: KEYS_TBL });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      '-:3:14: warning: The attribute key "owner" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. The configuration file is .tbl-md.json. (unknown-attribute-key)\n0 errors and 1 warning.\n',
    );
  });
});

describe("convert", () => {
  test("--to defaults to tbl, writes the file, and reports the count", async () => {
    const [a] = files({ "a.md": GFM });
    const run = await cli(["convert", a!]);
    expect(run).toEqual({ code: 0, out: `${a}: converted 1 table\n`, err: "" });
    expect(readFileSync(a!, "utf8")).toBe(GFM_AS_TBL);
  });

  test("--to gfm converts back, and two tables give the plural", async () => {
    const [a] = files({ "a.md": GFM_AS_TBL + "\n" + GFM_AS_TBL });
    const run = await cli(["convert", "--to", "gfm", a!]);
    expect(run).toEqual({ code: 0, out: `${a}: converted 2 tables\n`, err: "" });
    expect(readFileSync(a!, "utf8")).toBe(GFM + "\n" + GFM);
  });

  test("--to=tbl is the same as --to tbl", async () => {
    const [a] = files({ "a.md": GFM });
    expect((await cli(["convert", "--to=tbl", a!])).code).toBe(0);
    expect(readFileSync(a!, "utf8")).toBe(GFM_AS_TBL);
  });

  test("a file with no table to convert prints nothing and is not written", async () => {
    const [a, b] = files({ "a.md": PLAIN, "b.md": GFM_AS_TBL });
    const old = new Date("2020-01-01T00:00:00Z");
    for (const f of [a!, b!]) utimesSync(f, old, old);
    expect(await cli(["convert", a!, b!])).toEqual({ code: 0, out: "", err: "" });
    for (const f of [a!, b!]) expect(statSync(f).mtime.getTime()).toBe(old.getTime());
    expect(readFileSync(b!, "utf8")).toBe(GFM_AS_TBL);
  });

  test("a failed file stays unchanged, and the other files still convert", async () => {
    const [bad, good] = files({ "bad.md": BAD_GFM, "good.md": GFM });
    const run = await cli(["convert", bad!, good!]);
    expect(run.code).toBe(1);
    expect(run.err).toBe("");
    const lines = run.out.trimEnd().split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(new RegExp(`^${escape(bad!)}:3:3: \\S`));
    expect(lines[0]).not.toMatch(/\([a-z-]+\)$/);
    expect(lines[1]).toBe(`${good}: converted 1 table`);
    expect(readFileSync(bad!, "utf8")).toBe(BAD_GFM);
    expect(readFileSync(good!, "utf8")).toBe(GFM_AS_TBL);
  });

  test("an error of a tbl block names its file line", async () => {
    const [a] = files({ "a.md": BAD_TBL });
    const run = await cli(["convert", "--to", "gfm", a!]);
    expect(run.code).toBe(1);
    expect(run.out).toMatch(new RegExp(`^${escape(a!)}:6:1: The key "b" matches no header key\\.`));
    expect(readFileSync(a!, "utf8")).toBe(BAD_TBL);
  });

  test("an attribute with no GFM form names its file line, and the file stays", async () => {
    const [a] = files({ "a.md": ATTR_TBL });
    const run = await cli(["convert", "--to", "gfm", a!]);
    expect(run.code).toBe(1);
    expect(run.out).toBe(
      `${a}:5:1: Column "a": the attribute \`.wide\` has no GFM form, because GFM keeps only the align of a column. Remove it, or convert with --drop-attributes to drop it.\n` +
        `${a}:6:1: Row 1: the attribute \`.new\` has no GFM form, because GFM keeps only the ID of a row. Remove it, or convert with --drop-attributes to drop it.\n` +
        `${a}:8:1: Row 1, cell "a": the attribute \`.c\` has no GFM form, because GFM has no attributes for a cell. Remove it, or convert with --drop-attributes to drop it.\n`,
    );
    expect(readFileSync(a!, "utf8")).toBe(ATTR_TBL);
  });

  test("--drop-attributes drops them, and keeps the align and the row ID", async () => {
    const [a] = files({ "a.md": ATTR_TBL });
    const run = await cli(["convert", "--to", "gfm", "--drop-attributes", a!]);
    expect(run).toEqual({ code: 0, out: `${a}: converted 1 table\n`, err: "" });
    expect(readFileSync(a!, "utf8")).toBe("# T\n\n| A |\n| ---: |\n| x {#r1} |\n");
  });

  test("a CRLF file keeps CRLF", async () => {
    const crlf = (s: string) => s.replaceAll("\n", "\r\n");
    const [a] = files({ "a.md": crlf(GFM) });
    expect((await cli(["convert", a!])).code).toBe(0);
    expect(readFileSync(a!, "utf8")).toBe(crlf(GFM_AS_TBL));
  });

  test("a file with a BOM keeps its BOM, and the BOM does not count in the error line", async () => {
    const [a, b] = files({ "a.md": "﻿" + GFM, "b.md": "﻿" + BAD_GFM });
    const run = await cli(["convert", a!, b!]);
    expect(readFileSync(a!, "utf8")).toBe("﻿" + GFM_AS_TBL);
    expect(run.out).toContain(`${b}:3:3: `);
  });

  test("the file name - reads stdin, writes the result to stdout, and reports on stderr", async () => {
    expect(await cli(["convert", "-"], GFM)).toEqual({ code: 0, out: GFM_AS_TBL, err: "-: converted 1 table\n" });
  });

  test("- with no table to convert writes the text unchanged", async () => {
    expect(await cli(["convert", "-"], "﻿" + PLAIN)).toEqual({ code: 0, out: "﻿" + PLAIN, err: "" });
  });

  test("- with an error writes nothing to stdout and the errors to stderr", async () => {
    const run = await cli(["convert", "-"], BAD_GFM);
    expect(run.code).toBe(1);
    expect(run.out).toBe("");
    expect(run.err).toMatch(/^-:3:3: \S/);
  });

  test("- keeps the BOM and CRLF of stdin", async () => {
    const run = await cli(["convert", "-"], "﻿" + GFM.replaceAll("\n", "\r\n"));
    expect(run.out).toBe("﻿" + GFM_AS_TBL.replaceAll("\n", "\r\n"));
  });
});

// A pipe table directly inside an HTML block. The flavor discourse has HTML on, so the lines are HTML and hold no table.
// The flavor markdown-it has HTML off, so the lines are text: the table starts at line 2, and `</div>` is its last row.
const HTML_TABLE = "<div>\n| A |\n| --- |\n| x |\n</div>\n";
const HTML_TABLE_AS_TBL = "<div>\n```tbl\na: A\n--\na: x\n--\na: </div>\n```\n";
const HTML_TABLE_ERROR = "2:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)";

describe("flavor", () => {
  test("lint uses the flavor discourse by default, and --flavor markdown-it changes the tables it finds", async () => {
    const dir = repo({ "a.md": HTML_TABLE });
    const a = join(dir, "a.md");
    expect(await cli(["lint", a])).toEqual({ code: 0, out: "", err: "" });
    expect(await cli(["lint", "--flavor", "discourse", a])).toEqual({ code: 0, out: "", err: "" });
    expect(await cli(["lint", "--flavor", "markdown-it", a])).toEqual({ code: 1, out: `${a}:${HTML_TABLE_ERROR}\n1 error and 0 warnings.\n`, err: "" });
  });

  test("convert uses the flavor discourse by default, and --flavor=markdown-it converts the table", async () => {
    const dir = repo({ "a.md": HTML_TABLE });
    const a = join(dir, "a.md");
    expect(await cli(["convert", a])).toEqual({ code: 0, out: "", err: "" });
    expect(readFileSync(a, "utf8")).toBe(HTML_TABLE);
    expect(await cli(["convert", "--flavor=markdown-it", a])).toEqual({ code: 0, out: `${a}: converted 1 table\n`, err: "" });
    expect(readFileSync(a, "utf8")).toBe(HTML_TABLE_AS_TBL);
  });

  test("the flavor of .tbl-md.json applies to lint and convert, for each file by its nearest configuration", async () => {
    const dir = repo({ "a.md": HTML_TABLE, "sub/b.md": HTML_TABLE, "sub/.tbl-md.json": '{"flavor": "markdown-it"}' });
    const [a, b] = [join(dir, "a.md"), join(dir, "sub/b.md")];
    expect(await cli(["lint", a, b])).toEqual({ code: 1, out: `${b}:${HTML_TABLE_ERROR}\n1 error and 0 warnings.\n`, err: "" });
    expect(await cli(["convert", a, b])).toEqual({ code: 0, out: `${b}: converted 1 table\n`, err: "" });
    expect(readFileSync(a, "utf8")).toBe(HTML_TABLE);
    expect(readFileSync(b, "utf8")).toBe(HTML_TABLE_AS_TBL);
  });

  test("--flavor wins over the flavor of .tbl-md.json, and lint still uses the attribute keys of the file", async () => {
    const dir = repo({ "a.md": HTML_TABLE + "\n" + KEYS_TBL, ".tbl-md.json": '{"flavor": "markdown-it", "attributeKeys": ["status", "owner"]}' });
    const a = join(dir, "a.md");
    expect((await cli(["lint", a])).out).toBe(`${a}:${HTML_TABLE_ERROR}\n1 error and 0 warnings.\n`);
    expect(await cli(["lint", "--flavor", "discourse", a])).toEqual({ code: 0, out: "", err: "" });
    expect(await cli(["convert", "--flavor", "discourse", a])).toEqual({ code: 0, out: "", err: "" });
    expect(readFileSync(a, "utf8")).toBe(HTML_TABLE + "\n" + KEYS_TBL);
  });

  test("convert --config uses the flavor of that file and does not search for .tbl-md.json", async () => {
    const dir = repo({ "a.md": HTML_TABLE, ".tbl-md.json": '{"flavor": "discourse"}', "other.json": '{"flavor": "markdown-it"}' });
    const a = join(dir, "a.md");
    expect(await cli(["convert", "--config", join(dir, "other.json"), a])).toEqual({ code: 0, out: `${a}: converted 1 table\n`, err: "" });
    expect(readFileSync(a, "utf8")).toBe(HTML_TABLE_AS_TBL);
  });

  test("convert with stdin reads the configuration of the current folder", () => {
    const dir = repo({ ".tbl-md.json": '{"flavor": "markdown-it"}' });
    const result = spawnSync(process.execPath, [join(root, "src/cli.ts"), "convert", "-"], { cwd: dir, encoding: "utf8", input: HTML_TABLE });
    expect([result.status, result.stdout, result.stderr]).toEqual([0, HTML_TABLE_AS_TBL, "-: converted 1 table\n"]);
  });

  test.each([
    ["a broken .tbl-md.json", ["convert"], '{"flavor": "gitlab"}', /^tbl-md: .*\/sub\/\.tbl-md\.json: The value "gitlab" of "flavor" is not a flavor\. Give one of "discourse", "markdown-it"\.\n$/],
    ["a broken .tbl-md.json also with --flavor", ["convert", "--flavor", "markdown-it"], "{", /^tbl-md: .*\/sub\/\.tbl-md\.json(:1)?: The file is not valid JSON: /],
  ])("%s stops convert with exit code 2 before any file changes", async (_, args, text, message) => {
    const dir = repo({ "a.md": GFM, "sub/b.md": GFM, "sub/.tbl-md.json": text });
    const run = await cli([...args, join(dir, "a.md"), join(dir, "sub/b.md")]);
    expect(run.code).toBe(2);
    expect(run.out).toBe("");
    expect(run.err).toMatch(message);
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe(GFM);
    expect(readFileSync(join(dir, "sub/b.md"), "utf8")).toBe(GFM);
  });

  test("a convert --config file that does not exist is a configuration error, and no file changes", async () => {
    const dir = repo({ "a.md": GFM });
    const run = await cli(["convert", "--config", join(dir, "missing.json"), join(dir, "a.md")]);
    expect(run).toEqual({ code: 2, out: "", err: `tbl-md: ${dir}/missing.json: Cannot read the configuration file: no such file.\n` });
    expect(readFileSync(join(dir, "a.md"), "utf8")).toBe(GFM);
  });

  test("a bad flavor in .tbl-md.json stops lint with exit code 2", async () => {
    const dir = repo({ "a.md": PLAIN, ".tbl-md.json": '{"flavor": 1}' });
    const run = await cli(["lint", join(dir, "a.md")]);
    expect(run).toEqual({ code: 2, out: "", err: `tbl-md: ${dir}/.tbl-md.json: The value 1 of "flavor" is not a flavor. Give one of "discourse", "markdown-it".\n` });
  });
});

describe("help and version", () => {
  test.each(["--help", "-h", "lint --help"])("%s prints the usage to stdout and exits 0", async (args) => {
    expect(await cli(args.split(" "))).toEqual({ code: 0, out: `${USAGE}\n`, err: "" });
  });

  test("--version prints the version of package.json", async () => {
    const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
    expect(await cli(["--version"])).toEqual({ code: 0, out: `${version}\n`, err: "" });
  });
});

describe("usage errors exit 2 with one line on stderr", () => {
  const cases: [string, string[], RegExp][] = [
    ["no command", [], /No command/],
    ["an unknown command", ["fmt", "a.md"], /Unknown command "fmt"/],
    ["an unknown option", ["lint", "--fix", "a.md"], /Unknown option '--fix'/],
    ["--to with no value", ["convert", "--to"], /--to/],
    ["a bad --to", ["convert", "--to", "html", "a.md"], /Bad value "html" for --to/],
    ["--to for lint", ["lint", "--to", "gfm", "a.md"], /--to is only for convert/],
    ["no files for lint", ["lint"], /No files/],
    ["no files for convert", ["convert", "--to", "gfm"], /No files/],
    ["- two times", ["lint", "-", "-"], /- can come only once/],
    ["--drop-attributes for lint", ["lint", "--drop-attributes", "a.md"], /--drop-attributes is only for convert --to gfm/],
    ["a bad --flavor for lint", ["lint", "--flavor", "gitlab", "a.md"], /Bad value "gitlab" for --flavor\. Give discourse or markdown-it\./],
    ["a bad --flavor for convert", ["convert", "--flavor=Discourse", "a.md"], /Bad value "Discourse" for --flavor\. Give discourse or markdown-it\./],
    ["--flavor with no value", ["lint", "--flavor"], /--flavor/],
    ["--max-warnings for convert", ["convert", "--max-warnings", "0", "a.md"], /--max-warnings is only for lint/],
    ["a bad value of --max-warnings", ["lint", "--max-warnings", "x", "a.md"], /Bad value "x" for --max-warnings/],
    ["a fraction for --max-warnings", ["lint", "--max-warnings", "1.5", "a.md"], /Bad value "1.5" for --max-warnings/],
    ["--drop-attributes with --to tbl", ["convert", "--to", "tbl", "--drop-attributes", "a.md"], /--drop-attributes is only for convert --to gfm/],
    ["--drop-attributes with the default --to", ["convert", "--drop-attributes", "a.md"], /--drop-attributes is only for convert --to gfm/],
    ["--drop-attributes with a value", ["convert", "--to", "gfm", "--drop-attributes=yes", "a.md"], /--drop-attributes/],
  ];
  test.each(cases)("%s", async (_name, args, message) => {
    const run = await cli(args, "");
    expect(run.code).toBe(2);
    expect(run.out).toBe("");
    expect(run.err).toMatch(message);
    expect(run.err).toMatch(/^tbl-md: .*Run `tbl-md --help` for the usage\.\n$/);
  });

  test("a file that cannot be read stops the run before any file changes", async () => {
    const [a] = files({ "a.md": GFM });
    const missing = join(tempDir("cli"), "missing.md");
    const run = await cli(["convert", a!, missing]);
    expect(run.code).toBe(2);
    expect(run.out).toBe("");
    expect(run.err).toBe(`tbl-md: Cannot read the file "${missing}": no such file. Run \`tbl-md --help\` for the usage.\n`);
    expect(readFileSync(a!, "utf8")).toBe(GFM);
  });

  test("a folder cannot be read", async () => {
    const dir = tempDir("cli");
    mkdirSync(join(dir, "sub.md"));
    const run = await cli(["lint", join(dir, "sub.md")]);
    expect(run.code).toBe(2);
    expect(run.err).toContain("it is a folder");
  });

  test("-- ends the options, so a later --help is a file name", async () => {
    const run = await cli(["lint", "--", "--help"]);
    expect(run.code).toBe(2);
    expect(run.err).toContain('Cannot read the file "--help": no such file.');
  });

  test("- with no stdin is a usage error", async () => {
    const run = await cli(["lint", "-"]);
    expect(run.code).toBe(2);
    expect(run.err).toContain("needs stdin");
  });
});

describe("the process", () => {
  test("bun src/cli.ts runs as a program with exit codes and output", () => {
    const [a] = files({ "a.md": GFM });
    const run = (args: string[], input?: string) =>
      spawnSync(process.execPath, [join(root, "src/cli.ts"), ...args], { encoding: "utf8", input });
    const linted = run(["lint", a!]);
    expect(linted.status).toBe(1);
    expect(linted.stdout).toStartWith(`${a}:3:1: This is a GFM pipe table.`);
    const piped = run(["convert", "-"], GFM);
    expect([piped.status, piped.stdout, piped.stderr]).toEqual([0, GFM_AS_TBL, "-: converted 1 table\n"]);
    const converted = run(["convert", a!]);
    expect([converted.status, converted.stdout]).toEqual([0, `${a}: converted 1 table\n`]);
    expect(run(["lint", a!]).status).toBe(0);
    const usage = run(["nope"]);
    expect([usage.status, usage.stdout]).toEqual([2, ""]);
    expect(usage.stderr).toContain('Unknown command "nope"');
  });
});

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
