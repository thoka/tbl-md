// The engine of the flavor `discourse` with the table feature of Discourse, for the tests of the statements of
// docs/format.md (test/markdown-it.test.ts). The table feature has the license GPL-2.0-only, so it is not part of
// this repository: the loader reads it from the corpus cache only. No part here uses the network.
// The corpus code lives outside src/, so it never ships in the package.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { MarkdownIt } from "markdown-it";
import { createEngine } from "../src/engine.ts";
import { DISCOURSE as SETTINGS } from "../src/flavor.ts";
import { cachePath, cacheRoot } from "./lib.ts";

/** The table feature of Discourse at the commit that the flavor `discourse` pins. */
export const DISCOURSE = {
  repo: SETTINGS.repo,
  commit: SETTINGS.commit,
  tablePath: "frontend/discourse-markdown-it/src/features/table.js",
  tableSha256: "52bcfc206ce7f9d9357ff3dedb768e02e7a7eea097e48c15afaaea732192aa48",
} as const;

/** The helper object that a Discourse markdown feature gets in `setup(helper)`. Only these two methods matter here. */
export interface FeatureHelper {
  registerPlugin(plugin: (md: MarkdownIt) => void): void;
  allowList(info: unknown): void;
}

/** A Discourse markdown feature module, for example `features/table.js`. */
export interface DiscourseFeature {
  setup(helper: FeatureHelper): void;
}

/**
 * A new engine of the flavor `discourse` (src/engine.ts) with the plugins of a Discourse feature, as Discourse
 * applies them in setup.js. With no feature, it is the engine of the flavor.
 */
export function discourseEngine(tableFeature?: DiscourseFeature): MarkdownIt {
  const md = createEngine("discourse");
  if (tableFeature) {
    const plugins: ((md: MarkdownIt) => void)[] = [];
    tableFeature.setup({ registerPlugin: (plugin) => plugins.push(plugin), allowList: () => {} });
    for (const plugin of plugins) md.use(plugin);
  }
  return md;
}

/**
 * The table feature of Discourse from the corpus cache, or undefined if the cache does not have it with the pinned hash.
 * No task downloads it since the step-16 measurement left; the tests that need it skip without it.
 */
export async function cachedTableFeature(root: string = cacheRoot()): Promise<DiscourseFeature | undefined> {
  const place = cachePath(root, DISCOURSE.repo, DISCOURSE.commit, DISCOURSE.tablePath);
  if (!existsSync(place)) return undefined;
  if (createHash("sha256").update(readFileSync(place)).digest("hex") !== DISCOURSE.tableSha256) return undefined;
  return (await import(pathToFileURL(place).href)) as DiscourseFeature;
}
