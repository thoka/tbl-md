// The single-file build of the markdown-it plugin: one IIFE file with no import, for a host that loads a plain script,
// such as Discourse. `npm run build` runs this file with Node after tsc. The test test/markdown-it-plugin.test.ts
// uses the same options. esbuild with the platform `neutral` fails on each `node:` import, so the build checks that the
// plugin reaches no `node:` module.
import { build, type BuildOptions } from "esbuild";
import { fileURLToPath } from "node:url";

/** The global name of the bundle. The plugin function is `tblMdMarkdownIt.default`. */
export const GLOBAL_NAME = "tblMdMarkdownIt";

/** The entry and the output file, relative to the root of the repository. */
export const ENTRY = "src/markdown-it.ts";
export const OUTFILE = "dist/tbl-md-markdown-it.iife.js";

export const IIFE_OPTIONS = {
  bundle: true,
  platform: "neutral",
  format: "iife",
  globalName: GLOBAL_NAME,
  minify: true,
  // Old enough for each browser that markdown-it 15 supports. esbuild lowers newer syntax, such as `??=`.
  target: "es2020",
  logLevel: "silent",
} satisfies BuildOptions;

/** Bundles an entry with the IIFE options and gives the text of the file. It throws on a build error. */
export async function bundle(entry: string): Promise<string> {
  const result = await build({ ...IIFE_OPTIONS, entryPoints: [entry], write: false });
  return result.outputFiles[0]!.text;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  await build({ ...IIFE_OPTIONS, absWorkingDir: root, entryPoints: [ENTRY], outfile: OUTFILE });
}
