// The docs write tables as tbl blocks (AGENTS.md). The pre-commit hook runs `tbl-md lint` on the staged Markdown files,
// and this test checks all docs of the repository with the same lint. It also keeps the README short: the reference
// text lives in docs/ and the text for contributors in CONTRIBUTING.md.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lint } from "../src/index.ts";

const root = join(import.meta.dir, "..");
const files = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  ...readdirSync(join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `docs/${f}`),
];

/** The most lines that README.md can have. */
const README_LIMIT = 200;

test.each(files)("%s has no lint problem", (file) => {
  const problems = lint(readFileSync(join(root, file), "utf8")).map((p) => `${file}:${p.line}:${p.column}: ${p.message} (${p.code})`);
  expect(problems).toEqual([]);
});

test(`README.md has at most ${README_LIMIT} lines`, () => {
  const lines = readFileSync(join(root, "README.md"), "utf8").split("\n").length - 1;
  const problem =
    lines > README_LIMIT
      ? `README.md has ${lines} lines, and the limit is ${README_LIMIT}. Move reference text to docs/cli.md, docs/api.md, docs/markdown-it.md, or docs/known-gaps.md, and text for contributors to CONTRIBUTING.md.`
      : null;
  expect(problem).toBeNull();
});
