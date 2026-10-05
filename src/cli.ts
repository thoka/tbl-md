#!/usr/bin/env node
// The command line of tbl-md: `tbl-md lint <files...>` and `tbl-md convert [--to tbl|gfm] <files...>`.
// It uses only `node:` modules and the library, so that it runs on Node and on Bun.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { convert } from "./convert.ts";
import { lint } from "./lint.ts";

export const USAGE = `Usage: tbl-md <command> [options] <files...>

Commands:
  lint <files...>                    Report each GFM pipe table and each error of a tbl block.
  convert [--to tbl|gfm] <files...>  Convert the tables of each file in place. --to defaults to tbl:
                                     each GFM table becomes a tbl block. --to gfm converts back.

The file name - reads stdin. convert then writes the result to stdout.

Options:
  -h, --help     Print this usage.
  --version      Print the version.

Exit codes: 0 no problem, 1 a problem in a file, 2 a usage error.`;

const HINT = "Run `tbl-md --help` for the usage.";
const BOM = "﻿";

/** The streams of one run. Tests pass their own, the entry passes the process streams. */
export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Reads all of stdin as UTF-8 text. Needed only for the file name `-`. */
  stdin?: () => Promise<string>;
}

class UsageError extends Error {}

/** One input: its name, its text with no BOM, and whether it had a BOM. */
interface Input {
  name: string;
  text: string;
  bom: boolean;
}

/** Runs the CLI with the arguments after the program name and gives the exit code: 0, 1, or 2. */
export async function main(argv: string[], io: Io): Promise<number> {
  try {
    return await run(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`tbl-md: ${error.message} ${HINT}\n`);
      return 2;
    }
    throw error;
  }
}

async function run(argv: string[], io: Io): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        version: { type: "boolean" },
        to: { type: "string" },
      },
    });
  } catch (error) {
    // parseArgs names the bad option in its message, for example "Unknown option '--x'".
    throw new UsageError(`${firstSentence((error as Error).message)}.`);
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(`${USAGE}\n`);
    return 0;
  }
  if (values.version) {
    io.stdout(`${version()}\n`);
    return 0;
  }
  const [command, ...files] = positionals;
  if (command === undefined) throw new UsageError("No command. Give lint or convert.");
  if (command !== "lint" && command !== "convert") throw new UsageError(`Unknown command "${command}". Give lint or convert.`);
  if (command === "lint" && values.to !== undefined) throw new UsageError("The option --to is only for convert.");
  const to = values.to ?? "tbl";
  if (to !== "tbl" && to !== "gfm") throw new UsageError(`Bad value "${to}" for --to. Give tbl or gfm.`);
  if (files.length === 0) throw new UsageError(`No files. Give one or more Markdown files after ${command}.`);
  if (files.filter((f) => f === "-").length > 1) throw new UsageError("The file name - can come only once.");

  // Read all inputs first, so that a file that cannot be read stops the run before any file changes.
  const inputs: Input[] = [];
  for (const name of files) inputs.push(await read(name, io));

  return command === "lint" ? runLint(inputs, io) : runConvert(inputs, to, io);
}

function runLint(inputs: Input[], io: Io): number {
  let found = false;
  for (const input of inputs) {
    for (const p of lint(input.text)) {
      found = true;
      io.stdout(`${input.name}:${p.line}:${p.column}: ${p.message} (${p.code})\n`);
    }
  }
  return found ? 1 : 0;
}

function runConvert(inputs: Input[], to: "tbl" | "gfm", io: Io): number {
  let failed = false;
  for (const input of inputs) {
    const stdin = input.name === "-";
    // With stdin, stdout carries the text, so the messages go to stderr.
    const say = stdin ? io.stderr : io.stdout;
    const result = convert(input.text, { to });
    if (!result.ok) {
      failed = true;
      for (const e of result.errors) say(`${input.name}:${e.line}:${e.column}: ${e.message}\n`);
      continue;
    }
    const output = (input.bom ? BOM : "") + result.output;
    if (stdin) io.stdout(output);
    else if (result.count > 0) writeFileSync(input.name, output, "utf8");
    if (result.count > 0) say(`${input.name}: converted ${result.count} ${result.count === 1 ? "table" : "tables"}\n`);
  }
  return failed ? 1 : 0;
}

async function read(name: string, io: Io): Promise<Input> {
  let text: string;
  if (name === "-") {
    if (io.stdin === undefined) throw new UsageError("The file name - needs stdin, and this run has none.");
    text = await io.stdin();
  } else {
    try {
      text = readFileSync(name, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      const why = code === "ENOENT" ? "no such file" : code === "EISDIR" ? "it is a folder" : (code ?? (error as Error).message);
      throw new UsageError(`Cannot read the file "${name}": ${why}.`);
    }
  }
  const bom = text.startsWith(BOM);
  return { name, text: bom ? text.slice(1) : text, bom };
}

/** The version of package.json. The path is relative to this module, so it works from src/ and from dist/. */
function version(): string {
  const require = createRequire(import.meta.url);
  return (require("../package.json") as { version: string }).version;
}

function firstSentence(message: string): string {
  return message.split(/\.\s/)[0]!.replace(/\.$/, "");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** True if this module is the program, not a module that a test imports. Node before 24.2 has no import.meta.main. */
function isProgram(): boolean {
  const flag = (import.meta as { main?: boolean }).main;
  if (flag !== undefined) return flag;
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    // A bin link of npm points to this file, so compare the real paths.
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isProgram()) {
  process.exitCode = await main(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    stdin: readStdin,
  });
}
