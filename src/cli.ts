#!/usr/bin/env node
// The command line of tbl-md: `tbl-md lint`, `tbl-md convert`, and `tbl-md help`. Its commands, options, and help texts
// come from the one command definition in commands.ts.
// It uses only `node:` modules and the library, so that it runs on Node and on Bun.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { BIN, command, commandHelp, helpJson, parseOptions, shortHelp, TOP_USAGE, usageLine } from "./commands.ts";
import { convert, type ConvertOptions } from "./convert.ts";
import { CONFIG_FILE, findConfig, readConfig, type Config, type ConfigError } from "./config.ts";
import { DEFAULT_FLAVOR, FLAVORS, type Flavor } from "./flavor.ts";
import { lint } from "./lint.ts";

const BOM = "﻿";

/** The option values that parseArgs gives for the options of commands.ts. */
interface Values {
  help?: boolean;
  version?: boolean;
  json?: boolean;
  to?: string;
  "drop-attributes"?: boolean;
  config?: string;
  flavor?: string;
  "max-warnings"?: string;
}

/** The streams of one run. Tests pass their own, the entry passes the process streams. */
export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Reads all of stdin as UTF-8 text. Needed only for the file name `-`. */
  stdin?: () => Promise<string>;
}

/** A usage error. `command` names the command whose usage line and help the message points to. */
class UsageError extends Error {
  command: string | undefined;
  constructor(message: string, command?: string) {
    super(message);
    this.command = command;
  }
}

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
  const options = beforeDashDash(argv);
  // With --json, an error is one JSON object on stderr.
  const json = options.includes("--json");
  try {
    return await run(argv, io);
  } catch (error) {
    if (error instanceof UsageError) {
      const name = error.command ?? guessCommand(argv);
      const fix = `Run '${BIN} help${name === undefined ? "" : ` ${name}`}' for the details.`;
      if (json) {
        io.stderr(`${JSON.stringify({ error: { type: "usage", message: error.message, fix } })}\n`);
      } else {
        const def = name === undefined ? undefined : command(name);
        io.stderr(`${BIN}: ${error.message}\nusage: ${def === undefined ? TOP_USAGE : usageLine(def)}\n${fix}\n`);
      }
      return 2;
    }
    if (error instanceof ConfigFailure) {
      const { file, line, message } = error.error;
      const where = `${file}${line === undefined ? "" : `:${line}`}`;
      if (json) {
        io.stderr(`${JSON.stringify({ error: { type: "config", message: `${where}: ${message}`, fix: `Fix the configuration file ${file}.` } })}\n`);
      } else {
        io.stderr(`${BIN}: ${where}: ${message}\n`);
      }
      return 2;
    }
    throw error;
  }
}

/** The arguments before `--`: only they can be options. */
function beforeDashDash(argv: string[]): string[] {
  const end = argv.indexOf("--");
  return end === -1 ? argv : argv.slice(0, end);
}

/** The first argument that is a command name, if any. */
function guessCommand(argv: string[]): string | undefined {
  return beforeDashDash(argv).find((a) => command(a) !== undefined);
}

