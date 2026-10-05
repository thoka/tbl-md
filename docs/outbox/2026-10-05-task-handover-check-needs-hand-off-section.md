---
kind: task
from: tbl-md
date: 2026-10-05
---

`handover check` passes when `docs/PLAN.md` has no section "Hand-off" at all. It checks only for more than one such heading. In tbl-md, a Python `re.sub` with the replacement `r"\1" + "2026-..."` read `\12` as group 12 and removed the heading two times (commits "docs: hand-off after step 1" and "docs: hand-off while step 8 waits for the user step"). `handover check` exited 0 both times.

Change: `~/dv/meta/dv/bin/handover` fails when `docs/PLAN.md` has no heading that starts with "Hand-off" or "Handoff", and `tests/test_handover.py` gets a test for it. The skill `handover` lists the new problem in its table.
