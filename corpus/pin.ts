// mise run corpus-pin <repo> <commit> <path>... [--kind <kind>] [--license <license>]
// Gets each file and writes its size and SHA-256 into corpus/sources.json. Only this command writes hashes.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { getFile } from "./fetch.ts";
import { Budget, cacheRoot, checkConfig, KINDS, sha256, type Config, type Kind } from "./lib.ts";

const CONFIG = fileURLToPath(new URL("./sources.json", import.meta.url));

async function main(args: string[]): Promise<void> {
  const positional: string[] = [];
  let kind: Kind | undefined;
  let license: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--kind") kind = args[++i] as Kind;
    else if (arg === "--license") license = args[++i];
    else positional.push(arg);
  }
  const [repo, commit, ...paths] = positional;
  if (!repo || !commit || paths.length === 0) {
    throw new Error("Usage: mise run corpus-pin <owner/repo> <commit> <path>... [--kind <kind>] [--license <license>]");
  }
  if (kind !== undefined && !KINDS.includes(kind)) throw new Error(`The kind "${kind}" is unknown. Use one of ${KINDS.join(", ")}.`);

  const config = JSON.parse(await readFile(CONFIG, "utf8")) as Config;
  let source = config.sources.find((s) => s.repo === repo && s.commit === commit);
  if (source === undefined) {
    if (!license) throw new Error(`${repo}@${commit} is a new source. Give its license with --license <SPDX id>.`);
    source = { repo, commit, license, files: [] };
    config.sources.push(source);
  } else if (license) {
    source.license = license;
  }

  const options = { root: cacheRoot(), budget: new Budget() };
  for (const path of paths) {
    const { bytes, downloaded } = await getFile(repo, commit, path, null, options);
    const entry = { size: bytes.byteLength, sha256: sha256(bytes) };
    const old = source.files.find((f) => f.path === path);
    if (old) Object.assign(old, entry, kind ? { kind } : {});
    else source.files.push({ path, kind: kind ?? "markdown", ...entry });
    console.log(`${downloaded ? "got" : "cached"} ${repo}/${path}: ${entry.size} bytes, sha256 ${entry.sha256}`);
  }

  const problems = checkConfig(config);
  if (problems.length > 0) throw new Error(`sources.json is not valid after the pin:\n${problems.join("\n")}`);
  await writeFile(CONFIG, JSON.stringify(config, null, 2) + "\n");
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
