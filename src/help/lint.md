# Help 6hYdD6E2: tbl-md lint
Summary: tbl-md lint reports each GFM pipe table and each error of a tbl block in Markdown files, and changes no file.
Example: `tbl-md lint --max-warnings 0 README.md`
Next: {>jaggDb08}, {>d7eL9q7f}, {>qON3J3zF}, {>MmkqXc1u}, {>wnoAZ42O}

The help of `tbl-md lint`, the most used command of tbl-md: a pre-commit hook runs it on the staged Markdown files. The short help is `tbl-md help lint`, and the full reference is the CLI reference of the package.

## Unit jaggDb08: the problem lines
Summary: Each problem is one line `<file>:<line>:<column>: <message> (<code>)`, and a summary line counts the errors and the warnings.
Next: {>d7eL9q7f}, {>wnoAZ42O}
Usage: `tbl-md lint <files>...`
Readers: user, worker, integrator, tool
Tasks: find-problem

A warning has the form `<file>:<line>:<column>: warning: <message> (<code>)`. The lines come in the order of the files, then by line. With no problem, the lint prints nothing. The file name `-` reads stdin. A GFM pipe table is an error: `tbl-md convert` turns it into a tbl block.

## Unit d7eL9q7f: the warnings and --max-warnings
Summary: An attribute key that .tbl-md.json does not list is a warning; `--max-warnings <n>` fails the run above n warnings.
Next: {>qON3J3zF}, {>wnoAZ42O}
Usage: `tbl-md lint --max-warnings 0 <files>...`
Readers: user, worker, integrator, tool
Tasks: gate-commit

With no `--max-warnings`, warnings never fail the run. A pre-commit hook gives `--max-warnings 0`, because a warning is no check.

## Unit qON3J3zF: the configuration and the flavor
Summary: The lint reads the nearest .tbl-md.json up to the root of the git repository; `--config <file>` gives one file for all files, and `--flavor` names the target renderer of GFM.
Next: {>wnoAZ42O}
Usage: `tbl-md lint --config <file> --flavor markdown-it <files>...`
Readers: user, worker, integrator, tool
Tasks: configure-lint

The file lists the known attribute keys (`attributeKeys`) and can name the flavor (`discourse`, the default, or `markdown-it`). An invalid configuration file stops the run before any output, with exit code 2.

## Unit MmkqXc1u: the JSON output
Summary: `--json` prints one JSON object with the keys errors, warnings, maxWarnings, and problems; the exit code stays the same.
Next: {>wnoAZ42O}
Usage: `tbl-md lint --json <files>...`
Readers: tool, worker, integrator, user
Tasks: read-problems

Each problem has `file`, `line`, `column`, `severity`, `code`, and `message`. With `--json`, an error goes to stderr as one object `{"error": {"type", "message", "fix"}}`, and stdout stays empty.

## Unit wnoAZ42O: the exit codes
Summary: Exit codes: 0 no error and not too many warnings, 1 an error or too many warnings, 2 a usage error, a file that cannot be read, or a bad configuration file.
Readers: user, worker, integrator, tool
Tasks: read-verdict

A usage error prints three lines to stderr: the problem, the usage line, and the help command to run.
