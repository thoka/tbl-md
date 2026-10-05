---
checked: 2026-10-05
recheck: each new npm trusted publishing change
decisions:
  - "tbl-md step 8 (proposal): one workflow .github/workflows/release.yml on push to main runs release-please, then npm publish with trusted publishing (OIDC), then moves stable"
  - "tbl-md step 8 (proposal): the user publishes a placeholder 0.0.0 once with npm login, then runs npm trust github and npm access set mfa=publish. The workflow publishes 0.1.0 with provenance"
  - "tbl-md step 8 (proposal): mise.toml gets node 24.21.0 (npm 11.19.0). The workflow installs bun and node with jdx/mise-action, with no cache"
  - "tbl-md step 8 (proposal): release-please manifest config, release type node, initial version 0.1.0, tags vX.Y.Z, bump-minor-pre-major true, bump-patch-for-minor-pre-major false"
  - "tbl-md step 8 (proposal): pin each action by commit SHA. The release PR uses GITHUB_TOKEN"
---

# Release of tbl-md to npm with release-please and trusted publishing

Research on 2026-10-05 for tbl-md, step 8. No paid API. No key file was read. This research did not log in anywhere and did not create anything on GitHub or npm. Each source at the end is a page or an API response that this research opened on 2026-10-05. A statement without a source has the mark "[guess]". A fact that this research measured has the mark "[measured]".

## Question

What is the current best practice (October 2026) to publish the public npm package `tbl-md` from the GitHub repository `thoka/tbl-md` with release-please? The conditions:

1. A merge of the release PR tags the release, creates the GitHub Release, and publishes to npm. The repository stores no npm token. The publish uses npm trusted publishing with OIDC from GitHub Actions. OIDC (OpenID Connect) is a standard for short-lived identity tokens. The publish also adds provenance, a signed statement of the source and the build.
2. The workflow moves the branch `stable` to the release tag.
3. The first publish works. Does npm need the package before the user can configure a trusted publisher? If yes, what is the first publish with the least effort, and how does the user then lock the package to trusted publishing?
4. The build runs in the workflow. Which npm CLI version does OIDC need?
5. The release-please config for a first version 0.1.0, release type `node`, with the bump rules before 1.0.0.
6. The workflow permissions, the action versions to pin, and the effect of the `GITHUB_TOKEN` limit.

The rules of the user apply. GitHub runs no CI tests. A release is a tag `vX.Y.Z` on `main`. The user merges the release PR. The release workflow moves `stable`. The model is in `~/dv/meta/docs/research/branching-model.md` (not copied here).

## Method

1. Read the branching model, the spec of tbl-md, the recheck head format in `~/dv/meta/README.md`, the research index, and the lessons. The only related lesson is `github-workflows-run-from-default-branch`.
2. Read the npm documentation for trusted publishing, `npm trust`, `npm stage`, and `npm access`. Read the source of `libnpmaccess` for the meaning of `mfa=publish`.
3. Read the README of release-please-action and the manifest documentation and the config schema of release-please.
4. Read the GitHub documentation for `GITHUB_TOKEN`, the `permissions` key, and the repository options for Actions.
5. Read the release lists and the tag refs of the actions through the GitHub API, to get the latest versions and their commit SHAs [measured].
6. Read the npm and Node.js release indexes, to find the npm version in each Node.js line [measured].
7. Searched skills.sh through its search API for `release-please`, `npm-publish`, and `trusted-publishing`. Read two skills.
8. Checked that the name `tbl-md` is still free on npm: the registry gives "Not found" [measured].

## Findings

### 1. Trusted publishing on npm

