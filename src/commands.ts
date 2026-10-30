// The one command definition of the tbl-md CLI. The short help, the help of each command, `help --json`,
// and the options of the parser come from this table, so that they cannot drift apart.
// It uses only `node:` modules, so that it runs on Node and on Bun.

/** One option of the CLI. */
export interface FlagDef {
  /** The long name, with no dashes. */
  name: string;
  short?: string;
  /** The name of the value, for example `<file>`. None for a boolean flag. */
  value?: string;
  help: string;
  default?: string;
}

/** One argument of a command. */
export interface ArgDef {
  name: string;
  help: string;
  variadic?: boolean;
  required?: boolean;
}

/** One command of the CLI. */
export interface CommandDef {
  name: string;
  /** One line of at most 70 characters, for the short help. */
  summary: string;
  /** The longer text of the help of the command. */
  about: string;
  effect: "read" | "write";
  args: ArgDef[];
  flags: FlagDef[];
  /** One sentence per exit code. */
  exitCodes: [number, string][];
  examples: string[];
  /** The id of the help document of the command, a document in src/help/ of the repository that `mg get <id>` prints. */
  helpDocument?: string;
}

export const BIN = "tbl-md";
export const ABOUT = "Lint and convert the tables of Markdown files: GFM pipe tables and tbl blocks.";

/** The options that each command takes. */
export const GLOBAL_FLAGS: FlagDef[] = [
  { name: "help", short: "h", help: "print the help (of the command, if one is given)" },
  { name: "version", help: "print the version" },
];

const FLAVOR: FlagDef = {
  name: "flavor",
  value: "<flavor>",
  help: "the target renderer of GFM: discourse or markdown-it. It wins over .tbl-md.json",
  default: "discourse",
};
const CONFIG: FlagDef = {
  name: "config",
  value: "<file>",
  help: "use this configuration file for all files, and do not search for .tbl-md.json",
};
const FILES: ArgDef = { name: "files", help: "the Markdown files. The name - reads stdin", variadic: true, required: true };

export const COMMANDS: CommandDef[] = [
  {
    name: "lint",
    summary: "report each GFM pipe table and each error of a tbl block",
    about:
      "Report each GFM pipe table and each error of a tbl block as an error, and each attribute key\n" +
      "that .tbl-md.json does not list as a warning. One line per problem, then a summary line.\n" +
      "The lint changes no file.",
    effect: "read",
    args: [FILES],
    flags: [
      FLAVOR,
      CONFIG,
      { name: "max-warnings", value: "<n>", help: "fail if there are more than n warnings. No limit by default" },
      { name: "json", help: "print the problems as one JSON object, and an error as JSON on stderr" },
    ],
    exitCodes: [
      [0, "no error, and not more warnings than --max-warnings"],
      [1, "a file has an error, or the warnings are more than --max-warnings"],
      [2, "a usage error, a file that cannot be read, or an error in the configuration file"],
    ],
    examples: ["tbl-md lint --max-warnings 0 /tmp/notes/README.md /tmp/notes/docs/cli.md"],
    helpDocument: "6hYdD6E2",
  },
  {
    name: "convert",
    summary: "convert the tables of each file in place (GFM to tbl, or back)",
    about:
      "Convert the tables of each file in place. With --to tbl (the default), each GFM table becomes\n" +
      "a tbl block. With --to gfm, each tbl block becomes a GFM table. A file with no table to convert\n" +
      "does not change. The file name - reads stdin and writes the result to stdout.",
    effect: "write",
    args: [FILES],
    flags: [
      { name: "to", value: "<tbl|gfm>", help: "the target form of the tables", default: "tbl" },
      {
        name: "drop-attributes",
        help: "only with --to gfm. Drop each attribute that GFM cannot hold, with no error",
      },
      FLAVOR,
      { ...CONFIG, help: `${CONFIG.help}. convert uses only its flavor` },
    ],
    exitCodes: [
      [0, "each file converted, or it had no table to convert"],
      [1, "the conversion of a file failed. That file does not change"],
      [2, "a usage error, a file that cannot be read, or an error in the configuration file"],
    ],
    examples: ["tbl-md convert /tmp/notes/README.md", "tbl-md convert --to gfm --drop-attributes /tmp/notes/README.md"],
  },
  {
    name: "help",
    summary: "print this help, or the help of one command",
    about: "Print the short help, or the help of one command. With --json, print all commands as one JSON object.",
    effect: "read",
    args: [{ name: "command", help: "the command to explain" }],
    flags: [{ name: "json", help: "print the commands as one JSON object in the shape of usage generate json" }],
    exitCodes: [
      [0, "the help was printed"],
      [2, "an unknown command"],
    ],
    examples: ["tbl-md help lint", "tbl-md help --json"],
  },
];

export function command(name: string): CommandDef | undefined {
  return COMMANDS.find((c) => c.name === name);
}

