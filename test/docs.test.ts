// The docs write tables as tbl blocks (AGENTS.md). The pre-commit hook runs `tbl-md lint` on the staged Markdown files,
// and this test checks all docs of the repository with the same lint.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { lint } from "../src/index.ts";

const root = join(import.meta.dir, "..");
const files = ["README.md", "AGENTS.md", ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];

test.each(files)("%s has no lint problem", (file) => {
  const problems = lint(readFileSync(join(root, file), "utf8")).map((p) => `${file}:${p.line}:${p.column}: ${p.message} (${p.code})`);
  expect(problems).toEqual([]);
});
