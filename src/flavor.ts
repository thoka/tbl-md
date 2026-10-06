// The flavors of tbl-md (docs/format.md, section Flavors). A flavor names one target renderer of GFM:
// its markdown-it settings and its rules for the conversion to and from GFM.
// This module has no markdown-it type, so that the type declarations of the package do not need markdown-it.

/** The target renderer of GFM. `discourse` is Discourse with its default site settings, `markdown-it` is `markdownit()`. */
export type Flavor = "discourse" | "markdown-it";

/** Each flavor, the default first. */
export const FLAVORS: readonly Flavor[] = ["discourse", "markdown-it"];

/** The flavor when the caller names none. */
export const DEFAULT_FLAVOR: Flavor = "discourse";

/**
 * The settings of Discourse that the flavor `discourse` reproduces: the defaults of config/site_settings.yml
 * at the pinned commit, and the version of markdown-it in pnpm-lock.yaml of that commit.
 */
export const DISCOURSE = {
  repo: "discourse/discourse",
  commit: "eb46cffe81257fd48d3e18c35aaba97488fe19b5",
  markdownIt: "15.0.1",
  quotes: ["“", "”", "‘", "’"],
  linkifyTlds: ["com", "net", "org", "io", "onion", "co", "tv", "ru", "cn", "us", "uk", "me", "de", "fr", "fi", "gov"],
} as const;
