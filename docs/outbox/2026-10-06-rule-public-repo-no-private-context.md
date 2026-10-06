---
kind: rule
from: tbl-md
date: 2026-10-06
---

Section: Git (or a new section "Public repositories") of `agents/AGENTS.md`.

Rule text:

- A public repository names no local path, no private project, and no private decision of the user. Its planning files (plan, history, review queue, research, outbox) live in a private companion repository, for example `<owner>/<project>-plan`, cloned into the git-ignored folder `.plan/` of the public checkout. The project session is the only writer of both (user, 2026-10-06). Check: a shared pre-commit check from meta for each public repository. It fails on `~/dv`, `/home/`, and the names of the private projects, and it reads the list of names from meta, so that the public repository does not hold the list. Until it exists: none. Step 10 of the meta plan lists the gap. tbl-md has its own test for the paths.

Words of the user (2026-10-06, in the tbl-md session):

- "in einer allgemeinen bibliothek sollte nicht auf die nutzung in einem privaten repo hingewiesen werden. auch nicht auf meine lokalen pfade ..."
- On the decision history in the spec: "brauchen wir das überhaupt in dem projekt? die geschichte kann auch woanders hin. wir planen das ja im zusammenhang mit anderen projekten."
- Then the user agreed in a grilling round: all tracked files, the shared check from meta, the research reports leave the public repository too, and a private companion repository per public project in `.plan/`.
