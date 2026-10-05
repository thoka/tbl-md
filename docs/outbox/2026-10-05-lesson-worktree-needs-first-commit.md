---
kind: lesson
from: tbl-md
date: 2026-10-05
---

# A worktree needs a first commit, so the setup of a new repository happens in the main checkout.

EnterWorktree and `git worktree add` fail in a repository with no commits ("Failed to resolve base branch HEAD"). A session that starts a new project makes the first commit on `main` in the main checkout, and the next steps then use worktrees or feature branches. A new project with no remote yet needs `local_only = true` in `.handover.toml`, or `handover check` fails on "not pushed".

Source: tbl-md, setup of the project on 2026-10-05.
