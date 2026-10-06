# CLI

The package installs the CLI as `tbl-md`. Its source is `src/cli.ts`. In this checkout, run it with `mise run tbl-md <command> ...` or `bun src/cli.ts <command> ...`.

```sh
tbl-md lint [--flavor discourse|markdown-it] [--config <file>] [--max-warnings <n>] <files...>
tbl-md convert [--to tbl|gfm] [--drop-attributes] [--flavor discourse|markdown-it] [--config <file>] <files...>
```

A GFM table has no single meaning, because each renderer splits a row in its own way. So a flavor names the target renderer of GFM. The flavor `discourse` (the default) is Discourse with its default site settings, and the flavor `markdown-it` is `markdownit()`. Pick the flavor with `--flavor` or with the key `flavor` of `.tbl-md.json` (section Configuration). `docs/format.md`, section Flavors, has the exact settings of each flavor.

`tbl-md lint` reads each file and prints each problem of `lint`, in the order of the files and then by line. It gives `lint` the `attributeKeys` of the configuration file of each file (section Configuration), and the flavor of the file. Each problem is one line, and a summary line counts the errors and the warnings:

```text
docs/a.md:12:1: This is a GFM pipe table. Write it as a tbl block, for example with `tbl-md convert`. (gfm-table)
docs/a.md:20:2: warning: The attribute key "owner" is unknown. If the key is right, add it to attributeKeys in .tbl-md.json. Otherwise fix it. The configuration file is .tbl-md.json. (unknown-attribute-key)
1 error and 1 warning.
```

The form of an error is `<file>:<line>:<column>: <message> (<code>)`, and the form of a warning is `<file>:<line>:<column>: warning: <message> (<code>)`. The message of an unknown key also names the configuration file that the CLI used, or says that it found none. The codes are the problem codes of `lint` (`docs/api.md`). With no problem, the CLI prints nothing. If the warnings are more than `--max-warnings`, the summary line says so. The lint does not change a file.

`tbl-md convert` converts the tables of each file in place with `convert`. `--to tbl` is the default: each GFM table becomes a `tbl` block. `--to gfm` converts each `tbl` block to a GFM table. An attribute with no GFM form is an error at its line. With `--drop-attributes`, `--to gfm` drops these attributes and keeps the `align` of the columns and the IDs of the rows. `convert` reads the configuration file of each file as `lint` does, but it uses only its `flavor`. For each file, the CLI does one of three things:

- The file has tables to convert. The CLI writes the file and prints `<file>: converted <n> table` (or `tables`).
- The file has no table to convert. The CLI prints nothing and does not write the file.
- The conversion fails. The CLI prints each error as `<file>:<line>:<column>: <message>` and does not write the file. It goes on with the next file.

The file name `-` reads stdin. `lint -` names the file `-` in its messages. `convert -` writes the text to stdout, also when it has no table to convert, and it prints its messages to stderr. If the conversion fails, it writes nothing to stdout. The name `-` can come only once.

A file that starts with a UTF-8 BOM keeps its BOM. The lines and the columns do not count it. A conversion keeps the line ends of the file.

The CLI reads all files before it changes one. If a file cannot be read, the run stops with a usage error, and no file changes.

Each file has one flavor. `--flavor` gives it for all files. Without `--flavor`, the flavor is the `flavor` of the configuration file of the file. If that file has no `flavor`, or the file has no configuration file, the flavor is `discourse`. The CLI reads the configuration files also with `--flavor`, so that `lint` gets the attribute keys, and so that an error in a configuration file always stops the run.

These are the other options:

- `-h`, `--help`: print the usage to stdout.
- `--version`: print the version of the package.
- `--drop-attributes`: only for `convert --to gfm`. Drop each attribute that GFM cannot hold, with no error.
- `--flavor <flavor>`: `discourse` or `markdown-it`. The target renderer of GFM for all files. It wins over the `flavor` of the configuration file. The default is `discourse`.
- `--config <file>`: use this configuration file for all files, and do not search for `.tbl-md.json`. `convert` uses only its `flavor`.
- `--max-warnings <n>`: only for `lint`. If there are more than `n` warnings in all files, the exit code is 1. `n` is a whole number, 0 or more. With no option, there is no limit, as in ESLint.
- `--`: each argument after it is a file name, also if it starts with `-`.