- npm accepts a publish from a configured GitHub workflow with a short-lived OIDC token. The workflow needs `id-token: write`. Trusted publishing "requires npm CLI version 11.5.1 or later and Node version 22.14.0 or higher" ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)).
- The npm CLI finds the OIDC environment by itself. The publish command is only `npm publish`. npm adds provenance by default, with no `--provenance` flag. This is true only for a public repository and a public package. A private repository gets no provenance ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). Thus the repository `thoka/tbl-md` must be public before the first publish from the workflow.
- Only GitHub-hosted runners work. "Self-hosted runners are not currently supported" ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). The publish job must use `runs-on: ubuntu-24.04` or similar, not the self-hosted runner of grata.
- The trusted publisher on npm has the fields owner, repository, workflow file name (only the name, for example `release.yml`), and an optional environment. The field "Allowed actions" is new. For a trusted publisher made after 2026-09-03, npm allows only `npm stage publish` by default. The user must also select `npm publish` ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). Without it, a direct `npm publish` from the workflow fails [guess: the page does not name the error].
- The `repository.url` in `package.json` "must exactly match your GitHub repository" ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). The current `package.json` has no `repository` field [measured]. Step 7 (the package build) must add `"repository": {"type": "git", "url": "git+https://github.com/thoka/tbl-md.git"}`.
- The docs say: "never use caching in release builds". The setup-node docs give the reason: a poisoned cache can expose credentials, also OIDC tokens ([setup-node advanced usage](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md)).

### 2. The first publish

