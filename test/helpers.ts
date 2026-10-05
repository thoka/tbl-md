// Shared helpers of the tests.
import { afterAll } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The temp folders of this test file. afterAll removes them, also when a test fails. */
const tempDirs: string[] = [];

/**
 * Makes a new temp folder `<tmpdir>/tbl-md-<prefix>-XXXXXX` and registers it for removal after the test file.
 * The path is real (no symlink), so that it equals what git reports. Set TBL_MD_KEEP_TMP=1 to keep the folders.
 */
export function tempDir(prefix: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `tbl-md-${prefix}-`)));
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  const dirs = tempDirs.splice(0);
  if (process.env.TBL_MD_KEEP_TMP === "1") {
    for (const dir of dirs) console.error(`TBL_MD_KEEP_TMP: kept ${dir}`);
    return;
  }
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});
