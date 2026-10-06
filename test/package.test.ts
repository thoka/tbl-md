// The package test: it packs the package with `npm pack`, installs the tarball in a new temp project with npm,
// and runs the installed CLI and the library with Node 24, Node 22, and Bun. It also checks the file list of
// the tarball and the type declarations of the library.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const TSC = join(ROOT, "node_modules", ".bin", "tsc");
/** The version of the package. release-please changes it with each release, so no test hardcodes it. */
const VERSION: string = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** The runtimes that run the installed package. Each entry is the command prefix of `mise exec`. */
const NODES = ["node@24.20.0", "node@22"];

const GFM = "# Doc\n\n| Model | Price |\n| --- | --- |\n| Opus | $15 |\n";

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(command: string, args: string[], cwd: string): Run {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Runs a command and fails with its output if it does not exit with 0. */
function ok(command: string, args: string[], cwd: string): string {
  const result = run(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

interface PackFile {
  path: string;
}

let temp = "";
let consumer = "";
let files: string[] = [];
let bin = "";

beforeAll(() => {
  temp = mkdtempSync(join(tmpdir(), "tbl-md-package-"));
  // npm pack runs the prepack script, so the tarball has a new build.
  const packed = JSON.parse(ok("npm", ["pack", "--json", "--pack-destination", temp], ROOT)) as {
    filename: string;
    size: number;
    files: PackFile[];
  }[];
  const info = packed[0];
  if (!info) throw new Error("npm pack gave no tarball");
  files = info.files.map((file) => file.path).sort();
  console.log(`tarball ${info.filename}: ${info.size} bytes, ${files.length} files`);

  consumer = join(temp, "consumer");
  ok("mkdir", ["-p", consumer], temp);
  writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ name: "consumer", private: true, type: "module" })}\n`);
  ok("npm", ["install", "--no-audit", "--no-fund", join(temp, info.filename)], consumer);
  bin = join(consumer, "node_modules", ".bin", "tbl-md");
}, 120_000);

afterAll(() => {
  if (temp) rmSync(temp, { recursive: true, force: true });
});

describe("the tarball", () => {
  test("has the build, the format, the schema, the README, and the license", () => {
    const names = ["LICENSE", "README.md", "dist/cli.js", "dist/index.d.ts", "dist/index.js", "docs/format.md", "package.json"];
    for (const name of [...names, "schema/tbl-md.schema.json"]) {
      expect(files).toContain(name);
    }
  });

  test("has no source, no test, and no config of the project", () => {
    const allowed = /^(LICENSE|README\.md|package\.json|docs\/format\.md|schema\/tbl-md\.schema\.json|dist\/[a-z]+\.(js|d\.ts))$/;
    expect(files.filter((name) => !allowed.test(name))).toEqual([]);
  });
});

/** Writes a Markdown file with one GFM table into a new folder of the consumer and gives the folder. */
function docFolder(name: string): string {
  const folder = join(consumer, name);
  ok("mkdir", ["-p", folder], consumer);
  writeFileSync(join(folder, "a.md"), GFM);
  return folder;
}

const IMPORT_SCRIPT = `import { convert, parse, render } from "tbl-md";
const result = parse("model: Model\\n--\\nm: Opus");
if (!result.ok) throw new Error("parse failed");
const converted = convert(${JSON.stringify(GFM)}, { to: "tbl" });
console.log(JSON.stringify({ render: render(result.table), converted }));
`;

for (const node of NODES) {
  describe(`the installed package on ${node}`, () => {
    const exec = (args: string[], cwd: string) => run("mise", ["exec", node, "--", ...args], cwd);

    test("runs the bin through its #! line with this Node", () => {
      // The bin runs with `/usr/bin/env node`, so this also checks that the Node of mise is the one that runs.
      const version = exec(["node", "--version"], consumer);
      expect(version.stdout).toStartWith(`v${node.split("@")[1]}`);
      const result = exec([bin, "--version"], consumer);
      expect(result).toEqual({ status: 0, stdout: `${VERSION}\n`, stderr: "" });
    });

    test("lint fails on a GFM table with its message, and convert converts it", () => {
      const folder = docFolder(`doc-${node}`);
      const lint = exec([bin, "lint", "a.md"], folder);
      expect(lint.status).toBe(1);
      expect(lint.stdout).toContain("a.md:3:1: This is a GFM pipe table.");
      expect(lint.stdout).toContain("(gfm-table)");

      const convert = exec([bin, "convert", "a.md"], folder);
      expect(convert).toEqual({ status: 0, stdout: "a.md: converted 1 table\n", stderr: "" });
      expect(readFileSync(join(folder, "a.md"), "utf8")).toBe(
        "# Doc\n\n```tbl\nmodel: Model\nprice: Price\n--\nmodel: Opus\nprice: $15\n```\n",
      );
      expect(exec([bin, "lint", "a.md"], folder).status).toBe(0);
    });

    test("lint reads .tbl-md.json, warns on an unknown key, and names the line of a JSON syntax error", () => {
      const folder = join(consumer, `config-${node}`);
      ok("mkdir", ["-p", folder], consumer);
      writeFileSync(join(folder, "a.md"), "```tbl\na: A\n{status=open owner=me}\n```\n");
      writeFileSync(join(folder, ".tbl-md.json"), '{"attributeKeys": ["status"]}\n');
      const warned = exec([bin, "lint", "a.md"], folder);
      expect(warned.status).toBe(0);
      expect(warned.stdout).toContain('a.md:3:14: warning: The attribute key "owner" is unknown.');
      expect(exec([bin, "lint", "--max-warnings", "0", "a.md"], folder).status).toBe(1);
      // Node gives the position of this syntax error, so the message names the line.
      writeFileSync(join(folder, ".tbl-md.json"), '{\n"attributeKeys": ["status"],\n}\n');
      const broken = exec([bin, "lint", "a.md"], folder);
      expect(broken.status).toBe(2);
      expect(broken.stderr).toStartWith("tbl-md: .tbl-md.json:3: The file is not valid JSON: ");
    });

    test("imports parse, render, and convert in an ESM script", () => {
      const script = join(consumer, "import.mjs");
      writeFileSync(script, IMPORT_SCRIPT);
      const result = exec(["node", script], consumer);
      expect(result.stderr).toBe("");
      const output = JSON.parse(result.stdout) as { render: string; converted: { ok: boolean; count: number } };
      expect(output.render).toBe("model: Model\n--\nmodel: Opus");
      expect(output.converted).toMatchObject({ ok: true, count: 1 });
    });
  });
}

describe("the installed package on Bun", () => {
  test("runs the CLI and the library", () => {
    const folder = docFolder("doc-bun");
    expect(run("bun", [join(consumer, "node_modules", "tbl-md", "dist", "cli.js"), "lint", "a.md"], folder).status).toBe(1);
    writeFileSync(join(consumer, "import-bun.mjs"), IMPORT_SCRIPT);
    const result = run("bun", [join(consumer, "import-bun.mjs")], consumer);
    expect(JSON.parse(result.stdout)).toMatchObject({ render: "model: Model\n--\nmodel: Opus", converted: { ok: true } });
  });
});

describe("the type declarations", () => {
  test("resolve for a consumer with NodeNext and no skipLibCheck", () => {
    writeFileSync(
      join(consumer, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2023",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: [],
        },
        files: ["consumer.ts"],
      }),
    );
    writeFileSync(
      join(consumer, "consumer.ts"),
      `import { convert, findTables, parse, render, type FoundGfm, type Table } from "tbl-md";
const result = parse("a: A");
const table: Table | undefined = result.ok ? result.table : undefined;
const text: string | undefined = table && render(table);
const found = findTables("| A |\\n| --- |\\n")[0] as FoundGfm;
const kind: "table" = found.node.type;
const count: number = convert("", { to: "gfm" }).ok ? 1 : 0;
// @ts-expect-error The library has no default export.
import def from "tbl-md";
export { text, kind, count, def };
`,
    );
    const result = run(TSC, ["-p", "tsconfig.json"], consumer);
    expect(result.stdout + result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