- npm cannot configure a trusted publisher for a package that does not exist. The `npm trust` page says it ([npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/)). The package "must already exist on the npm registry". The feature request "Allow publishing initial version with OIDC" is still open since 2025-09-01 ([npm/cli #8544](https://github.com/npm/cli/issues/8544)).
- Since November 2025, `npm login` gives a session token that is valid for 2 hours. npm revoked the classic tokens. A new granular token with write access needs 2FA by default. It lives 90 days at most ([GitHub changelog 2025-11-05](https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/)). Thus the user does not need a granular token for the first publish. `npm login` in a browser is enough.
- `npm stage publish` can create a new package. Sources: [npm stage](https://docs.npmjs.com/cli/v11/commands/npm-stage/), [npm CLI changelog 12.2.0](https://github.com/npm/cli/blob/latest/CHANGELOG.md). But it also needs a login or a token, and a later approval with 2FA. It does not remove a step.
- `npm trust github <package> --file <workflow> --repo <owner/repo> --allow-publish --yes` configures the trusted publisher from the CLI. It needs npm 11.15.0 or later ([npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/)). It also needs 2FA on the account. Thus the user does not need the web page for this step.
- The web option "Require two-factor authentication and disallow tokens" locks the package to 2FA and OIDC. Trusted publishers still work with it. Source: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers).
- The CLI has `npm access set mfa=publish <package>` ([npm access](https://docs.npmjs.com/cli/v11/commands/npm-access/)). In `libnpmaccess`, the level `publish` means "tfa is required, automation tokens cannot override tfa". Source: [libnpmaccess source](https://github.com/npm/cli/blob/latest/workspaces/libnpmaccess/lib/index.js). This is the same as the web option [guess: the docs do not state it].
- A placeholder version solves the order problem. The user publishes a placeholder `0.0.0` once from the own machine. Then the user configures the trusted publisher. Then the workflow publishes `0.1.0` with provenance. The skill `npm-trusted-publishing` on skills.sh gives the same order: "Perform the initial publish manually from your local machine" ([paulirish skill](https://github.com/paulirish/dotfiles/blob/HEAD/agents/skills/npm-trusted-publishing/SKILL.md)). The other way, a manual publish of `0.1.0` itself, gives `0.1.0` without provenance. It also makes the publish job of the first release fail, because the version exists [guess].

### 3. Build and npm version in the workflow

- The npm docs and the setup-node docs use Node 24. Node 24 "includes a compatible npm version by default" ([setup-node advanced usage](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md)).
- Node 24.21.0 (LTS "Krypton", 2026-09-07) bundles npm 11.19.0. Node 22.23.3 bundles npm 10.9.9, which is too old. The latest npm is 12.2.0 (2026-09-30) [measured, [Node.js index](https://nodejs.org/dist/index.json), [npm registry](https://registry.npmjs.org/npm)]. npm 11.19.0 is above 11.5.1 (OIDC) and above 11.15.0 (`npm trust`). Thus Node 24 needs no `npm install -g npm`.
- `bun publish` has no OIDC and no provenance. The issue "Implement `bun publish --provenance` as in npm" is open [measured, [oven-sh/bun #15601](https://github.com/oven-sh/bun/issues/15601)]. Thus bun installs and builds, and npm publishes.
- `jdx/mise-action` installs the tools of `mise.toml`. It sets `MISE_TRUSTED_CONFIG_PATHS` to the working folder, so the checkout needs no `mise trust` [measured, [mise-action src/index.ts](https://github.com/jdx/mise-action/blob/main/src/index.ts)]. It has the input `cache` (default `true`). The release job sets it to `false`. Since v5.0.0, the action takes only a mise binary that is 24 hours old or more ([mise-action v5.0.0](https://github.com/jdx/mise-action/releases/tag/v5.0.0)).
- The global rule of the user says that tools come from `mise.toml`. So the proposal adds `node = "24.21.0"` to `mise.toml` and uses mise-action. The other way is `oven-sh/setup-bun` and `actions/setup-node`. setup-bun reads `.bun-version`, `.tool-versions`, or `package.json`, but not `mise.toml` ([setup-bun README](https://github.com/oven-sh/setup-bun)). Then the version of bun lives in two places.

### 4. release-please

- release-please-action v5.0.0 (2026-04-22) is the latest. Its only breaking change is the runtime node24 ([release-please-action v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0)). The README examples still show `@v4`.
- With no `release-type` input, the action reads `release-please-config.json` and `.release-please-manifest.json`. This is "the default behavior unless you explicitly set a `release-type`" ([release-please-action README](https://github.com/googleapis/release-please-action)).
- The outputs for the root package are `release_created`, `tag_name`, `sha`, and `version`. The permissions are `contents: write`, `pull-requests: write`, and `issues: write` ([release-please-action README](https://github.com/googleapis/release-please-action)).
- The manifest can be empty (`{}`) at the first run. The first version is "currently 0.1.0 for node" ([manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)). The schema has `initial-version` to set it explicitly ([config schema](https://github.com/googleapis/release-please/blob/main/schemas/config.json)).
- A tag without the component name needs `include-component-in-tag: false`. Then the tag is `v<version>` ([manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)). Without it, the tag of the package `tbl-md` is `tbl-md-v0.1.0` [guess: release-please takes the component from the package name].
- The bump rules before 1.0.0 ([manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)):

```tbl
option: Option
effect: Effect when the version is below 1.0.0
default: Default
--
option: bump-minor-pre-major
effect: A breaking change bumps the minor version, for example 0.1.0 to 0.2.0, not to 1.0.0.
default: false
--
option: bump-patch-for-minor-pre-major
effect: A `feat:` commit bumps the patch version, for example 0.1.0 to 0.1.1, not to 0.2.0.
default: false
```

- `bootstrap-sha` sets the oldest commit for the first changelog. Without it, the first release PR lists all Conventional Commits in the history ([manifest releaser](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md)).

### 5. GITHUB_TOKEN, permissions, and repository options

- "events triggered by the `GITHUB_TOKEN` will not create a new workflow run". Exceptions: `workflow_dispatch`, `repository_dispatch`, and `pull_request` events (opened, synchronize, reopened). These now start in an approval-required state ([GitHub docs: GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token)).
- Effect for tbl-md: the release PR does not start CI. This does not matter, because tbl-md has no CI on GitHub. The tag `vX.Y.Z` from release-please does not start a workflow on `push: tags`. This matters: the publish must run in the same workflow run as release-please, gated on `release_created`. The push to `stable` from `GITHUB_TOKEN` starts nothing. That is correct. The merge of the release PR is an action of the user, so it starts the release workflow on `main`.
- The `permissions` key "can modify the default permissions granted to the GITHUB_TOKEN, adding or removing access", top-level or per job ([GitHub docs: workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)). For a personal repository, the default is read-only for `contents` and `packages` ([GitHub docs: Actions options](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)).
- For a new personal repository, workflows cannot create pull requests. The option "Allow GitHub Actions to create and approve pull requests" is in the menu `Settings > Actions > General > Workflow permissions` ([GitHub docs: Actions options](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)). The REST call `PUT /repos/{owner}/{repo}/actions/permissions/workflow` with `can_approve_pull_request_reviews` sets it ([GitHub REST: Actions permissions](https://docs.github.com/en/rest/actions/permissions)). Thus an agent with `gh` can set it, and the user does not need the web page.

### 6. Action versions and SHAs

The latest releases on 2026-10-05, from the GitHub API [measured]. Each tag points directly to a commit.

```tbl
action: Action
tag: Tag
date: Date
sha: Commit SHA
--
action: googleapis/release-please-action
tag: v5.0.0
date: 2026-04-22
sha: 45996ed1f6d02564a971a2fa1b5860e934307cf7
--
action: actions/checkout
tag: v7.0.1
date: 2026-07-20
sha: 3d3c42e5aac5ba805825da76410c181273ba90b1
--
action: jdx/mise-action
tag: v5.0.1
date: 2026-09-30
sha: 7a4e45a543138629540c9a1616d08632b893e492
--
action: actions/setup-node
tag: v7.0.0
date: 2026-07-14
sha: 820762786026740c76f36085b0efc47a31fe5020
--
action: oven-sh/setup-bun
tag: v2.2.0
date: 2026-03-14
sha: 0c5077e51419868618aeaa5fe8019c62421857d6
```

jdx/mise-action has v5.1.0 and v5.1.1 from 2026-10-04. The proposal takes v5.0.1, because the newer releases are one day old. setup-node and setup-bun are only for the other way in finding 3.

### 7. skills.sh

The search API of skills.sh gives some matching skills ([skills.sh search](https://www.skills.sh/api/search?q=release-please)). Examples are `bmad-labs/skills/release-please`, `laurigates/claude-plugins/configure-release-please`, and `paulirish/dotfiles/npm-trusted-publishing`. The bmad-labs template publishes with `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` and release-please-action v4 ([bmad-labs workflow templates](https://github.com/bmad-labs/skills/blob/HEAD/skills/release-please/references/workflow-templates.md)). That is the old token method. The paulirish skill gives the same first manual publish, but some of its claims have no source. No skill replaces this proposal.

## Proposal

### Files

`.github/workflows/release.yml`. The trusted publisher on npm names this file name, so do not rename it.

```yaml
name: release

on:
  push:
    branches: [main]

permissions: {}

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release-please:
    runs-on: ubuntu-24.04
    permissions:
      contents: write
      pull-requests: write
      issues: write
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
    steps:
      - id: release
        uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0

  publish:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: ubuntu-24.04
    permissions:
      contents: read
      id-token: write # npm trusted publishing (OIDC) and provenance
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
          persist-credentials: false
      - uses: jdx/mise-action@7a4e45a543138629540c9a1616d08632b893e492 # v5.0.1
        with:
          cache: false # no cache in a release build
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: npm publish

  stable:
    needs: [release-please, publish]
    runs-on: ubuntu-24.04
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}
          fetch-depth: 0
      # A push with no force: it fails if stable is not an ancestor of the tag.
      # The first push creates the branch.
      - run: git push origin "HEAD:refs/heads/stable"
```

Notes on the workflow:

- The workflow has no test step, by the rule of the user. The pre-push hook runs the tests before each push to `main`.
- `bun run build` needs a `build` script from step 7. If step 7 builds in `prepack`, `npm publish` runs it again. That is harmless.
- `stable` moves only after a good publish. If the publish fails, the tag exists, but `stable` stays. Then a rerun of the failed jobs in the run continues.
- A hotfix release from `release/X.Y` needs a second trigger branch and `target-branch`. That is out of scope for 0.1.0.

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "tbl-md",
      "initial-version": "0.1.0",
      "include-component-in-tag": false,
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": false,
      "changelog-path": "CHANGELOG.md"
    }
  }
}
```

`.release-please-manifest.json`:

```json
{}
```

The bump rules that follow before 1.0.0:

```tbl
commit: Commit title
next: Next version from 0.1.0
--
commit: fix: ...
next: 0.1.1
--
commit: feat: ...
next: 0.2.0
--
commit: feat!: ... or BREAKING CHANGE
next: 0.2.0
--
commit: docs:, test:, build:, chore:
next: no release
```

In SemVer, a 0.x minor bump can break. npm and the caret range `^0.1.0` treat 0.2.0 as a new major line [guess: well known, not opened in this research]. `docs/format.md` says that a breaking change of the format "needs a new major version". With `bump-minor-pre-major`, that is the minor version while the version is below 1.0.0. The project session must decide the words of `docs/format.md` for this case.

`mise.toml`, one new line in `[tools]`:

```toml
node = "24.21.0"
```

`package.json`, one new field (step 7 owns this file):

```json
"repository": { "type": "git", "url": "git+https://github.com/thoka/tbl-md.git" }
```

### Steps for agents (no user)

1. Merge the files above into `main`. Create the public repository `thoka/tbl-md` and push `main`, for example with `gh repo create thoka/tbl-md --public --source . --push` [guess: not run in this research].
2. Allow Actions to create PRs: `gh api -X PUT repos/thoka/tbl-md/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`.
3. After the push, release-please opens the release PR "chore(main): release 0.1.0" [guess: the default title pattern]. Do not merge it before the user step below is done.

### Steps for the user (once)

One script in `~/inbox/`, written by the project session from the template `dv/bin/user-step-template.sh`. It needs the browser for `npm login` and 2FA, so it goes to the user. If the user has no npm account, first create one at https://www.npmjs.com/signup and turn on 2FA at https://www.npmjs.com/settings/~/tfa [guess: the 2FA link redirects to the own account]. The script does these steps:

1. `cd ~/dv/tbl-md && mise exec -- npm login`. The browser opens the npm login with 2FA. The session token lives 2 hours.
2. In a temporary folder, write a `package.json` with name `tbl-md`, version `0.0.0`, the description "Placeholder. The first release is 0.1.0.", the license MIT, and the `repository` field. Then `mise exec -- npm publish --access public`. npm asks for 2FA.
3. `mise exec -- npm trust github tbl-md --repo thoka/tbl-md --file release.yml --allow-publish --yes`. npm asks for 2FA.
4. `mise exec -- npm access set mfa=publish tbl-md`. This sets "Require two-factor authentication and disallow tokens".
5. `mise exec -- npm deprecate tbl-md@0.0.0 "Placeholder. Use 0.1.0 or later."`.
6. `mise exec -- npm trust list tbl-md` prints the trusted publisher into the log, as the check.

Each step first checks its result, for example with `npm view tbl-md@0.0.0 version`. Thus a second run is safe. If step 3 or 4 fails, the web page is the fallback: https://www.npmjs.com/package/tbl-md/access [guess: the options page of a package. It needs a login]. There, under "Trusted Publisher", select GitHub Actions, enter `thoka`, `tbl-md`, `release.yml`, and select `npm publish` under "Allowed actions". Under "Publishing access", select "Require two-factor authentication and disallow tokens".

Then the one action per release, each time: the user merges the release PR on GitHub. The workflow tags `vX.Y.Z`, creates the GitHub Release, publishes to npm with provenance, and moves `stable`.

## Critical analysis

### 1. Premises of the question

- The question takes the npm registry as the place of distribution. For a JavaScript library, that is the platform of the users: Node and Bun install from npm by default. It is a fact of the ecosystem, not a free choice.
- The question takes "no token in the repository" as the security goal. Trusted publishing does not remove trust. It moves the trust from a secret that the user keeps to the identity claims of GitHub, which npm checks. The user then trusts two companies, GitHub and npm, both owned by Microsoft.
- The question takes provenance as a value. Provenance proves that a GitHub-hosted runner built the package from a commit. It does not prove that the code is good. Its value for a small library with one maintainer is low today [guess].
- A better frame has two questions. First: how can a user of tbl-md check that the package matches the source? Second: how can the maintainer release with one action and no long-lived secret? Trusted publishing answers the second question. A reproducible build answers the first question without a trusted platform.

### 2. The standard solution and its control mechanisms

The standard solution is the proposal above: GitHub Actions, release-please, npm trusted publishing, provenance from Sigstore.

- Vendor lock-in: npm trusted publishing accepts only GitHub Actions, GitLab.com, and CircleCI cloud. It accepts only their hosted runners ([npm trusted publishers](https://docs.npmjs.com/trusted-publishers)). A move to Forgejo or to a self-hosted runner loses OIDC and provenance. release-please talks only to the GitHub API (branching model report).
- Centralization: npm and GitHub belong to one company. The registry, the source host, the CI, and the identity provider are one control point. npm can change rules at any time, as the token changes of November 2025 and the new default "stage only" of September 2026 show.
- Telemetry: GitHub Actions logs each run. npm records each download. The provenance record goes into the public Sigstore transparency log [guess: Sigstore is the provenance backend of npm, not opened in this research].
- Rent-seeking: none today for a public repository. GitHub-hosted runners are free for public repositories [guess: not opened in this research]. A private repository gets no provenance, which pushes projects to public hosting on GitHub.
- Attention economy: low. The release PR and the GitHub Release are notifications, but the user controls them.

### 3. The autonomous architecture

- Publish from the own machine. `npm publish` from a local release script, with `npm login` and 2FA at each release. No CI, no OIDC, no GitHub dependency for the publish. No provenance.
- Staged publish: a self-hosted runner or the local machine runs `npm stage publish` with a stage-only granular token. Then the user runs `npm stage approve` with 2FA ([npm stage](https://docs.npmjs.com/cli/v11/commands/npm-stage/), [npm CLI changelog 12.1.0](https://github.com/npm/cli/blob/latest/CHANGELOG.md)). The token cannot publish alone. This works on the self-hosted runner and on Forgejo Actions. No provenance.
- A protocol instead of a platform for the source: tag and sign the release in git (`git tag -s`), and let users install from a git URL or a tarball on a self-hosted Forgejo. The npm package then is only a mirror.
- Release tools without a forge API: git-cliff or `commit-and-tag-version` compute the version and the changelog from Conventional Commits locally. They need no GitHub API, and they work the same on Forgejo.
- A reproducible build: a pinned toolchain (mise) and a lockfile, so that anyone can rebuild the tarball and compare the hash. This checks the package with no trusted platform.

### 4. The cost of autonomy

- Local publish: one more user action per release (a login with 2FA and a command), so two actions instead of one merge. No provenance badge on npm. A local machine can leak a session token, but the token lives only 2 hours.
- Stage publish with a token: a granular token lives 90 days at most. Thus the user renews it four times a year. The user also approves each release twice: the merge and the stage approval. Setup: about one hour [guess].
- Signed git tags and a Forgejo mirror: a GPG or SSH signing key to keep, and a second host to run and update. Users of npm do not see it, so the gain is small for an npm library.
- git-cliff instead of release-please: no release PR. An agent or a script must open the release PR or run the release by hand. Setup and a test: about two hours [guess]. For a move to Forgejo, it is the exit path.
- Reproducible build: tbl-md is pure TypeScript with tsc, so a rebuild is likely the same byte for byte [guess]. The cost is a test that packs twice and compares, about one hour.

Recommendation: take the standard solution now. It costs the user one merge per release and no secret. The exit path is the local or staged publish with git-cliff. It needs no change of the package. It only replaces `.github/workflows/release.yml`.

## Sources

All opened on 2026-10-05.

- npm Docs, "Trusted publishing for npm packages": https://docs.npmjs.com/trusted-publishers
- npm Docs, "npm trust": https://docs.npmjs.com/cli/v11/commands/npm-trust/
- npm Docs, "npm stage": https://docs.npmjs.com/cli/v11/commands/npm-stage/
- npm Docs, "npm access": https://docs.npmjs.com/cli/v11/commands/npm-access/
- npm/cli, libnpmaccess source: https://github.com/npm/cli/blob/latest/workspaces/libnpmaccess/lib/index.js
- npm/cli, changelog of 12.1.0 and 12.2.0: https://github.com/npm/cli/blob/latest/CHANGELOG.md
- npm/cli issue #8544, "Allow publishing initial version with OIDC": https://github.com/npm/cli/issues/8544
- npm registry, dist-tags of `npm`: https://registry.npmjs.org/npm
- npm registry, `tbl-md` (Not found): https://registry.npmjs.org/tbl-md
- Node.js release index: https://nodejs.org/dist/index.json
- GitHub changelog, "npm security update: Classic token creation disabled and granular token changes" (2025-11-05): https://github.blog/changelog/2025-11-05-npm-security-update-classic-token-creation-disabled-and-granular-token-changes/
- release-please-action, README: https://github.com/googleapis/release-please-action
- release-please-action, release v5.0.0: https://github.com/googleapis/release-please-action/releases/tag/v5.0.0
- release-please, manifest releaser docs: https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
- release-please, config schema: https://github.com/googleapis/release-please/blob/main/schemas/config.json
- actions/setup-node, advanced usage, "Publishing to npm with Trusted Publisher (OIDC)": https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
- actions/setup-node, release v7.0.0: https://github.com/actions/setup-node/releases/tag/v7.0.0
- actions/checkout, release v7.0.1: https://github.com/actions/checkout/releases/tag/v7.0.1
- jdx/mise-action, README and `src/index.ts`: https://github.com/jdx/mise-action
- jdx/mise-action, release v5.0.0: https://github.com/jdx/mise-action/releases/tag/v5.0.0
- oven-sh/setup-bun, README: https://github.com/oven-sh/setup-bun
- oven-sh/bun issue #15601, "Implement bun publish --provenance as in npm": https://github.com/oven-sh/bun/issues/15601
- GitHub API, release lists and tag refs: `https://api.github.com/repos/<owner>/<repo>/releases` and `https://api.github.com/repos/<owner>/<repo>/git/ref/tags/<tag>` for each action in finding 6
- GitHub Docs, "GITHUB_TOKEN": https://docs.github.com/en/actions/concepts/security/github_token
- GitHub Docs, "Workflow syntax", `permissions`: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- GitHub Docs, "Managing GitHub Actions settings for a repository": https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository
- GitHub REST, "Actions permissions": https://docs.github.com/en/rest/actions/permissions
- skills.sh search API: https://www.skills.sh/api/search?q=release-please, `?q=npm-publish`, `?q=trusted-publishing`
- paulirish/dotfiles, skill `npm-trusted-publishing`: https://github.com/paulirish/dotfiles/blob/HEAD/agents/skills/npm-trusted-publishing/SKILL.md
- bmad-labs/skills, release-please workflow templates: https://github.com/bmad-labs/skills/blob/HEAD/skills/release-please/references/workflow-templates.md
- Related report (not copied): `~/dv/meta/docs/research/branching-model.md`
- Related lesson: `~/dv/meta/agents/lessons/github-workflows-run-from-default-branch.md`
