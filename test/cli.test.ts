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

  test("each problem has the form file:line:column: message (code), in file order and then line order", async () => {
    const [a, b] = files({ "a.md": BAD_TBL + "\n" + GFM, "b.md": GFM });
    const run = await cli(["lint", b!, a!]);
    expect(run.code).toBe(1);
    expect(run.err).toBe("");
    const lines = run.out.trimEnd().split("\n");
    expect(lines).toEqual([
      `${b}:3:1: This is a GFM pipe table. Write it as a tbl block, for example with \`tbl-md convert\`. (gfm-table)`,
      expect.stringMatching(new RegExp(`^${escape(a!)}:6:1: The key "b" matches no header key\\..* \\(unknown-key\\)$`)),
      `${a}:11:1: This is a GFM pipe table. Write it as a tbl block, for example with \`tbl-md convert\`. (gfm-table)`,
    ]);
  });

  test("the file name - reads stdin and names the file -", async () => {
    const run = await cli(["lint", "-"], GFM);
    expect(run).toEqual({ code: 1, out: "-:3:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)\n", err: "" });
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
    expect(lines[0]).toMatch(new RegExp(`^${escape(bad!)}:3:1: \\S`));
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
    expect(run.out).toContain(`${b}:3:1: `);
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
    expect(run.err).toMatch(/^-:3:1: \S/);
  });

  test("- keeps the BOM and CRLF of stdin", async () => {
    const run = await cli(["convert", "-"], "﻿" + GFM.replaceAll("\n", "\r\n"));
    expect(run.out).toBe("﻿" + GFM_AS_TBL.replaceAll("\n", "\r\n"));
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
