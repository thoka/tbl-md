// mise run corpus [--verbose]
// Gets each file of corpus/sources.json (from the cache when it can), splits it into Markdown documents,
// converts each document to tbl and back to GFM, and compares the mdast before and after.
// Only "different" and a crash fail the run. The output names the file and the line, never the content.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getFile } from "./fetch.ts";
import { Budget, cacheRoot, checkConfig, roundTrip, splitDocuments, type Config } from "./lib.ts";

const CONFIG = fileURLToPath(new URL("./sources.json", import.meta.url));
const COUNTS = ["same", "error", "alignment", "different"] as const;
type Count = (typeof COUNTS)[number];

interface Row {
  repo: string;
  files: number;
  documents: number;
  counts: Record<Count, number>;
}

async function main(args: string[]): Promise<number> {
  const verbose = args.includes("--verbose");
  const config = JSON.parse(await readFile(CONFIG, "utf8")) as Config;
  const problems = checkConfig(config);
  if (problems.length > 0) throw new Error(`corpus/sources.json is not valid:\n${problems.join("\n")}`);

  const options = { root: cacheRoot(), budget: new Budget() };
  const rows: Row[] = [];
  let downloads = 0;
  let failed = false;
  for (const source of config.sources) {
    const row: Row = { repo: source.repo, files: source.files.length, documents: 0, counts: { same: 0, error: 0, alignment: 0, different: 0 } };
    rows.push(row);
    for (const file of source.files) {
      const { bytes, downloaded } = await getFile(source.repo, source.commit, file.path, file.sha256, options);
      if (downloaded) downloads++;
      const text = new TextDecoder().decode(bytes);
      for (const doc of splitDocuments(file.kind, text)) {
        const at = (line: number) => `${source.repo}/${file.path}:${doc.line + line - 1}`;
        let outcome;
        try {
          outcome = roundTrip(doc.text);
        } catch (error) {
          failed = true;
          console.log(`crash      ${at(1)}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        if (outcome.kind === "none") continue;
        row.documents++;
        row.counts[outcome.kind]++;
        if (outcome.kind === "different") {
          failed = true;
          console.log(`different  ${at(outcome.line)}: ${outcome.message}`);
        } else if (verbose && outcome.kind === "alignment") {
          console.log(`alignment  ${at(outcome.line)}`);
        } else if (verbose && outcome.kind === "error") {
          console.log(`error      ${at(outcome.line)}: ${outcome.message}`);
        }
      }
    }
  }

  console.log("");
  printSummary(rows);
  console.log("");
  console.log(`Downloaded ${downloads} files (${options.budget.used} bytes). The cache is ${options.root}.`);
  console.log(
    '"documents" counts the documents with a GFM table. A spec file gives one document per example. "error" is a conversion error by docs/format.md, not a failure. ' +
      '"alignment" counts the documents that differ only in the column alignment, which tbl-md 0.1 drops (step 13 removes this count). ' +
      "Only \"different\" and a crash fail the run. Run with --verbose to list the errors and the alignment cases.",
  );
  return failed ? 1 : 0;
}

function printSummary(rows: Row[]): void {
  const total: Row = { repo: "total", files: 0, documents: 0, counts: { same: 0, error: 0, alignment: 0, different: 0 } };
  for (const row of rows) {
    total.files += row.files;
    total.documents += row.documents;
    for (const c of COUNTS) total.counts[c] += row.counts[c];
  }
  const header = ["source", "files", "documents", ...COUNTS];
  const lines = [...rows, total].map((r) => [r.repo, String(r.files), String(r.documents), ...COUNTS.map((c) => String(r.counts[c]))]);
  const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i]!.length)));
  const format = (cells: string[]) => cells.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]!) : cell.padStart(widths[i]!))).join("  ");
  console.log(format(header));
  for (const line of lines) console.log(format(line));
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
