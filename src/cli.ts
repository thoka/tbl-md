#!/usr/bin/env node
// The command line of tbl-md: `tbl-md lint [--flavor <flavor>] [--config <file>] [--max-warnings <n>] <files...>`
// and `tbl-md convert [--to tbl|gfm] [--drop-attributes] [--flavor <flavor>] [--config <file>] <files...>`.
// It uses only `node:` modules and the library, so that it runs on Node and on Bun.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { convert, type ConvertOptions } from "./convert.ts";
import { CONFIG_FILE, findConfig, readConfig, type Config, type ConfigError } from "./config.ts";
import { DEFAULT_FLAVOR, FLAVORS, type Flavor } from "./flavor.ts";
import { lint } from "./lint.ts";

export const USAGE = `Usage: tbl-md <command> [options] <files...>

Commands:
  lint <files...>                    Report each GFM pipe table and each error of a tbl block as an error,
                                     and each attribute key that .tbl-md.json does not list as a warning.
  convert [--to tbl|gfm] <files...>  Convert the tables of each file in place. --to defaults to tbl:
                                     each GFM table becomes a tbl block. --to gfm converts back.

The file name - reads stdin. convert then writes the result to stdout.

Options:
  -h, --help         Print this usage.
  --version          Print the version.
  --drop-attributes  Only with convert --to gfm. Drop each attribute that GFM cannot hold,
                     with no error. The align of the columns and the IDs of the rows stay.
  --flavor <flavor>  The target renderer of GFM: discourse or markdown-it. It overrides the flavor
                     of .tbl-md.json. The default is discourse.
  --config <file>    Use this configuration file, and do not search for .tbl-md.json.
                     convert uses only its flavor.
  --max-warnings <n> Only with lint. Fail if there are more than n warnings. No limit by default.

Exit codes: 0 no error, and not more warnings than --max-warnings. 1 an error in a file, or more
warnings than --max-warnings. 2 a usage error or an error in the configuration file.`;

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

/** A configuration file that cannot be read or is not valid. The run stops with exit code 2. */
class ConfigFailure extends Error {
  constructor(readonly error: ConfigError) {
    super(error.message);
  }
}

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
    if (error instanceof ConfigFailure) {
      const { file, line, message } = error.error;
      io.stderr(`tbl-md: ${file}${line === undefined ? "" : `:${line}`}: ${message}\n`);
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
        "drop-attributes": { type: "boolean" },
        config: { type: "string" },
        flavor: { type: "string" },
        "max-warnings": { type: "string" },
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
  const dropAttributes = values["drop-attributes"] === true;
  if (dropAttributes && (command === "lint" || to === "tbl")) {
    throw new UsageError("The option --drop-attributes is only for convert --to gfm.");
  }
  const flavor = values.flavor === undefined ? undefined : flavorOf(values.flavor);
  if (command === "convert" && values["max-warnings"] !== undefined) throw new UsageError("The option --max-warnings is only for lint.");
  const maxWarnings = values["max-warnings"] === undefined ? undefined : count(values["max-warnings"]);
  if (files.length === 0) throw new UsageError(`No files. Give one or more Markdown files after ${command}.`);
  if (files.filter((f) => f === "-").length > 1) throw new UsageError("The file name - can come only once.");

  // Read all inputs first, so that a file that cannot be read stops the run before any file changes.
  const inputs: Input[] = [];
  for (const name of files) inputs.push(await read(name, io));

  // Read the configuration of all inputs first, so that an error in a configuration file stops the run before any output
  // and before any file changes. This also happens with --flavor: lint needs the attribute keys, and convert behaves the same.
  const configs = configurations(inputs, values.config);
  // --flavor wins over the flavor of the configuration, and that wins over the default.
  const flavors = configs.map(({ config }) => flavor ?? config.flavor ?? DEFAULT_FLAVOR);
  if (command === "convert") return runConvert(inputs, flavors, { to, dropAttributes }, io);
  return runLint(inputs, configs, flavors, maxWarnings, io);
}

