---
checked: 2026-10-06
recheck: "12m. Recheck earlier after one of three events. Node gets a built-in JSONC, YAML, or TOML parser. tbl-md gets a second configuration option. A project needs a different list in a subfolder"
decisions:
  - "tbl-md step 14: the configuration of a project is one JSON file .tbl-md.json. JSON.parse reads it, so the package gets no new dependency"
  - "tbl-md step 14: the CLI finds the file for each linted file: it starts in the folder of the file and goes up. It stops at one of three places: the first folder with .tbl-md.json, the first folder with a .git entry (folder or file), or the root of the file system. For stdin it starts in the current folder. The nearest file wins, with no merge"
  - "tbl-md step 14: the file has two keys: $schema (ignored by the loader) and attributeKeys (a list of keys). Each other key is a configuration error with exit code 2"
  - "tbl-md step 14: the flag `--config <file>` replaces the search. No package.json key, no global file in the home folder, no declaration in the Markdown file, and no prefix convention in the first version"
  - "tbl-md step 14: an unknown key is a warning with exit code 0. --max-warnings <n> as in ESLint makes the run fail with exit code 1. The hooks of our projects use --max-warnings 0"
  - "tbl-md step 14: the package ships a JSON Schema of the file. An entry in SchemaStore comes after the first release with the file"
---

# The configuration of the lint of tbl-md

Research on 2026-10-06 for tbl-md step 14. No paid API. No key file was read. Each source at the end is a page or a file that this research opened on 2026-10-06. A statement without a source has the mark "[guess]". A fact that this research measured has the mark "[measured]".

This report uses ASD-STE100 Simplified Technical English as a guide. No tool can make sure that a text obeys ASD-STE100 fully.

## Question

Rule 15 of `docs/format.md` says: `tbl-md lint` warns on an unknown attribute key, unless the configuration of the project lists that key. The only known key is `align`. Today tbl-md has no configuration file and no warnings. The lint gives exit code 1 on each problem.

The questions:

1. Where does a small Markdown lint CLI keep the configuration of a project? Compare five places: a dotfile, a key in `package.json`, a section in the configuration of another tool, a CLI flag, and a declaration in the Markdown file.
2. How does the CLI find the file? What happens in a monorepo, for a file outside each package, and in a repository with no `package.json`?
3. How does a user get validation and completion in the editor?
4. Must a warning make the hook fail?
5. Is an unknown key allowed by a list in the project, by a prefix convention, or by both?
6. Which design for the first version, with a small dependency footprint, and what is its exit path?

## Method

1. Read `README.md`, `docs/spec.md`, rule 15 of `docs/format.md`, `docs/PLAN.md`, `lefthook.yml`, and `src/cli.ts`.
2. Searched the lessons in `~/dv/meta/agents/lessons/` and the index `~/dv/meta/agents/research-index.md`. No lesson or report covers the configuration of a CLI. Two lessons apply to the method: a research agent must cite only pages that it read, and a summary of a page can invent field names. Thus this research read the raw documentation with `curl`, not a summary.
3. Read the documentation of markdownlint-cli2, markdownlint, remark-cli and unified-engine, remark-message-control, Prettier, ESLint, Biome, dprint, Vale, EditorConfig, cosmiconfig, lilconfig, typos, and cspell.
4. Read the SchemaStore catalog, the SchemaStore contribution guide, the SchemaStore schema of `package.json`, and the VS Code page about JSON.
5. For the prefix question, read four sources: RFC 6648, the Specification Extensions of OpenAPI 3.1.0, the custom data attributes of the WHATWG HTML standard, and the HTML writer of Pandoc 3.12.
6. Searched the skills.sh directory with its search API for `lint config`, `markdownlint`, `config file`, and `cosmiconfig`.
7. Measured the projects under `~/dv` and the built-in modules of Node 24.20.0. Also measured the error message of `JSON.parse` in Node and Bun, and the npm registry data of the loaders.

## Findings

### 1. Measurements in our projects

