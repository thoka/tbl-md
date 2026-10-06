// The downloader of the corpus: one file at a pinned commit, with the caps, the hash check, and the cache.
// It sends no token and no extra header. A file that the cache has with the correct hash never downloads again.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Budget, cachePath, FILE_CAP, rawUrl, readCapped, sha256, verify } from "./lib.ts";

export interface FetchOptions {
  /** The cache folder, from cacheRoot(). */
  root: string;
  budget: Budget;
  /** The fetch function. Tests give a fake one. */
  fetch?: (url: string) => Promise<Response>;
}

export interface Got {
  bytes: Uint8Array;
  /** True if the bytes came from the network, false if they came from the cache. */
  downloaded: boolean;
}

/**
 * Gets one file. With `expected`, a cached file with that hash is used as is, and a downloaded file must have that
 * hash, or the call fails with an error that names the file. With no `expected` (the pin command), the file comes
 * from the cache if it is there, else from the network.
 */
export async function getFile(repo: string, commit: string, path: string, expected: string | null, options: FetchOptions): Promise<Got> {
  const name = `${repo}@${commit.slice(0, 12)}:${path}`;
  const place = cachePath(options.root, repo, commit, path);
  const cached = await readFile(place).catch(() => null);
  if (cached !== null && (expected === null || sha256(cached) === expected)) return { bytes: new Uint8Array(cached), downloaded: false };

  const doFetch = options.fetch ?? ((url: string) => fetch(url));
  const response = await doFetch(rawUrl(repo, commit, path));
  if (!response.ok || response.body === null) {
    await response.body?.cancel();
    throw new Error(`${name}: the download failed with HTTP ${response.status}.`);
  }
  const length = Number(response.headers.get("content-length"));
  if (length > FILE_CAP) {
    await response.body.cancel();
    throw new Error(`${name}: the file is larger than the cap of ${FILE_CAP} bytes.`);
  }
  const bytes = await readCapped(name, response.body, FILE_CAP, options.budget);
  if (expected !== null) verify(name, bytes, expected);

  await mkdir(dirname(place), { recursive: true });
  const temp = `${place}.${process.pid}.tmp`;
  await writeFile(temp, bytes);
  await rename(temp, place);
  return { bytes, downloaded: true };
}