/** The options of `parseArgs` for all commands. Each command checks later which of them it takes. */
export function parseOptions(): Record<string, { type: "string" | "boolean"; short?: string }> {
  const options: Record<string, { type: "string" | "boolean"; short?: string }> = {};
  for (const flag of [...GLOBAL_FLAGS, ...COMMANDS.flatMap((c) => c.flags)]) {
    options[flag.name] = { type: flag.value === undefined ? "boolean" : "string", ...(flag.short ? { short: flag.short } : {}) };
  }
  return options;
}

function flagUsage(flag: FlagDef): string {
  const long = `--${flag.name}${flag.value === undefined ? "" : ` ${flag.value}`}`;
  return flag.short === undefined ? long : `-${flag.short}, ${long}`;
}

function argUsage(arg: ArgDef): string {
  const text = `<${arg.name}>${arg.variadic ? "..." : ""}`;
  return arg.required ? text : `[${text}]`;
}

/** The usage line of one command, with the options before the operands. */
export function usageLine(def: CommandDef): string {
  const flags = def.flags.map((f) => `[--${f.name}${f.value === undefined ? "" : ` ${f.value}`}]`);
  return [`${BIN} ${def.name}`, ...flags, ...def.args.map(argUsage)].join(" ");
}

export const TOP_USAGE = `${BIN} <command> [options] <files...>`;

function rows(items: [string, string][]): string[] {
  const width = Math.max(...items.map(([left]) => left.length)) + 3;
  return items.map(([left, right]) => `  ${left.padEnd(width)}${right}`);
}

/** Level 1: the short help of `tbl-md`, `tbl-md help`, `-h`, and `--help`. */
export function shortHelp(version: string): string {
  return [
    `${BIN} ${version}`,
    ABOUT,
    "",
    `usage: ${TOP_USAGE}`,
    "",
    "Commands:",
    ...rows(COMMANDS.map((c) => [c.name, c.summary])),
    "",
    "Options:",
    ...rows(GLOBAL_FLAGS.map((f) => [flagUsage(f), f.help])),
    "",
    `Run '${BIN} help <command>' for one command, '${BIN} help --json' for all as JSON.`,
  ].join("\n");
}

/** Level 2: the help of one command. */
export function commandHelp(def: CommandDef): string {
  const flags = [...def.flags, ...GLOBAL_FLAGS.filter((f) => f.name === "help")];
  const flagRows = flags.map((f): [string, string] => [flagUsage(f), f.default === undefined ? f.help : `${f.help} (default: ${f.default})`]);
  return [
    `${BIN} ${def.name}: ${def.summary}`,
    "",
    `usage: ${usageLine(def)}`,
    "",
    def.about,
    "",
    "Arguments:",
    ...rows(def.args.map((a) => [argUsage(a), a.help])),
    "",
    "Options:",
    ...rows(flagRows),
    "",
    "Exit codes:",
    ...rows(def.exitCodes.map(([code, when]) => [String(code), when])),
    "",
    def.examples.length === 1 ? "Example:" : "Examples:",
    ...def.examples.map((e) => `  ${e}`),
    "",
    "The full reference is docs/cli.md of the package.",
    ...(def.helpDocument === undefined
      ? []
      : [`More: mg get ${def.helpDocument} (the help document of ${BIN} ${def.name}, in the repository of ${BIN}).`]),
  ].join("\n");
}

function flagJson(flag: FlagDef, global: boolean) {
  return {
    name: flag.name,
    usage: flagUsage(flag),
    help: flag.help,
    short: flag.short === undefined ? [] : [flag.short],
    long: [flag.name],
    hide: false,
    global,
    ...(flag.value === undefined ? {} : { arg: { name: flag.value.replace(/[<>]/g, ""), usage: flag.value, required: true, hide: false } }),
    default: flag.default === undefined ? [] : [flag.default],
  };
}

function argJson(arg: ArgDef) {
  return { name: arg.name, usage: argUsage(arg), help: arg.help, required: arg.required === true, var: arg.variadic === true, hide: false, default: [] };
}

/** Level 3: all commands as one object in the shape of `usage generate json`. */
export function helpJson(version: string): object {
  const subcommands = Object.fromEntries(
    COMMANDS.map((c) => [
      c.name,
      {
        name: c.name,
        full_cmd: [c.name],
        usage: usageLine(c).slice(BIN.length + 1),
        help: c.summary,
        help_long: c.about,
        help_heading: "Commands",
        effect: c.effect,
        hide: false,
        args: c.args.map(argJson),
        flags: c.flags.map((f) => flagJson(f, false)),
        subcommands: {},
        aliases: [],
        examples: c.examples.map((code) => ({ code })),
        exit_codes: c.exitCodes.map(([code, help]) => ({ code, help })),
      },
    ]),
  );
  return {
    name: BIN,
    bin: BIN,
    version,
    about: ABOUT,
    usage: TOP_USAGE,
    cmd: {
      name: BIN,
      full_cmd: [],
      usage: TOP_USAGE,
      help: ABOUT,
      hide: false,
      args: [],
      flags: GLOBAL_FLAGS.map((f) => flagJson(f, true)),
      subcommands,
      aliases: [],
      examples: [],
    },
  };
}