- 23 git repositories are directly under `~/dv`. 22 have a `mise.toml`. Only 12 have a `package.json` [measured].
- 8 projects have Markdown files with `tbl` blocks: arch-helper, gatekeeper, idfix, markgraf, meta, pac-review, podcast-autocutter, and tbl-md. 5 of these 8 have no `package.json` [measured].
- Under `~/dv`, only one line in a Markdown file is an attribute line with a key: `{align=right}` [measured]. No project uses an unknown key today.
- Node 24.20.0 has no built-in module for JSONC, YAML, TOML, or INI [measured, `require('node:module').builtinModules`]. Only `JSON.parse` is built in.
- For a JSON syntax error, `JSON.parse` gives no line and no position, in Node 24.20.0 and in Bun 1.4.2. Node gives a short part of the text, and Bun gives only the bad token [measured].

Thus a key in `package.json` misses most of our projects. Thus a format other than plain JSON needs a library. The spec (principle 4) allows a runtime library only from the mdast and micromark family.

### 2. Where comparable tools keep the configuration

```tbl
tool: Tool
files: Configuration files
search: How the tool finds the file
other: Other places
--
tool: markdownlint-cli2
files: `.markdownlint-cli2.jsonc`, `.markdownlint-cli2.yaml`, `.markdownlint-cli2.mjs`, and others. Also `.markdownlint.jsonc`, `.markdownlint.json`, `.markdownlint.yaml`, `.markdownlint.yml`.
search: The configuration of the current folder applies to the tree below it. A file in a subfolder overrides the configuration above it. For a file outside the current folder, the tool uses the configuration of the current folder for the nearest common parent folder.
other: `--config <file>`. `--configPointer` takes a JSON Pointer into another file, for example `/tool/markdownlint-cli2` in `pyproject.toml` or a key in `package.json`. HTML comments in the Markdown file: `<!-- markdownlint-disable -->` and `<!-- markdownlint-configure-file {...} -->`.
--
tool: remark-cli (unified-engine)
files: `.remarkrc`, `.remarkrc.json`, `.remarkrc.cjs`, `.remarkrc.js`, `.remarkrc.mjs`, `.remarkrc.yaml`, `.remarkrc.yml`, and the field `remarkConfig` in `package.json`.
search: Starts in the folder of the file. The first file in a folder wins. If the folder has no file, the tool goes to the parent folder, and so on.
other: `--rc-path <file>`, `--no-config`. HTML comments `<!--lint disable rule-->`.
--
tool: Prettier
files: The key `prettier` in `package.json`, `.prettierrc` (JSON or YAML), `.prettierrc.json`, `.prettierrc.yaml`, `.prettierrc.json5`, JavaScript and TypeScript files, `.prettierrc.toml`.
search: Starts at the file and goes up until it finds a file or finds none.
other: No global configuration, by intent, so that the result is the same on each computer.
--
tool: ESLint (flat configuration)
files: Only `eslint.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, `.cts`. Code, not data.
search: Starts in the folder of the file and goes up through the parent folders. A subfolder of a monorepo can have its own file.
other: `-c` or `--config` stops the search.
--
tool: Biome
files: `biome.json`, `biome.jsonc`, `.biome.json`, `.biome.jsonc`.
search: Starts in the current folder, then goes up through the parent folders, then looks in the configuration folder of the user, for example `$XDG_CONFIG_HOME/biome`. Nested files are possible.
other: CLI options.
--
tool: dprint
files: `dprint.json`, `dprint.jsonc`, `.dprint.json`, `.dprint.jsonc`.
search: The current folder and the parent folders. A file in a subfolder applies to its tree, and is independent unless it sets `"inherit": true`.
other: `--config` or `-c`, a global configuration.
--
tool: Vale
files: `.vale.ini`, `_vale.ini`, `vale.ini`, `.vale`, `_vale` (INI format).
search: `--config`, then the variable `VALE_CONFIG_PATH`, then the working folder and the folders above it, then the home folder. A file of the user is always read below the project file.
other: Conditional sections can read the front matter of the file.
--
tool: typos
files: `typos.toml`, `_typos.toml`, `.typos.toml`, and the sections `[tool.typos]` in `pyproject.toml` and `[package.metadata.typos]` or `[workspace.metadata.typos]` in `Cargo.toml`.
search: Searches the parent folders of the file or folder that it checks.
other: `--config <file>`, CLI arguments. A list of accepted words in `[default.extend-words]`.
--
tool: cspell
files: `cspell.json`, `.cspell.json`, `cspell.config.yaml`, and others (from the SchemaStore catalog).
search: Not read in detail.
other: Comments in the checked file: `cspell:words` and `cspell:ignore` give a list of accepted words for that file.
--
tool: EditorConfig
files: Only `.editorconfig` (INI-like).
search: Starts in the folder of the file and goes through all parent folders. It stops at a file with `root = true` or at the root of the file system. A nearer file wins for each key.
other: None.
```

What these tools have in common:

- Each tool has a file of its own, with the name of the tool in the file name. Most tools accept more than one name and more than one format. Only EditorConfig accepts one name. ESLint accepts only code, in JavaScript or TypeScript.
- Most tools start the search at the linted file (remark, Prettier, ESLint, typos, EditorConfig). Biome, dprint, and Vale start at the current folder.
- No page that this research read names the git root as a stop of the search. EditorConfig stops at `root = true`. cosmiconfig can stop at a `package.json` (strategy `project`) or at a `stopDir`.
- Each tool has a CLI flag that gives the file and stops the search.
- A key in `package.json` exists in remark, Prettier, and (with `--configPointer`) markdownlint-cli2. The SchemaStore schema of `package.json` knows `prettier`, `eslintConfig`, and `stylelint`, but not `remarkConfig`.
- A shared file of another ecosystem exists in typos (`pyproject.toml`, `Cargo.toml`) and in markdownlint-cli2 (`--configPointer`). PEP 518 gives each tool that owns its name on PyPI the table `[tool.<name>]` in `pyproject.toml`.
- A declaration in the checked file exists in markdownlint, remark, and cspell. cspell uses it for a list of accepted words, which is near to our case. Vale reads the front matter only to select a section.

### 3. Loader libraries

- cosmiconfig 10.0.1 depends on `js-yaml` and `env-paths`. It reads `package.json`, rc files in JSON, YAML, and JavaScript, and files in a `.config` subfolder. Its default strategy `none` looks only in the current folder. The strategy `project` goes up to a `package.json`. The strategy `global` goes up to `stopDir` (default: the home folder) and then reads a global folder.
- lilconfig 3.1.3 has no dependency and the same API as cosmiconfig, but no YAML by default.
- The two loaders have about 159 million and 98 million downloads each week [measured, npm downloads API, week to 2026-10-04].
- markdownlint-cli2 itself uses `jsonc-parser`, `js-yaml`, and `smol-toml` to read its formats. `jsonc-parser` 3.3.1 (MIT) and `smol-toml` 1.9.0 (BSD-3-Clause) have no dependency [measured, npm registry].

A loader gives a search over many names and formats. tbl-md needs one name and one format. The search for one file name is a loop of about 20 lines with `node:fs` and `node:path` [guess]. Thus a loader library does not save enough work to justify a change of principle 4.

### 4. Schema validation and completion

- VS Code connects a JSON file to a schema in two ways: a `$schema` key in the file, or the setting `json.schemas`. VS Code also has a JSONC mode, which allows comments.
- SchemaStore holds a catalog. Each entry has a `fileMatch` list, and editors and language servers use it to select the schema for a file name. A schema can be in the SchemaStore repository or on the server of the tool. The catalog has entries for `.markdownlint.json`, `.remarkrc`, `.prettierrc`, `biome.json`, `dprint.json`, `lefthook.yml`, `mise.toml`, `typos.toml`, and others.
- Biome writes a versioned schema URL into its file: `https://biomejs.dev/schemas/2.5.15/schema.json`.