async function run(argv: string[], io: Io): Promise<number> {
  // -h and --help win over all other arguments.
  const options = beforeDashDash(argv);
  if (options.includes("-h") || options.includes("--help")) {
    const name = guessCommand(argv);
    const def = name === undefined ? undefined : command(name);
    io.stdout(`${def === undefined ? shortHelp(version()) : commandHelp(def)}\n`);
    return 0;
  }
  if (argv.length === 0) {
    io.stdout(`${shortHelp(version())}\n`);
    return 0;
  }
  let parsed;
  try {
    parsed = parseArgs({ args: argv, allowPositionals: true, strict: true, options: parseOptions() });
  } catch (error) {
    // parseArgs names the bad option in its message, for example "Unknown option '--x'".
    throw new UsageError(`${firstSentence((error as Error).message)}.`);
  }
  const positionals = parsed.positionals;
  const values = parsed.values as Values;
  if (values.version) {
    io.stdout(`${version()}\n`);
    return 0;
  }
  const [name, ...files] = positionals;
  if (name === undefined) throw new UsageError("No command. Give lint, convert, or help.");
  if (name === "help") return runHelp(files, values.json === true, io);
  if (name !== "lint" && name !== "convert") throw new UsageError(`Unknown command "${name}". Give lint, convert, or help.`);
  if (name === "lint" && values.to !== undefined) throw new UsageError("The option --to is only for convert.");
  if (name === "convert" && values.json !== undefined) throw new UsageError("The option --json is only for lint and help.");
  const to = values.to ?? "tbl";
  if (to !== "tbl" && to !== "gfm") throw new UsageError(`Bad value "${to}" for --to. Give tbl or gfm.`);
  const dropAttributes = values["drop-attributes"] === true;
  if (dropAttributes && (name === "lint" || to === "tbl")) {
    throw new UsageError("The option --drop-attributes is only for convert --to gfm.", "convert");
  }
  const flavor = values.flavor === undefined ? undefined : flavorOf(values.flavor);
  if (name === "convert" && values["max-warnings"] !== undefined) throw new UsageError("The option --max-warnings is only for lint.");
  const maxWarnings = values["max-warnings"] === undefined ? undefined : count(values["max-warnings"]);
  if (files.length === 0) throw new UsageError(`No files. Give one or more Markdown files after ${name}.`);
  if (files.filter((f) => f === "-").length > 1) throw new UsageError("The file name - can come only once.");

  // Read all inputs first, so that a file that cannot be read stops the run before any file changes.
  const inputs: Input[] = [];
  for (const file of files) inputs.push(await read(file, io));

  // Read the configuration of all inputs first, so that an error in a configuration file stops the run before any output
  // and before any file changes. This also happens with --flavor: lint needs the attribute keys, and convert behaves the same.
  const configs = configurations(inputs, values.config);
  // --flavor wins over the flavor of the configuration, and that wins over the default.
  const flavors = configs.map(({ config }) => flavor ?? config.flavor ?? DEFAULT_FLAVOR);
  if (name === "convert") return runConvert(inputs, flavors, { to, dropAttributes }, io);
  return runLint(inputs, configs, flavors, maxWarnings, values.json === true, io);
}

/** `tbl-md help [--json] [<command>]`. */
function runHelp(topics: string[], json: boolean, io: Io): number {
  if (topics.length > 1) throw new UsageError("Give at most one command after help.", "help");
  if (json) {
    io.stdout(`${JSON.stringify(helpJson(version()), null, 2)}\n`);
    return 0;
  }
  const [topic] = topics;
  if (topic === undefined) {
    io.stdout(`${shortHelp(version())}\n`);
    return 0;
  }
  const def = command(topic);
  if (def === undefined) throw new UsageError(`Unknown command "${topic}". Give lint, convert, or help.`, "help");
  io.stdout(`${commandHelp(def)}\n`);
  return 0;
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

/** One problem of the lint, as the JSON output gives it. */
interface Problem {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  code: string;
  message: string;
}

function runLint(inputs: Input[], configs: Configured[], flavors: Flavor[], maxWarnings: number | undefined, json: boolean, io: Io): number {
  const problems: Problem[] = [];
  inputs.forEach((input, i) => {
    const { file, config } = configs[i]!;
    for (const p of lint(input.text, { attributeKeys: config.attributeKeys, flavor: flavors[i]! })) {
      const where =
        p.severity === "error" || p.code !== "unknown-attribute-key"
          ? ""
          : file === null
            ? ` No ${CONFIG_FILE} was found, so only "align" is known.`
            : ` The configuration file is ${file}.`;
      problems.push({ file: input.name, line: p.line, column: p.column, severity: p.severity, code: p.code, message: p.message + where });
    }
  });
  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;
  const tooMany = maxWarnings !== undefined && warnings > maxWarnings;
  if (json) {
    io.stdout(`${JSON.stringify({ errors, warnings, maxWarnings: maxWarnings ?? null, problems }, null, 2)}\n`);
    return errors > 0 || tooMany ? 1 : 0;
  }
  for (const p of problems) {
    const warning = p.severity === "warning" ? "warning: " : "";
    io.stdout(`${p.file}:${p.line}:${p.column}: ${warning}${p.message} (${p.code})\n`);
  }
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
