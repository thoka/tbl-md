// mise run corpus-discourse
// Downloads the table feature of Discourse at the pinned commit into the corpus cache, once. The tests of
// test/markdown-it.test.ts then compare the link pipe rule of tbl-md with it. The file has the license GPL-2.0-only,
// so it stays in the cache and never goes into the repository or the package.
import { getFile } from "./fetch.ts";
import { Budget, cacheRoot } from "./lib.ts";
import { DISCOURSE } from "./markdown-it-lib.ts";

const got = await getFile(DISCOURSE.repo, DISCOURSE.commit, DISCOURSE.tablePath, DISCOURSE.tableSha256, {
  root: cacheRoot(),
  budget: new Budget(),
});
console.log(`${DISCOURSE.tablePath}: ${got.downloaded ? "downloaded" : "in the cache"} (${got.bytes.length} bytes).`);
