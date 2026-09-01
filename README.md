# assign-reviewer-on-coderabbit-approval

**Hand a pull request to human reviewers the moment CodeRabbit approves it.**

[![CI](https://github.com/ouka-lab/assign-reviewer-on-coderabbit-approval/actions/workflows/ci.yml/badge.svg)](https://github.com/ouka-lab/assign-reviewer-on-coderabbit-approval/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ouka-lab/assign-reviewer-on-coderabbit-approval?label=release&color=blue)](https://github.com/ouka-lab/assign-reviewer-on-coderabbit-approval/releases)
[![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-assign--reviewer--on--coderabbit--approval-2ea44f?logo=github)](https://github.com/marketplace/actions/assign-reviewer-on-coderabbit-approval)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ouka-lab/assign-reviewer-on-coderabbit-approval&?utm_source=oss&utm_medium=github&utm_campaign=ouka-lab%2Fassign-reviewer-on-coderabbit-approval&&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
[![GitHub last commit](https://img.shields.io/github/last-commit/ouka-lab/assign-reviewer-on-coderabbit-approval)](https://github.com/ouka-lab/assign-reviewer-on-coderabbit-approval/commits/main)
[![License: MIT](https://img.shields.io/github/license/ouka-lab/assign-reviewer-on-coderabbit-approval)](LICENSE)

[![Bun](https://img.shields.io/badge/Bun-1.4-000000?logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Biome-2.5-60A5FA?logo=biome&logoColor=white)](https://biomejs.dev)

---

## Why this action exists

AI review and human review start at the same time. Open a pull request and
CodeRabbit begins reviewing — but so does GitHub's own reviewer assignment, so
your teammates get a review request while the AI is still finding the easy
problems. They read code that is about to change.

The order that actually works is:

1. Open a pull request
2. CodeRabbit reviews it
3. Every finding is addressed
4. **Only then** ask a human

With `reviews.request_changes_workflow: true`, CodeRabbit publishes an
**approval** exactly at step 3. This action turns that approval into step 4:
no labels to apply, no buttons to press.

> **Unofficial.** This project is not affiliated with, endorsed by, or
> sponsored by CodeRabbit.

## Requirements

1. **CodeRabbit's request-changes workflow must be on.** In `.coderabbit.yaml`
   at the repository root:

   ```yaml
   # yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json
   reviews:
     request_changes_workflow: true
   ```

   Without it CodeRabbit never posts an approval, so nothing would ever trigger.
   The action refuses to run rather than sitting silent, and says so.

2. **`actions/checkout` must run first.** Both configuration files are read from
   the checked-out tree.

## Quick start

```yaml
name: Assign reviewers

on:
  pull_request_review:
    types: [submitted]

permissions:
  pull-requests: write
  contents: read

jobs:
  assign:
    if: >-
      github.event.review.state == 'approved' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: ouka-lab/assign-reviewer-on-coderabbit-approval@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The `if` guard skips pull requests from forks. That is deliberate - see
[Pull requests from forks](#pull-requests-from-forks). Pin every `uses:` to a
commit SHA before relying on this in earnest; see [Versioning](#versioning).

Then add `.github/assign-reviewer-on-coderabbit-approval.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/ouka-lab/assign-reviewer-on-coderabbit-approval/main/schema.json",
  "rules": [
    { "rule": "random", "needApprovalCount": 2, "reviewers": ["@alice", "@bob", "@carol"] }
  ]
}
```

See [`examples/caller-workflow.yml`](examples/caller-workflow.yml) for an
annotated version.

## Configuration

| Field | Applies to | Description |
|---|---|---|
| `rule` | all | `"all"`, `"random"`, or `"solo"`. |
| `reviewers` | all | Accounts eligible to review. A leading `@` is optional. Team handles (`@org/team`) are not supported — reviewers are requested individually. |
| `needApprovalCount` | `random` only | How many human approvals the pull request needs, excluding CodeRabbit. That many reviewers are drawn at random. |

The `$schema` key is optional and gives you completion and inline validation in
most editors.

### Choosing a rule

**`all`** — assign everyone listed. Good for a small team where each pull
request should be seen by all of them.

```json
{ "rules": [{ "rule": "all", "reviewers": ["@alice", "@bob"] }] }
```

**`random`** — assign `needApprovalCount` reviewers drawn at random. Good for a
larger team that wants a fixed number of approvals without one person becoming
the bottleneck.

```json
{ "rules": [{ "rule": "random", "needApprovalCount": 2, "reviewers": ["@alice", "@bob", "@carol", "@dave"] }] }
```

**`solo`** — for a repository with a single maintainer.

```json
{ "rules": [{ "rule": "solo", "reviewers": ["@maintainer"] }] }
```

`solo` exists because `all` and `random` both assume there is always someone
other than the author available to review. In a one-maintainer repository that
assumption breaks the moment the maintainer opens their own pull request: the
author is removed from the candidate list, nobody is left, and `all` treats that
as a configuration error.

But it is not an error. A sole maintainer having no reviewer on their own pull
request is simply how that repository works. `solo` says exactly that:

| Who opened the pull request | What happens |
|---|---|
| The maintainer | Nothing is assigned, and the run succeeds (`skipped-reason: nobody-to-assign`). No API calls are made at all. |
| Anyone else | The maintainer is assigned. |

If you configure `all` and it leaves nobody to assign, the error message points
you here.

> `solo` is independent of CodeRabbit's own bypass list. If the maintainer is on
> that list, CodeRabbit never approves their pull requests and this action never
> runs. `solo` guarantees that even when it *does* run, the result is a quiet
> no-op rather than a failure. The two are layers, not alternatives.

### Why `rules` is an array that holds exactly one rule

Because path-scoped rules are planned. A future `paths` field will let each rule
target different files, and the array is already shaped for it.

Until `paths` exists, though, every rule would match every pull request, and
several rules at once have no defined meaning — `all` and `random` would
contradict each other about how many approvals a pull request needs. Rather than
inventing a merge policy you cannot express intent about, the action requires
exactly one rule and explains why if you write two.

When `paths` lands, configurations written today keep working unchanged.

## How assignment behaves

**Reviewers are assigned once.** If any human is already a requested reviewer,
or has already submitted a review, the action does nothing.

This matters because CodeRabbit approves again after every new commit. Without
it, each approval would pile on another round of reviewers. The check looks at
submitted reviews as well as pending requests, because approving *removes*
someone from the requested list — pending requests alone would look empty on the
second approval and reviewers would be assigned twice.

Accounts ending in `[bot]`, and anything in `exclude-authors`, never count as an
involved human and are never assigned. The pull request author is always
removed from the candidate list.

## Validation

The action fails, rather than doing nothing quietly, when:

- `.coderabbit.yaml` (or `.coderabbit.yml`) is missing
- `reviews.request_changes_workflow` is not exactly `true`
- the configuration file is missing or is not valid JSON
- the configuration does not match the schema — unknown keys included, so a
  typo is caught rather than ignored
- `rules` does not hold exactly one rule
- the rule cannot be satisfied for this pull request, for example a `random`
  rule whose `needApprovalCount` exceeds the reviewers left after removing the
  author

Every problem in a configuration file is reported at once, each with its path
(`rules.0.needApprovalCount: …`), so one run tells you everything to fix.

Validation happens *before* the once-only check above, so a broken configuration
surfaces even on a pull request the action would not have acted on.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `github-token` | Yes | — | Token with `pull-requests: write`. |
| `config-file` | No | `.github/assign-reviewer-on-coderabbit-approval.json` | Rules file, relative to the repository root. |
| `coderabbit-config-file` | No | `""` | CodeRabbit config to verify. When empty, `.coderabbit.yaml` is tried first and `.coderabbit.yml` second. |
| `coderabbit-account-id` | No | `coderabbitai[bot]` | Account whose approval triggers assignment. |
| `exclude-authors` | No | `""` | Comma-separated accounts that never count as an involved human and are never assigned. `[bot]` accounts are excluded already. |
| `pr-number` | No | `github.event.pull_request.number` | Pull request number. |
| `pr-author` | No | `github.event.pull_request.user.login` | Pull request author. |
| `repository` | No | `github.repository` | Target repository, `owner/repo`. |
| `bun-version` | No | `1.4.0` | Bun version used to run the action. |
| `dry-run` | No | `false` | Log the planned assignment without calling the API. |

## Outputs

| Output | Description |
|---|---|
| `assigned-reviewers` | Comma-separated accounts that were requested. Empty when nothing was assigned. |
| `skipped-reason` | Empty when reviewers were assigned, otherwise `not-approved`, `not-coderabbit-approval`, `already-involved`, or `nobody-to-assign`. |

## Permissions

```yaml
permissions:
  pull-requests: write
  contents: read
```

## Pull requests from forks

**This action does not run on pull requests from forks — by design. Keep it
that way.**

On `pull_request_review`, GitHub checks out the pull request's *merge commit*,
not the base branch. Both `.coderabbit.yaml` and the rules file are therefore
read from the contributor's version of the code. On a fork pull request, that
means an outsider controls them.

If such a workflow held write permissions, this action would be a ready-made
foothold: a pull request could rewrite the rules file, and the precondition
check meant to guard it, and then act on the repository with its token.

GitHub prevents that by giving the workflow a **read-only `GITHUB_TOKEN`** for
fork pull requests. This action relies on that protection rather than routing
around it. Requesting a reviewer simply fails, which is the correct outcome.

> **Do not "fix" this with `pull_request_target` or a personal access token.**
> Both hand write permissions to code an outsider controls, which removes the
> exact protection described above. There is no configuration of this action
> that makes fork pull requests safe to act on.

So that fork pull requests are skipped quietly instead of failing, guard the job:

```yaml
    if: >-
      github.event.review.state == 'approved' &&
      github.event.pull_request.head.repo.full_name == github.repository
```

## Runtime

The action bundles its own runtime setup: it installs Bun and runs a single
pre-bundled file with no dependency installation at run time. Your workflow does
not need a `setup-bun` step, and nothing is fetched from npm while it runs.

## Versioning

**Pin by commit SHA.** A tag can be moved to point at different code; a SHA
cannot. For an action that runs with `pull-requests: write`, that difference is
the whole security story:

```yaml
uses: ouka-lab/assign-reviewer-on-coderabbit-approval@<commit-sha> # v1.0.0
```

The trailing comment keeps the version readable, and Dependabot updates both the
SHA and the comment for you.

`@v1` also works and tracks the latest `v1.x.y`, which is convenient while
trying the action out — but it means you run whatever that tag points to today.

## Contributing

```bash
bun install
bun run format && bun run lint && bun run typecheck && bun test
```

`dist/main.js` and `schema.json` are generated and committed — GitHub never runs
an install step for an action, so the bundle has to be in the repository.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide, including how review
works on this repository.

## License

[MIT](LICENSE)