/** The value of --max-warnings: a whole number, 0 or more. */
function count(value: string): number {
  if (!/^\d+$/.test(value)) throw new UsageError(`Bad value "${value}" for --max-warnings. Give a whole number, 0 or more.`);
  return Number(value);
}

/** The value of --flavor: one of FLAVORS. */
function flavorOf(value: string): Flavor {
  if (!(FLAVORS as readonly string[]).includes(value)) throw new UsageError(`Bad value "${value}" for --flavor. Give ${FLAVORS.join(" or ")}.`);
  return value as Flavor;
}

/** The configuration of one input: the file that gives it (null if none), and its content. */
interface Configured {
  file: string | null;
  config: Config;
}

/**
 * Finds and reads the configuration of each input. `--config` gives one file for all inputs. Else the search starts in the
 * folder of each file, and in the current folder for stdin. Each folder and each file is read once.
 */
function configurations(inputs: Input[], option: string | undefined): Configured[] {
  const loaded = new Map<string, Config>();
  const load = (file: string): Config => {
    let config = loaded.get(file);
    if (config === undefined) {
      const result = readConfig(file);
      if (!result.ok) throw new ConfigFailure({ ...result.error, file: show(file) });
      config = result.config;
      loaded.set(file, config);
    }
    return config;
  };
  const found = new Map<string, string | null>();
  return inputs.map((input) => {
    if (option !== undefined) return { file: option, config: load(option) };
    const folder = input.name === "-" ? process.cwd() : dirname(input.name);
    let file = found.get(folder);
    if (file === undefined) {
      file = findConfig(folder);
      found.set(folder, file);
    }
    return file === null ? { file: null, config: { attributeKeys: [] } } : { file: show(file), config: load(file) };
  });
}

/** A path for a message: relative to the current folder if the file is in it, else as it is. */
function show(file: string): string {
  if (!isAbsolute(file)) return file;
  const path = relative(process.cwd(), file);
  return path === "" || path.startsWith("..") || isAbsolute(path) ? file : path;
}

function runLint(inputs: Input[], configs: Configured[], flavors: Flavor[], maxWarnings: number | undefined, io: Io): number {
  let errors = 0;
  let warnings = 0;
  inputs.forEach((input, i) => {
    const { file, config } = configs[i]!;
    for (const p of lint(input.text, { attributeKeys: config.attributeKeys, flavor: flavors[i]! })) {
      if (p.severity === "error") {
        errors++;
        io.stdout(`${input.name}:${p.line}:${p.column}: ${p.message} (${p.code})\n`);
        continue;
      }
      warnings++;
      const where =
        p.code !== "unknown-attribute-key"
          ? ""
          : file === null
            ? ` No ${CONFIG_FILE} was found, so only "align" is known.`
            : ` The configuration file is ${file}.`;
      io.stdout(`${input.name}:${p.line}:${p.column}: warning: ${p.message}${where} (${p.code})\n`);
    }
  });
  const tooMany = maxWarnings !== undefined && warnings > maxWarnings;
  if (errors + warnings > 0) {
    const limit = tooMany ? ` The warnings are more than --max-warnings ${maxWarnings}.` : "";
    io.stdout(`${plural(errors, "error")} and ${plural(warnings, "warning")}.${limit}\n`);
  }
  return errors > 0 || tooMany ? 1 : 0;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function runConvert(inputs: Input[], flavors: Flavor[], options: ConvertOptions, io: Io): number {
  let failed = false;
  for (const [i, input] of inputs.entries()) {
    const stdin = input.name === "-";
    // With stdin, stdout carries the text, so the messages go to stderr.
    const say = stdin ? io.stderr : io.stdout;
    const result = convert(input.text, { ...options, flavor: flavors[i]! });
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
