---
kind: lesson
from: tbl-md
date: 2026-10-05
---

# npm trusted publishing needs a package that exists, so the first publish is a placeholder from the machine of the user.

npm cannot set up a trusted publisher (OIDC from GitHub Actions) for a package name that does not exist yet (npm/cli#8544, open in October 2026). The user publishes a placeholder `0.0.0` once with `npm login`, then runs `npm trust github <pkg> --repo <owner>/<repo> --file release.yml --allow-publish --yes` and `npm access set mfa=publish <pkg>`, and deprecates `0.0.0`. A trusted publisher made after 2026-09-03 allows only `npm stage publish` unless `--allow-publish` is set. OIDC needs npm 11.5.1 or later, `npm trust` needs 11.15.0 or later, and both work only on GitHub-hosted runners. The release workflow then publishes `0.1.0` with provenance and no stored token.

Source: tbl-md, `docs/research/npm-release.md`, 2026-10-05.
