// This repository is public (AGENTS.md). No tracked file names a local path. The planning files leave the repository
// later, so the test skips them, and it skips bun.lock. The cache path of the corpus (~/.cache/tbl-md) is allowed.
// The patterns are built from parts, so that this file does not match itself.
import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

/** The forbidden text: the folder of the private projects, a home folder, and the configuration folder with the keys. */
const FORBIDDEN = ["~" + "/dv", "/" + "home/", "~" + "/.config/"];

/** The planning files. They move to a private repository later. */
const EXCLUDED = [/^docs\/PLAN\.md$/, /^docs\/HISTORY\.md$/, /^docs\/review-queue\.md$/, /^docs\/research\//, /^docs\/outbox\//, /^bun\.lock$/];

/** Each line of `text` with a forbidden text, as `<line>: <forbidden text>`, with the line from 1. */
function privatePaths(text: string): string[] {
  const found: string[] = [];
  text.split(/\r\n|\r|\n/).forEach((line, index) => {
    for (const forbidden of FORBIDDEN) if (line.includes(forbidden)) found.push(`${index + 1}: ${forbidden}`);
  });
  return found;
}

/**
 * Runs git in the repository. A git hook sets variables such as GIT_DIR and GIT_INDEX_FILE, and they would point git
 * at another repository, so the run clears each variable of `git rev-parse --local-env-vars`.
 */
function git(args: string[]): string {
  const names = spawnSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const env = { ...process.env };
  for (const name of names) delete env[name];
  const result = spawnSync("git", args, { cwd: root, env, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout;
}

const files = git(["ls-files", "-z"])
  .split("\0")
  .filter((file) => file !== "" && !EXCLUDED.some((pattern) => pattern.test(file)));

test("the scan finds a forbidden text with its line", () => {
  expect(privatePaths(`a\nsee ${"~" + "/dv"}/x\n${"/" + "home/"}me and ${"~" + "/.config/"}x\n`)).toEqual([
    `2: ${"~" + "/dv"}`,
    `3: ${"/" + "home/"}`,
    `3: ${"~" + "/.config/"}`,
  ]);
  expect(privatePaths("the cache is ~/.cache/tbl-md/corpus/")).toEqual([]);
});

test("the scan reads the tracked files, without the planning files", () => {
  expect(files).toContain("README.md");
  expect(files).toContain("test/public.test.ts");
  expect(files).not.toContain("docs/PLAN.md");
});

test("no tracked public file names a local path", () => {
  const problems = files.flatMap((file) => {
    const bytes = readFileSync(join(root, file));
    if (bytes.includes(0)) return [];
    return privatePaths(bytes.toString("utf8")).map((hit) => `${file}:${hit}`);
  });
  expect(problems).toEqual([]);
});
