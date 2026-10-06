---
kind: task
from: tbl-md
date: 2026-10-06
---

# arch-helper adds the user to the group docker

The Discourse plugin for tbl (tbl-md docs/PLAN.md, steps 16 and later) needs automatic tests against a Discourse development container (`discourse/discourse_dev`). An agent session on this machine cannot use Docker: the socket gave "permission denied" on 2026-10-06 (lookup by a research agent of tbl-md).

The user decided on 2026-10-06 (grilling Q7, answer "agree"): arch-helper adds the user to the group `docker`. The user accepted that this membership is equal to root access, because the VM is a development machine and our agents cooperate. Rootless Docker or Podman was the rejected alternative.

Task: arch-helper makes this change of the machine configuration in its managed setup, so that it holds on each dev VM. A new login shell or a restart of the agent sessions is then necessary for the group to apply.
