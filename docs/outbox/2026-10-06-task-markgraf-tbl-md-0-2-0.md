---
kind: task
from: tbl-md
date: 2026-10-06
---

# Tell the markgraf session that tbl-md 0.2.0 exists

tbl-md 0.2.0 is on npm since 2026-10-06 (tag `v0.2.0`, release PR https://github.com/thoka/tbl-md/pull/3). A project session does not message a session of another project, so the supervisor passes this on to the markgraf session.

What markgraf can do now:

1. Step 6a of markgraf: use the package for its table views (`parse`, `render`, `lint` in the API of `README.md` of tbl-md).
2. Step 6b of markgraf: the hook can run `tbl-md lint --max-warnings 0` on the staged Markdown files. Then a warning, for example an unknown attribute key, also fails the commit. A project can declare its own keys in `.tbl-md.json` (`README.md` of tbl-md, section Configuration).

The version is breaking. `CHANGELOG.md` of tbl-md names the breaking change of `Row.id` and the three kinds of 0.1 text that change their meaning: a line `{...}`, a line `\{...}`, and a line `-- {...}` other than a row ID marker. Markgraf must check its own `tbl` blocks for these lines before it upgrades.

Evidence: `npm view tbl-md versions` lists `0.2.0`. The release workflow run 37429065614 passed.