Thus SchemaStore gives completion for a known file name with no work of the user. Before that, a `$schema` key gives the same result.

### 5. Warnings and exit codes

```tbl
tool: Tool
default: Exit code with only warnings
strict: How a warning makes the run fail
--
tool: ESLint
default: 0
strict: `--max-warnings <n>`: if the number of warnings is more than n, the exit code is not 0. The default -1 means no limit.
--
tool: markdownlint-cli2
default: 0 ("there may be warnings")
strict: Exit code 1 for errors, 2 for a failure of the tool.
--
tool: remark-cli
default: 0
strict: `--frail`: exit code 1 also on warnings.
--
tool: Vale
default: 0. The exit code follows the errors.
strict: The project sets the level of each rule. `--no-exit` gives 0 also for errors.
```

All four tools give exit code 0 for warnings by default, and each tool has a way to make warnings fail. ESLint uses the name `--max-warnings`, and `--max-warnings 0` is the strict form.

Today tbl-md has exit code 0 (no problem), 1 (a problem in a file), and 2 (a usage error) (`README.md`, section CLI). A configuration error fits code 2, as in markdownlint-cli2.

### 6. List or prefix

- RFC 6648 deprecates the prefix `X-` for new parameters. It says that the prefix "causes more problems than it solves", because a private name can become a standard name later. It recommends meaningful names, and a registry for the names.
- OpenAPI 3.1.0 uses the prefix `x-` for its extensions, and reserves `x-oai-` and `x-oas-`.
- The WHATWG HTML standard defines `data-*` attributes as custom data, "private to the page or application".
- The HTML writer of Pandoc 3.12 adds the prefix `data-` to each attribute that is not an HTML attribute. It keeps a key that starts with `data-` or `aria-`, or that has a colon [source read: `Writers/HTML.hs`, lines 756 to 763].

