---
kind: task
from: tbl-md
date: 2026-10-06
---

Support planning files outside a public repository, for the rule `2026-10-06-rule-public-repo-no-private-context.md` of tbl-md.

1. `handover check` and `handover show` read the plan from a configurable path, for example `plan_dir = ".plan"` in `.handover.toml`. The rules "plan not changed", "imported outbox file", and "not pushed" then apply to the companion repository in that folder too.
2. `mise run outbox scan` and Severin also look in `<project>/.plan/outbox/` (or the path of the setting).
3. The global rules that name `docs/PLAN.md`, `docs/review-queue.md`, `docs/research/`, and `docs/outbox/` of a project name the setting instead, or say "the plan folder of the project".
4. The supervisor creates the private repositories `thoka/tbl-md-plan` and `thoka/idfix-plan` (idfix is the other public repository with a plan in it), and tells the sessions to move their planning files with their history (`git filter-repo` or a plain move; the decision is open).
5. The shared check of the rule: a pre-commit check for public repositories with the list of private project names in meta.

Evidence: on 2026-10-06, the public repository tbl-md had `~/dv` paths in 12 tracked files and the name of a private project in 11. `gh repo view` shows tbl-md, idfix, musescore-icons, sqrt2, and sqrt2-gh as public, and of these only tbl-md and idfix have `docs/PLAN.md`.
