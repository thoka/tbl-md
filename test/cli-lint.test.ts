// Runs cli-lint, the check of the CLI convention, against the CLI of this checkout.
// It skips when cli-lint is not on the PATH, for example on CI.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { tempDir } from "./helpers.ts";

const root = join(import.meta.dir, "..");
const found = spawnSync("cli-lint", ["--version"], { encoding: "utf8" });
const available = found.error === undefined && found.status === 0;

test.skipIf(!available)("cli-lint passes on the CLI with no warn and no fail", () => {
  // The day after the grace date of cli-lint, so that each failed check gives exit 3, not a warning.
  const env = { ...process.env, CLI_LINT_TODAY: "2026-11-16", XDG_STATE_HOME: tempDir("cli-lint") };
  const cli = `${process.execPath} ${join(root, "src", "cli.ts")}`;
  const run = spawnSync("cli-lint", ["--run", cli], { cwd: tempDir("cli-lint-cwd"), encoding: "utf8", env, timeout: 120_000 });
  const report = `${run.stdout}${run.stderr}`;
  expect(report).not.toMatch(/^(warn|fail) /m);
  expect(run.status, report).toBe(0);
  expect(report).toMatch(/^pass help-json:/m);
}, 130_000);