A prefix rule needs no configuration, but it cannot find a typo after the prefix: `x-ownr` passes. A list finds each typo, and it is the "registry" that RFC 6648 recommends, in the scope of one project. After Pandoc, the key `data-x` gives the same HTML as the key `x`. Thus a `data-` prefix adds nothing for Pandoc users.

### 7. The skills.sh directory

The search found skills that use markdownlint (for example `rshade/agent-skills/markdownlint`) and a skill for ESLint and Prettier configuration. No skill covers the design of the configuration of a CLI.

## Comparison of the places

```tbl
place: Place
pro: For
contra: Against
--
place: A dotfile in JSON
pro: The common pattern. `JSON.parse` reads it, with no dependency. A JSON Schema gives completion. Works in each repository, also with no `package.json`.
contra: No comments. A syntax error has no line number (finding 1).
--
place: A dotfile in JSONC, YAML, or TOML
pro: Comments, which help a human (principle 0). TOML fits repositories that use `mise.toml`.
contra: Needs a parser library outside the mdast and micromark family. Thus it needs a change of `docs/spec.md` by the user.
--
place: A key in `package.json`
pro: No new file in a JavaScript project.
contra: 5 of the 8 projects with `tbl` blocks have no `package.json`. Two places for one state. No completion from the SchemaStore schema of `package.json`.
--
place: A section in the file of another tool (`pyproject.toml`, `Cargo.toml`, `mise.toml`, `.markdownlint-cli2.jsonc`)
pro: No new file.
contra: Needs a TOML or JSONC parser. Each ecosystem has its own file, so the code must know many files. The other tool can reject or move the section.
--
place: A CLI flag, for example `--attribute-key status`
pro: No file. Easy to test.
contra: The list lives in each hook and in each command, so it is not in one place. An editor or a second hook does not see it. Good only as an override.
--
place: A declaration in the Markdown file (front matter or an HTML comment)
pro: The key and its declaration are in one file. cspell and markdownlint have this.
contra: The vocabulary of a project spreads over many files. tbl-md parses only `tbl` blocks today, not front matter. A typo in the declaration hides a typo in the table.
```

## Recommendation for the first version (proposal)

### The file

One file `.tbl-md.json` in plain JSON:

```json
{
  "$schema": "https://raw.githubusercontent.com/thoka/tbl-md/v0.2.0/schema/config.schema.json",
  "attributeKeys": ["status", "owner"]
}
```

