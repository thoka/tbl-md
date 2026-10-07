// The doctor (scripts/doctor.ts) on a temp checkout, a temp home folder, and a fake `tbl-md` command.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareVersions, format, report, runChecks, type Check, type Report } from "../scripts/doctor.ts";

let temp: string;
let root: string;
let home: string;
let command: string;

/** Writes a fake command that prints `output` and exits with `code`. */
function fakeCommand(output: string, code = 0): string {
  const path = join(temp, `tbl-md-${output.replace(/\W/g, "") || "x"}-${code}`);
  writeFileSync(path, `#!/bin/sh\necho "${output}"\nexit ${code}\n`);
  chmodSync(path, 0o755);
  return path;
}

/** Runs git in the checkout with no variable of a running git hook. */
function git(args: string[]): void {
  const names = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const env = { ...process.env };
  for (const name of names) delete env[name];
  const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}

/** Makes each check pass: the skill links and both hooks. */
function healthy(): void {
  for (const folder of [".claude/skills", ".agents/skills"]) {
    mkdirSync(join(home, folder), { recursive: true });
    symlinkSync(join(root, "skills", "tbl-md"), join(home, folder, "tbl-md"));
  }
  for (const hook of ["pre-commit", "pre-push"]) writeFileSync(join(root, ".git", "hooks", hook), "#!/bin/sh\nlefthook run\n");
}

function byName(checks: Check[], name: string): Check {
  const found = checks.find((c) => c.name.startsWith(name));
  if (!found) throw new Error(`no check ${name}`);
  return found;
}

beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), "tbl-md-doctor-"));
  root = join(temp, "checkout");
  home = join(temp, "home");
  mkdirSync(join(root, "skills", "tbl-md"), { recursive: true });
  mkdirSync(home);
  writeFileSync(join(root, "package.json"), JSON.stringify({ version: "0.4.0" }));
  git(["init", "-q"]);
  command = fakeCommand("0.4.0");
});

afterEach(() => rmSync(temp, { recursive: true, force: true }));

describe("runChecks", () => {
  test("passes each check on a healthy machine", () => {
    healthy();
    const checks = runChecks({ root, home, workspace: temp, command });
    expect(checks.map((c) => [c.status, c.name.split(" ")[0]])).toEqual([
      ["pass", "command"],
      ["pass", "skill"],
      ["pass", "skill"],
      ["pass", "hook"],
      ["pass", "hook"],
    ]);
    expect(checks.every((c) => c.fix === null)).toBe(true);
  });

  test("fails each check on a new machine, and names each fix", () => {
    const checks = runChecks({ root, home, workspace: temp, command: join(temp, "missing") });
    expect(checks.map((c) => c.status)).toEqual(["fail", "fail", "fail", "fail", "fail"]);
    expect(byName(checks, "command").fix).toContain("pin npm:tbl-md");
    expect(byName(checks, "skill").fix).toBe(`link ${join(home, ".claude/skills/tbl-md")} to ${join(root, "skills", "tbl-md")}`);
    expect(byName(checks, "hook pre-commit").fix).toContain("mise run hooks-install");
  });

  test("fails the command check when the command exits with an error", () => {
    healthy();
    const check = byName(runChecks({ root, home, workspace: temp, command: fakeCommand("no version is set", 1) }), "command");
    expect(check.status).toBe("fail");
  });

  test("warns when the command is older than the checkout", () => {
    healthy();
    const check = byName(runChecks({ root, home, workspace: temp, command: fakeCommand("0.3.0") }), "command");
    expect(check.status).toBe("warn");
    expect(check.message).toContain("0.3.0");
    expect(check.fix).toContain("0.4.0");
  });

  test("fails a skill link that points to another folder", () => {
    healthy();
    rmSync(join(home, ".agents/skills/tbl-md"));
    mkdirSync(join(temp, "other"));
    symlinkSync(join(temp, "other"), join(home, ".agents/skills/tbl-md"));
    const check = byName(runChecks({ root, home, workspace: temp, command }), `skill ${join(home, ".agents")}`);
    expect(check.status).toBe("fail");
    expect(check.message).toContain("other");
  });

  test("fails a hook that does not run lefthook", () => {
    healthy();
    writeFileSync(join(root, ".git", "hooks", "pre-push"), "#!/bin/sh\nexit 0\n");
    const checks = runChecks({ root, home, workspace: temp, command });
    expect(byName(checks, "hook pre-push").status).toBe("fail");
    expect(byName(checks, "hook pre-commit").status).toBe("pass");
  });
});

test("report gives the worst status of the checks", () => {
  const check = (status: Check["status"]): Check => ({ name: status, status, message: "", fix: status === "pass" ? null : "x" });
  expect(report("1.0.0", [check("pass"), check("pass")]).status).toBe("pass");
  expect(report("1.0.0", [check("pass"), check("warn")]).status).toBe("warn");
  expect(report("1.0.0", [check("warn"), check("fail")]).status).toBe("fail");
  expect(report("1.0.0", []).tool).toBe("tbl-md");
});

test("compareVersions orders the versions by their numbers", () => {
  expect(compareVersions("0.3.0", "0.4.0")).toBeLessThan(0);
  expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
  expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
});

test("format prints one line per check, with the fix", () => {
  const text = format([
    { name: "command", status: "pass", message: "tbl-md 0.4.0 runs", fix: null },
    { name: "hook pre-push", status: "fail", message: "the hook is not installed", fix: "run it" },
  ]);
  expect(text).toBe("pass  command: tbl-md 0.4.0 runs\nfail  hook pre-push: the hook is not installed. Fix: run it");
});

test("the CLI prints JSON with --json, exits 0, and rejects an unknown flag", () => {
  const script = join(import.meta.dir, "..", "scripts", "doctor.ts");
  const run = spawnSync(process.execPath, [script, "--json"], { encoding: "utf8", env: { ...process.env, TBL_MD_DOCTOR_WORKSPACE: temp } });
  expect(run.status).toBe(0);
  const out = JSON.parse(run.stdout) as Report;
  expect(out.tool).toBe("tbl-md");
  expect(out.checks).toHaveLength(5);
  expect(out.checks.every((c) => ["pass", "warn", "fail"].includes(c.status) && "fix" in c)).toBe(true);
  expect(spawnSync(process.execPath, [script, "--bad"], { encoding: "utf8" }).status).toBe(2);
});
