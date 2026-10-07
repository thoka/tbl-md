// The doctor of the project: `mise run doctor [--json]`. It checks with no model that the tool is installed and
// configured on this machine as the project expects: the `tbl-md` command runs in the workspace, the skill links of
// the agents point to skills/tbl-md of this checkout, and the git hooks of lefthook.yml are installed. It prints one
// line per check, and it exits 0 when it ran, also with a failed check. CONTRIBUTING.md, section The doctor, has the
// checks and the configuration.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Status = "pass" | "warn" | "fail";

/** The result of one check. `fix` is set for a warning and a failure, else null. */
export interface Check {
  name: string;
  status: Status;
  message: string;
  fix: string | null;
}

/** The JSON output of the doctor: the tool, the worst status of the checks, and the checks. */
export interface Report {
  tool: "tbl-md";
  version: string;
  status: Status;
  checks: Check[];
}

export interface DoctorOptions {
  /** The root of the checkout. */
  root: string;
  /** The home folder, where the skill folders of the agents are. */
  home: string;
  /** The folder in which the `tbl-md` command must run. */
  workspace: string;
  /** The command to run, `tbl-md` by default. */
  command?: string;
}

/** The skill folders of the agents, relative to the home folder. */
export const SKILL_FOLDERS = [".claude/skills", ".agents/skills"];

/** The hooks of lefthook.yml. */
export const HOOKS = ["pre-commit", "pre-push"];

/** Runs each check and gives the results in a fixed order. */
export function runChecks(options: DoctorOptions): Check[] {
  return [
    commandCheck(options),
    ...SKILL_FOLDERS.map((folder) => skillCheck(options, folder)),
    ...HOOKS.map((hook) => hookCheck(options.root, hook)),
  ];
}

/** The `tbl-md` command runs in the workspace, and its version is not older than the version of the checkout. */
function commandCheck({ root, workspace, command = "tbl-md" }: DoctorOptions): Check {
  const check = "command";
  const result = spawnSync(command, ["--version"], { cwd: workspace, encoding: "utf8" });
  if (result.error || result.status !== 0) {
    const reason = result.error ? result.error.message : (result.stderr.trim().split("\n")[0] ?? `exit code ${result.status}`);
    return { name: check, status: "fail", message: `\`${command} --version\` fails in ${workspace}: ${reason}`, fix: `pin npm:tbl-md in the mise.toml of ${workspace} and run \`mise install\`` };
  }
  const installed = result.stdout.trim();
  const own = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  if (compareVersions(installed, own) < 0) {
    return { name: check, status: "warn", message: `${command} ${installed} runs in ${workspace}, and the checkout has ${own}`, fix: `after the release of ${own}, pin npm:tbl-md ${own} in the mise.toml of ${workspace}` };
  }
  return { name: check, status: "pass", message: `${command} ${installed} runs in ${workspace}`, fix: null };
}

/** The skill folder of an agent links to skills/tbl-md of the checkout. */
function skillCheck({ root, home }: DoctorOptions, folder: string): Check {
  const link = join(home, folder, "tbl-md");
  const target = join(root, "skills", "tbl-md");
  const check = `skill ${link}`;
  const fix = `link ${link} to ${target}`;
  if (!existsSync(link)) return { name: check, status: "fail", message: "the skill is missing", fix };
  if (realpathSync(link) !== realpathSync(target)) return { name: check, status: "fail", message: `points to ${realpathSync(link)}, not to ${target}`, fix };
  return { name: check, status: "pass", message: `points to ${target}`, fix: null };
}

/** The git hook is installed and runs lefthook. */
function hookCheck(root: string, hook: string): Check {
  const check = `hook ${hook}`;
  const fix = "run `mise run hooks-install` in the checkout";
  const path = resolve(root, git(root, ["rev-parse", "--git-path", `hooks/${hook}`]).trim());
  if (!existsSync(path)) return { name: check, status: "fail", message: "the hook is not installed", fix };
  if (!readFileSync(path, "utf8").includes("lefthook")) return { name: check, status: "fail", message: `${path} does not run lefthook`, fix };
  return { name: check, status: "pass", message: "lefthook runs it", fix: null };
}

/**
 * Runs git in `cwd`. A git hook sets variables such as GIT_DIR, and they would point git at another repository, so the
 * run clears each variable of `git rev-parse --local-env-vars`.
 */
function git(cwd: string, args: string[]): string {
  const names = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const env = { ...process.env };
  for (const name of names) delete env[name];
  const result = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout;
}

/** Compares two versions `X.Y.Z`. A part that is not a number counts as 0. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map((p) => Number.parseInt(p, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The report of the checks: `fail` if a check failed, else `warn` if a check warned, else `pass`. */
export function report(version: string, checks: Check[]): Report {
  const status = checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "warn") ? "warn" : "pass";
  return { tool: "tbl-md", version, status, checks };
}

/** One line per check: `pass  <name>: <message>`, with the fix after a warning or a failure. */
export function format(checks: Check[]): string {
  return checks.map((c) => `${c.status.padEnd(5)} ${c.name}: ${c.message}${c.fix ? `. Fix: ${c.fix}` : ""}`).join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((a) => a !== "--json")) {
    console.error("usage: mise run doctor [--json]");
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  // The workspace is the parent folder of the checkout, unless TBL_MD_DOCTOR_WORKSPACE names another folder.
  const workspace = process.env.TBL_MD_DOCTOR_WORKSPACE ?? dirname(realpathSync(root));
  const checks = runChecks({ root, home: homedir(), workspace });
  const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  console.log(args.includes("--json") ? JSON.stringify(report(version, checks), null, 2) : format(checks));
}