- One name and one format. The name has the name of the tool and the dot of the other dotfiles of a repository (`.editorconfig`, `.prettierrc`). Do not accept a second name.
- `JSON.parse` reads the file, so the package gets no new dependency.
- The loader ignores `$schema`. `attributeKeys` is a list of strings. Each string has the key form of an attribute key. `align` is always known and needs no entry.
- Each other top-level key, a wrong type, or a JSON syntax error is a configuration error. The CLI prints one line that names the file and the problem, and exits with code 2. For a semantic error, the line names the key path, for example `attributeKeys[2]`. For a syntax error, the line gives the message of `JSON.parse`. It has no line number (finding 1). This is a known gap of the project rule "An error names the line".

### The search

- For each linted file, the CLI starts in the folder of that file and goes up.
- It stops at the first folder that has `.tbl-md.json`. That file is the configuration.
- It also stops at the first folder that has a `.git` entry, a folder or a file. A git worktree has a `.git` file, so a worktree in `.worktrees/<step>` uses its own checkout of the configuration. If that folder has no `.tbl-md.json`, the file has no configuration.
- With no `.git` entry, the search goes to the root of the file system.
- For stdin (`-`), the search starts in the current folder.
- The nearest file wins, and the CLI does not merge files. A subproject of a monorepo gets its own file with its own full list.
- `--config <file>` gives the file and stops the search for all files of the run.
- No configuration in the home folder. Prettier gives the reason: a global file makes the result different on each computer.
- The CLI caches the result for each folder, so that a run over many files reads each configuration once.

Why the git root as a stop: our hooks run in a repository, and a repository is the unit of a project. A file in `~/dv/.tbl-md.json` must not change the lint of all projects. EditorConfig solves the same problem with `root = true`, but that needs one more key in each file. No page of a compared tool names the git root as a stop, so this is a choice of tbl-md. Its cost is small, because one `stat` for each folder finds the `.git` entry.

### The library and the CLI

- The library takes the list as an option, for example `lint(text, { attributeKeys })`. It does not read files. Thus Markgraf and other users of the library give the list in their own way.
- Only the CLI finds and reads `.tbl-md.json`. The loader uses only `node:fs` and `node:path`.

### Warnings and exit codes

- An unknown key is a warning with the code `unknown-attribute-key`. The message names the key, the configuration file that the CLI used (or "no .tbl-md.json found"), and the fix: "Add the key to attributeKeys in .tbl-md.json".
- A run with only warnings exits with code 0, as in ESLint, markdownlint-cli2, remark-cli, and Vale.
- `--max-warnings <n>` with the meaning of ESLint: if the number of warnings is more than n, the exit code is 1. The default is no limit.
- The hooks of our projects use `tbl-md lint --max-warnings 0`. The global rules say that a rule needs a check. A warning that does not fail the hook is no check for an agent [guess, from the rule "A rule needs a check"]. A user of the npm package who does not want this keeps the default.
- The output line of a warning must show that it is a warning, for example `docs/a.md:12:1: warning: ... (unknown-attribute-key)`. The step decides the exact form, and the README documents it.

### List or prefix

Only a list in the first version. No prefix convention, for three reasons:

1. A list finds a typo, and a prefix rule does not (finding 6).
2. RFC 6648 advises against a prefix such as `x-`.
3. One state in one place: the vocabulary of the project is the list.

A user who wants a prefix can write the full keys into the list.

### Schema

- The package ships `schema/config.schema.json`, and the README gives the `$schema` line with a URL at the version tag.
- After the first release with the file, an entry in the SchemaStore catalog with `fileMatch: [".tbl-md.json"]` gives completion in each editor with no `$schema` line.

### Exit path

Each step below adds to the design and does not break a valid file:

