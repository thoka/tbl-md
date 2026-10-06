// mise run corpus-markdown-it [--cases] [--verbose]
// tbl-md step 16: markdown-it with the settings of Discourse against micromark (the current parser path).
// Without --cases, it reads each document of the corpus (corpus/sources.json, from the cache when it can), finds the
// GFM tables with both parsers, and counts the tables that differ: a table that only one parser finds, a different
// number of rows, of header cells, or of cells in a row, a different cell text, or a different alignment.
// It also checks that the cell positions of the re-split (recordTableLines and splitRow) give the token content.
// With --cases, it renders the hand-written row-split cases with both parsers and prints them as a tbl block.
// Not part of mise run test.
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { micromark } from "micromark";
import { gfmTable, gfmTableHtml } from "micromark-extension-gfm-table";
import type { MarkdownIt } from "markdown-it";
import { getFile } from "./fetch.ts";
import { Budget, cachePath, cacheRoot, checkConfig, splitDocuments, type Config } from "./lib.ts";
import {
  compareTables,
  DIFF_KINDS,
  DISCOURSE,
  discourseEngine,
  markdownItTables,
  micromarkTables,
  splitRow,
  type DiffKind,
  type DiscourseFeature,
  type PositionMismatch,
  type TableDiff,
} from "./markdown-it-lib.ts";
import { renderBlock } from "../src/render.ts";

const CONFIG = fileURLToPath(new URL("./sources.json", import.meta.url));
const EXAMPLES = 3;

/** Gets the table feature of Discourse at the pinned commit into the cache, and loads it. */
async function loadTableFeature(budget: Budget): Promise<DiscourseFeature> {
  const root = cacheRoot();
  await getFile(DISCOURSE.repo, DISCOURSE.commit, DISCOURSE.tablePath, DISCOURSE.tableSha256, { root, budget });
  const place = cachePath(root, DISCOURSE.repo, DISCOURSE.commit, DISCOURSE.tablePath);
  return (await import(pathToFileURL(place).href)) as DiscourseFeature;
}

async function measureCorpus(md: MarkdownIt, budget: Budget, verbose: boolean): Promise<void> {
  const config = JSON.parse(await readFile(CONFIG, "utf8")) as Config;
  const problems = checkConfig(config);
  if (problems.length > 0) throw new Error(`corpus/sources.json is not valid:\n${problems.join("\n")}`);

  const counts = Object.fromEntries(DIFF_KINDS.map((k) => [k, 0])) as Record<DiffKind, number>;
  const examples = Object.fromEntries(DIFF_KINDS.map((k) => [k, [] as string[]])) as Record<DiffKind, string[]>;
  let documents = 0;
  let micromarkCount = 0;
  let markdownItCount = 0;
  let paired = 0;
  let differing = 0;
  let cellsChecked = 0;
  const mismatches: string[] = [];
  const perSource: string[] = [];
  for (const source of config.sources) {
    const before = { micromark: micromarkCount, markdownIt: markdownItCount, differing };
    for (const file of source.files) {
      const { bytes } = await getFile(source.repo, source.commit, file.path, file.sha256, { root: cacheRoot(), budget });
      const text = new TextDecoder().decode(bytes);
      for (const doc of splitDocuments(file.kind, text)) {
        const at = (line: number) => `${source.repo}/${file.path}:${doc.line + line - 1}`;
        const a = micromarkTables(doc.text);
        const b = markdownItTables(md, doc.text);
        if (a.length === 0 && b.tables.length === 0) continue;
        documents++;
        micromarkCount += a.length;
        markdownItCount += b.tables.length;
        cellsChecked += b.tables.reduce((n, t) => n + t.rows.reduce((m, r) => m + r.cells.length, 0), 0);
        for (const m of b.mismatches) mismatches.push(`${at(m.line)} cell ${m.cell}: ${describeMismatch(m)}`);
        const result = compareTables(a, b.tables);
        paired += result.paired;
        differing += result.diffs.length;
        for (const diff of result.diffs) {
          for (const kind of diff.kinds) {
            counts[kind]++;
            if (verbose || examples[kind].length < EXAMPLES) examples[kind].push(`${at(diff.line)}${describe(diff)}`);
          }
        }
      }
    }
    perSource.push(
      `${source.repo.padEnd(45)}  ${String(micromarkCount - before.micromark).padStart(9)}  ${String(markdownItCount - before.markdownIt).padStart(11)}  ${String(differing - before.differing).padStart(9)}`,
    );
  }

  console.log(`${"source".padEnd(45)}  micromark  markdown-it  differing`);
  for (const line of perSource) console.log(line);
  console.log("");
  console.log(`Documents with a table: ${documents}`);
  console.log(`Tables: micromark ${micromarkCount}, markdown-it ${markdownItCount}, found by both ${paired}`);
  console.log(`Tables with a difference: ${differing}`);
  console.log("");
  console.log("kind              tables");
  for (const kind of DIFF_KINDS) console.log(`${kind.padEnd(16)}  ${String(counts[kind]).padStart(6)}`);
  for (const kind of DIFF_KINDS) {
    if (examples[kind].length === 0) continue;
    console.log("");
    console.log(`Examples of "${kind}":`);
    for (const line of examples[kind]) console.log(`  ${line}`);
  }
  console.log("");
  console.log(`Position check: ${cellsChecked} source cells, ${mismatches.length} cells where the text at the position is not the token content.`);
  for (const line of mismatches.slice(0, verbose ? undefined : EXAMPLES)) console.log(`  ${line}`);
  console.log("");
  console.log(
    '"only-micromark" and "only-markdown-it" count the tables that only one parser finds (by the line of the header row). ' +
      'The other kinds count the tables that both find: "rows" and "columns" compare the number of rows and of header cells, ' +
      '"cells" the number of source cells of a row (also excess cells), "content" the source text of a cell (no pipes, no spaces at the edges), ' +
      'and "align" the alignment of the columns. A table can have more than one kind.',
  );
}