These are the exit codes:

```tbl
code: Exit code
when: When
--
code: 0
when: For `lint`: no file has an error, and the warnings are not more than `--max-warnings`. For `convert`: each file converted, or it had no table to convert. Also `--help` and `--version`.
--
code: 1
when: For `lint`: a file has an error, or the warnings are more than `--max-warnings`. For `convert`: the conversion of a file failed.
--
code: 2
when: A usage error: no command, an unknown command, an unknown option, a bad value of `--to`, `--flavor`, or `--max-warnings`, `--to` or `--drop-attributes` for the wrong command, `--max-warnings` for `convert`, no files, `-` more than once, or a file that cannot be read. Or a configuration error (section Configuration). The CLI prints one line to stderr that names the problem.
```

## Configuration

`tbl-md lint` reads the attribute keys of the project from the file `.tbl-md.json`. Rule 15 of `docs/format.md` says that the lint warns on an unknown attribute key. The file lists the keys that the project knows. It can also give the flavor of the project, for `lint` and `convert`:

```json
{
  "$schema": "https://raw.githubusercontent.com/thoka/tbl-md/v0.3.0/schema/tbl-md.schema.json",
  "attributeKeys": ["status", "owner"],
  "flavor": "discourse"
}
```

- `attributeKeys` is a list of keys in the key form of rule 14: a letter, then letters, digits, `_`, and `-`. Keys are case-sensitive. `align` is always known and needs no entry. With no `attributeKeys`, each key other than `align` is unknown.
- `flavor` is optional: `"discourse"` or `"markdown-it"` (section Flavors of `docs/format.md`). `--flavor` wins over it. With no `flavor`, the flavor is `discourse`. The key needs version 0.3.0 or later, also in the URL of `$schema`, because the schema of version 0.2.0 does not know it.
- `$schema` is optional. It names the JSON Schema of the file, so that an editor can check the file and complete the keys. The loader ignores its value, but the value must be a string. The package has the schema as `schema/tbl-md.schema.json`.
- The file is plain JSON, with no comments. `JSON.parse` reads it, so the package needs no other parser.

For each file, the CLI searches the configuration file. The search starts in the folder of the file and goes up. It stops at the first folder with `.tbl-md.json`, and uses that file. It also stops at the first folder with a `.git` entry (a folder, or a file as in a git worktree), and at the root of the file system. Then the file has no configuration. For stdin (`-`), the search starts in the current folder. The nearest file wins, and the CLI does not merge files. Thus a subfolder with its own `.tbl-md.json` has its own full list. `--config <file>` gives one file for all files of the run, and the CLI does not search. There is no configuration in the home folder, so that the lint gives the same result on each computer.

These are configuration errors: invalid JSON, a value that is not an object, a key other than `$schema`, `attributeKeys`, and `flavor`, a value of a wrong type, a key that does not have the key form, a `flavor` other than `"discourse"` and `"markdown-it"`, and a file that cannot be read. A configuration error stops the run before any output and before any file changes, with exit code 2. The CLI prints one line to stderr that names the file, for example:

```text
tbl-md: docs/.tbl-md.json: attributeKeys[2] "Owner name" is not a key. A key starts with a letter, then letters, digits, "_", and "-".
```

For invalid JSON, the line has the message of `JSON.parse`. It names the line of the file (`tbl-md: .tbl-md.json:3: ...`) only if `JSON.parse` gives a position. Node gives it for most errors, and Bun gives none.

## The pre-commit hook

The pre-commit hook of this project runs `tbl-md lint --max-warnings 0` on the staged Markdown files (`lefthook.yml`), so that an unknown attribute key fails the commit too. `mise run pre-commit` runs the hook on the staged files, as git does. The lint reads the file in the working tree, not the staged text.

When the package is on npm, another project can run the lint in its hook. This is an example for lefthook:

```yaml
pre-commit:
  jobs:
    - name: tbl-md lint
      glob: "*.md"
      run: npx tbl-md lint --max-warnings 0 {staged_files}
```