- JSONC with comments: replace `JSON.parse` with `jsonc-parser` (no dependency, MIT, used by markdownlint-cli2). It also gives the offset of a syntax error, so the error can name the line. This needs a change of principle 4 in `docs/spec.md` by the user.
- If projects want a namespace: a pattern in `attributeKeys`, for example `x-*`.
- When one project needs it: a merge of files for a monorepo, with a key such as `root` or `extends`.
- More options: new top-level keys in the same file and in the same schema.
- When a Python or Rust project asks for it: a section in `pyproject.toml` or `Cargo.toml`, as in typos.
- To leave tbl-md: the file is plain JSON with one list. A script can move the list to another tool in minutes [guess].

## Critical analysis

### 1. Unquestioned premises

- The question takes for granted that unknown keys need a lint at all. The format already keeps each attribute (rule 15). An alternative is no warning and a closed list in the documentation. But the spec of 0.2.0 asks for the warning, and the measurements show no use of unknown keys today. Thus the configuration serves a need that does not exist yet. A better question is: "What is the smallest configuration that lets the first project register its first key?" The recommendation answers it with one file and one list.
- The question frames the configuration as a property of the project, as in the JavaScript ecosystem. Our projects are mostly not JavaScript projects (finding 1). The real unit is the git repository, and the recommendation uses it as the stop of the search.
- The question takes for granted that a warning is the right severity. For an agent, a warning that does not fail is noise. The recommendation keeps the warning for the public package and makes it strict in our hooks.
- The question takes for granted that more options will come. With little data, do not optimize. The design must allow more options, but must not build for them.

### 2. The standard solution

The standard solution is a loader library such as cosmiconfig, with many file names and formats, and a key in `package.json`. The control mechanisms:

- **Vendor lock-in**: low. cosmiconfig and lilconfig are MIT [guess, license not read]. But a key in `package.json` ties the configuration to the npm ecosystem, and our non-JavaScript projects have no such file.
- **Rent-seeking**: none. No tool needs a payment.
- **Telemetry**: none in the compared loaders [guess, no telemetry code was read].
- **Attention economy**: none.
- **Centralization**: SchemaStore is one central catalog on GitHub, and editors download schemas from it. The npm registry is the one source of the package. A `$schema` URL on GitHub makes completion depend on GitHub.

### 3. The autonomous architecture

- A plain JSON file in the repository, read by code in the package with no dependency. The configuration is data, not code, so no tool runs code from the repository (ESLint flat config and `.prettierrc.js` run code).
- The schema ships in the npm package and in the git repository. A user can point `$schema` to a local path, for example `./node_modules/tbl-md/schema/config.schema.json`, or set `json.schemas` in VS Code, with no network.
- A SchemaStore entry is optional comfort. The file works with no editor support.
- The format of `.tbl-md.json` is documented in the repository under the MIT license, so another tool can read it.

### 4. The cost of autonomy

- No comments in plain JSON. A human cannot write why a key is in the list. Cost: a note in the README of the project, or a later change to JSONC with one dependency.
- No line number for a JSON syntax error. Cost: the user reads the snippet in the message of Node and finds the line by hand. For a file of five lines, this takes seconds [guess].
- Own search code: about 20 lines and tests for the stop rules, the stdin case, the cache, and `--config` [guess]. The maintenance is small, because the rules are fixed.
- A local `$schema` path works only in a JavaScript project with `node_modules`. In the other projects, the user needs the URL or a VS Code setting until SchemaStore has an entry.
- No merge of files in a monorepo. Cost: a subproject repeats the list of the parent. Today no project needs a second list.

## Sources

All opened on 2026-10-06.

