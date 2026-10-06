---
kind: lesson
from: tbl-md
date: 2026-10-06
---

# After `npm publish`, the registry can answer 404 for the new version for a short time.

A script that runs `npm view`, `npm deprecate`, or a similar command directly after `npm publish` can get `E404` although the publish succeeded. Poll `npm view <pkg>@<version> version` until it answers, with a time limit, before the next npm command. Do not treat the first 404 as a failed publish, and do not publish again.

Source: tbl-md, `~/.local/state/user-steps/tbl-md-publish.log` (2026-10-05): `npm publish` exited 0, the next `npm view tbl-md@0.0.0` gave E404, and the later `npm deprecate` failed.