function describe(diff: TableDiff): string {
  if (!diff.example) return `: ${diff.kinds.join(", ")}`;
  const show = (cells: string[]) => `[${cells.map((c) => JSON.stringify(short(c))).join(", ")}]`;
  return `: ${diff.kinds.join(", ")}; row at line +${diff.example.line - diff.line}: micromark ${show(diff.example.micromark)}, markdown-it ${show(diff.example.markdownIt)}`;
}

function describeMismatch(m: PositionMismatch): string {
  return `source ${JSON.stringify(short(m.fromSource))}, token ${JSON.stringify(short(m.fromToken))}`;
}

function short(text: string): string {
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

/** A hand-written case: a whole document, or one body row under a header of two columns. */
interface Case {
  name: string;
  doc: string;
}

const HEADER = "| h1 | h2 |\n| --- | --- |\n";
const row = (name: string, line: string): Case => ({ name, doc: `${HEADER}${line}\n` });

/** The row-split cases of step 16, task 3. */
export const CASES: Case[] = [
  row("leading and trailing pipe", "| a | b |"),
  row("no leading and no trailing pipe", "a | b"),
  row("no trailing pipe", "| a | b"),
  row("spaces after the last pipe", "| a | b |   "),
  row("an empty cell", "|  | b |"),
  row("a missing cell", "| a |"),
  row("an excess cell with text", "| a | b | c |"),
  row("an excess cell with no text", "| a | b |  |"),
  row("an escaped pipe", "| x\\|y | b |"),
  row("a pipe after two backslashes", "| x\\\\|y | b |"),
  row("a pipe after three backslashes", "| x\\\\\\|y | b |"),
  row("a pipe in a code span", "| `x|y` | b |"),
  row("an escaped pipe in a code span", "| `x\\|y` | b |"),
  row("a pipe after two backslashes in a code span", "| `x\\\\|y` | b |"),
  row("a pipe in a link text", "| [x|y](https://example.com) | b |"),
  row("an escaped pipe in a link text", "| [x\\|y](https://example.com) | b |"),
  row("a pipe in an image text (Discourse image size)", "| ![x|100x50](https://example.com/a.png) | b |"),
  row("a pipe in an autolink", "| <https://example.com/a|b> | b |"),
  row("a pipe in a raw HTML attribute", '| <span title="x|y">z</span> | b |'),
  row("the last cell ends with an escaped pipe", "| a | b \\|"),
  row("the last cell ends with two backslashes and a pipe", "| a | b \\\\|"),
  row("a no-break space at the end of a cell", "| a | b |"),
  row("a tab at the edge of a cell", "|\ta\t| b |"),
  { name: "a body line with no pipe", doc: `${HEADER}text\n` },
  { name: "a body line of only one pipe", doc: `${HEADER}|\n` },
  { name: "a header line with no pipe", doc: "h1\n| --- |\n| a |\n" },
  { name: "a header line with no pipe and a delimiter row with a colon", doc: "h1\n:-:\na\n" },
  { name: "a delimiter row that starts with a dash and a space", doc: "h1 |\n- |\na |\n" },
  { name: "a header row that starts with a number sign", doc: "# | h2\n--|--\na | b\n" },
  { name: "a header row that starts with a list marker", doc: "-   h1|h2\n---|---\na|b\n" },
  { name: "a header cell with a pipe after two backslashes", doc: "| h1 | x\\\\|y |\n| --- | --- |\n| a | b |\n" },
  { name: "a header with more cells than the delimiter row", doc: "| h1 | h2 | h3 |\n| --- | --- |\n| a | b |\n" },
  { name: "a table directly after a paragraph line", doc: `text\n${HEADER}| a | b |\n` },
  { name: "a paragraph line directly after the table", doc: `${HEADER}| a | b |\ntext\n` },
  { name: "a block quote line directly after the table", doc: `${HEADER}| a | b |\n> quote\n` },
];

/** The body rows of the first table of an HTML text, each as the inner HTML of its cells. */
function bodyCells(html: string): string[][] | null {
  const table = /<table>[\s\S]*?<\/table>/.exec(html);
  if (!table) return null;
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table[0]);
  if (!body) return [];
  return [...body[1]!.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((tr) => [...tr[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((td) => td[1]!));
}

/** A code span for a text, with a fence of one backtick more than the longest run of backticks in it. */
function code(text: string): string {
  if (text === "") return "(empty)";
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = text.startsWith("`") || text.endsWith("`") || text.startsWith(" ") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

function showRows(rows: string[][] | null, sourceCells: number[]): string {
  if (rows === null) return "no table";
  if (rows.length === 0) return "a table with no body row";
  return rows.map((cells, i) => `${cells.map(code).join(", ")} (source cells: ${sourceCells[i] ?? "?"})`).join("; ");
}

function printCases(md: MarkdownIt): void {
  const rows = CASES.map((c) => {
    const mdHtml = md.render(c.doc);
    const mmHtml = micromark(c.doc, { allowDangerousHtml: true, extensions: [gfmTable()], htmlExtensions: [gfmTableHtml()] });
    const mdSource = markdownItTables(md, c.doc).tables[0]?.rows.slice(1).map((r) => r.cells.length) ?? [];
    const mmSource = micromarkTables(c.doc)[0]?.rows.slice(1).map((r) => r.cells.length) ?? [];
    return {
      cells: {
        case: c.name,
        source: code(c.doc.split("\n").slice(c.doc.startsWith(HEADER) ? 2 : 0).filter((l) => l !== "").join("⏎")),
        "markdown-it": showRows(bodyCells(mdHtml), mdSource),
        micromark: showRows(bodyCells(mmHtml), mmSource),
      },
    };
  });
  const columns = ["case", "source", "markdown-it", "micromark"].map((key) => ({ key, title: key === "case" ? "Case" : key === "source" ? "Source row" : key }));
  console.log(renderBlock({ columns, rows }));
  console.log("");
  console.log("Each cell of the result is the HTML of one rendered body cell. ⏎ marks a line end in the source.");
  console.log(`splitRow of "| a | b \\\\|": ${JSON.stringify(splitRow("| a | b \\\\|").map((c) => c.content))}`);
}

async function main(args: string[]): Promise<number> {
  const budget = new Budget();
  const tableFeature = await loadTableFeature(budget);
  const md = discourseEngine({ tableFeature, record: true });
  console.log(`markdown-it ${DISCOURSE.markdownIt} with the settings of Discourse ${DISCOURSE.commit.slice(0, 12)} and its table feature.`);
  console.log("");
  if (args.includes("--cases")) printCases(md);
  else await measureCorpus(md, budget, args.includes("--verbose"));
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  },
);