- tbl-md: `README.md`, `docs/spec.md`, `docs/format.md`, `docs/PLAN.md`, `lefthook.yml`, `src/cli.ts` (in this repository)
- Lessons `research-agent-cites-unread-pages.md` and `webfetch-summary-invents-fields.md` in `~/dv/meta/agents/lessons/`, and `~/dv/meta/agents/research-index.md`
- markdownlint-cli2 README (configuration files, `--config`, `--configPointer`, exit codes): https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/main/README.md
- markdownlint-cli2 dependencies: https://raw.githubusercontent.com/DavidAnson/markdownlint-cli2/main/package.json
- markdownlint README (inline comments, `markdownlint-configure-file`): https://raw.githubusercontent.com/DavidAnson/markdownlint/main/README.md
- unified-engine README (`rcName`, `packageField`, the search through the parent folders, `frail`): https://raw.githubusercontent.com/unifiedjs/unified-engine/main/readme.md
- remark-cli README (file list, order of precedence, `--frail`, `--rc-path`): https://raw.githubusercontent.com/remarkjs/remark/main/packages/remark-cli/readme.md
- remark-message-control README (`<!--lint disable-->`): https://raw.githubusercontent.com/remarkjs/remark-message-control/main/readme.md
- Prettier, Configuration File: https://raw.githubusercontent.com/prettier/prettier/main/docs/configuration.md
- ESLint, Configuration Files (file names, resolution): https://raw.githubusercontent.com/eslint/eslint/main/docs/src/use/configure/configuration-files.md
- ESLint, Command Line Interface (`--max-warnings`): https://raw.githubusercontent.com/eslint/eslint/main/docs/src/use/command-line-interface.md
- Biome, Configure Biome (file names, resolution): https://biomejs.dev/guides/configure-biome/
- dprint, Configuration (nested files, `inherit`): https://dprint.dev/config/
- dprint, Setup (file names): https://dprint.dev/setup/
- dprint, CLI (`--config-discovery`): https://dprint.dev/cli/
- Vale, `.vale.ini` (search, layering): https://vale.sh/docs/vale-ini
- Vale, CLI (exit codes, `--no-exit`): https://docs.vale.sh/topics/cli.md
- EditorConfig specification (search, `root`): https://spec.editorconfig.org/
- cosmiconfig README (search places, `searchStrategy`): https://raw.githubusercontent.com/cosmiconfig/cosmiconfig/main/README.md
- lilconfig README: https://raw.githubusercontent.com/antonk52/lilconfig/master/readme.md
- npm registry entries: https://registry.npmjs.org/cosmiconfig/latest, https://registry.npmjs.org/lilconfig/latest, https://registry.npmjs.org/jsonc-parser/latest, https://registry.npmjs.org/smol-toml/latest
- npm downloads: https://api.npmjs.org/downloads/point/last-week/cosmiconfig,lilconfig,jsonc-parser,smol-toml,js-yaml,yaml
- typos, configuration reference (sources, `pyproject.toml`, `Cargo.toml`): https://raw.githubusercontent.com/crate-ci/typos/master/docs/reference.md
- cspell, in-document options (`cspell:words`): https://raw.githubusercontent.com/streetsidesoftware/cspell/main/website/docs/Configuration/document-settings.md
- PEP 518, the `[tool]` table: https://peps.python.org/pep-0518/
- SchemaStore catalog: https://raw.githubusercontent.com/SchemaStore/schemastore/master/src/api/json/catalog.json
- SchemaStore contribution guide (`fileMatch`, self-hosted schemas): https://raw.githubusercontent.com/SchemaStore/schemastore/master/CONTRIBUTING.md
- SchemaStore schema of `package.json`: https://raw.githubusercontent.com/SchemaStore/schemastore/master/src/schemas/json/package.json
- VS Code, Editing JSON (`$schema`, `json.schemas`, JSONC): https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/languages/json.md
- lefthook, `root`: https://raw.githubusercontent.com/evilmartians/lefthook/master/docs/configuration/root.md
- RFC 6648, Deprecating the "X-" Prefix: https://www.rfc-editor.org/rfc/rfc6648.txt
- OpenAPI 3.1.0, Specification Extensions: https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/versions/3.1.0.md
- WHATWG HTML, custom data attributes: https://html.spec.whatwg.org/multipage/dom.html
- Pandoc 3.12 HTML writer (prefix `data-`): https://raw.githubusercontent.com/jgm/pandoc/3.12/src/Text/Pandoc/Writers/HTML.hs
- skills.sh search API: https://www.skills.sh/api/search?q=markdownlint (also `lint config`, `config file`, `cosmiconfig`)
