// The test run ends with a verdict card (step 1HyzcbDT, rule run-ends-with-verdict-card).
import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCard } from "../scripts/test-card";

const SCRIPT = join(import.meta.dir, "..", "scripts", "test-card.ts");

function runFixture(body: string) {
  const root = mkdtempSync(join(tmpdir(), "test-card-"));
  const suite = join(root, "suite");
  mkdirSync(suite);
  writeFileSync(join(suite, "f.test.ts"), body);
  const proc = Bun.spawnSync(["bun", SCRIPT], {
    cwd: suite,
    env: { ...process.env, DV_TEST_CARD_DIR: join(root, "cards") },
  });
  const out = proc.stderr.toString(); // the card goes to stderr, after the summary of bun test
  return { code: proc.exitCode, lines: out.trimEnd().split("\n") };
}

test("a passing fixture suite ends with a PASS card and the path of the full output", () => {
  const { code, lines } = runFixture('import {test} from "bun:test"\ntest("a",()=>{})\ntest.skip("s",()=>{})\n');
  expect(code).toBe(0);
  expect(lines.at(-2)).toMatch(/^verdict PASS exit 0: 2 total 1 passed 0 failed 1 skipped in [\d.]+s$/);
  expect(lines.at(-1)).toMatch(/^full output: /);
  expect(readFileSync(lines.at(-1)!.slice("full output: ".length), "utf8")).toContain("verdict PASS");
});

test("a failing fixture suite ends with a FAIL card, the first failure with file and line, and the cut note", () => {
  const body =
    'import {test,expect} from "bun:test"\ntest("a",()=>{})\ntest("b",()=>{\n expect(1).toBe(2)\n})\ntest("c",()=>{\n throw new Error("x")\n})\n';
  const { code, lines } = runFixture(body);
  expect(code).toBe(1);
  const i = lines.findIndex((l) => l.startsWith("verdict "));
  expect(lines[i]).toMatch(/^verdict FAIL exit 1: 3 total 1 passed 2 failed 0 skipped in [\d.]+s$/);
  expect(lines[i + 1]).toMatch(/^first failure: .*f\.test\.ts:4 b$/);
  expect(lines[i + 2]).toMatch(/^full output: /);
  expect(lines.at(-1)).toBe("cut: 1 more failures (see the full output)");
});

test("buildCard reports no tests when the run printed no summary", () => {
  expect(buildCard("error: boom\n", 1, 0.5, "/x.log")[0]).toBe("verdict FAIL exit 1: no tests in 0.5s");
});
