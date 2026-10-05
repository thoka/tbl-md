// The docs write tables as tbl blocks (AGENTS.md). This test is the check until `tbl-md lint`
// runs in the pre-commit hook (plan step 6), which replaces it.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const files = ["README.md", "AGENTS.md", ...readdirSync(join(root, "docs")).filter((f) => f.endsWith(".md")).map((f) => `docs/${f}`)];

// A GFM delimiter row: cells of dashes with optional colons, separated by pipes.
const delimiterRow = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

test.each(files)("%s has no GFM pipe table", (file) => {
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  const hits = lines.flatMap((line, i) => (delimiterRow.test(line) ? [`${file}:${i + 1}`] : []));
  expect(hits).toEqual([]);
});

test("the check finds a GFM delimiter row", () => {
  expect(delimiterRow.test("| --- | :-: |")).toBe(true);
  expect(delimiterRow.test("--")).toBe(false);
});
