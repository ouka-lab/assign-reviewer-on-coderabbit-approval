# Contributing

Thanks for taking the time. This document covers how the project is built and
what happens to your pull request once you open it.

## How review works here

This repository uses its own action. That is deliberate: the review flow you go
through is the flow the action exists to create.

1. You open a pull request.
2. **CodeRabbit reviews it.** Because `.coderabbit.yaml` sets
   `request_changes_workflow: true`, CodeRabbit requests changes while it still
   has findings.
3. You address them.
4. **CodeRabbit approves.** That approval is the trigger.
5. Only then is a human reviewer asked.

Nothing asks for a human while the AI still has feedback outstanding, so no one
reviews code that is about to change.

### Who actually gets assigned

The rule for this repository is `solo` with `@ysknsid25` as the maintainer, so
what step 5 does depends on where your branch lives:

| Your pull request | On CodeRabbit approval |
|---|---|
| Branch in this repository, opened by someone other than the maintainer | The maintainer is assigned automatically. |
| Branch in this repository, opened by the maintainer | Nobody is assigned. An author cannot review their own work, and in a single-maintainer repository that is normal rather than an error — this is what the `solo` rule is for. |
| **From a fork** (the usual case for outside contributors) | The action does not run. GitHub gives fork pull requests a read-only token, which is a supply-chain protection this project relies on rather than works around — see [Pull requests from forks](README.md#pull-requests-from-forks). The maintainer picks these up manually. |

So if you are contributing from a fork, expect CodeRabbit to review you but not
to see an automatic reviewer assignment. That is working as intended, not a
broken workflow.

## Getting set up

Requires [Bun](https://bun.sh) — the version in [`.bun-version`](.bun-version).

```bash
bun install
```

## Commands

| Command | What it does |
|---|---|
| `bun test` | Runs the tests. Coverage thresholds are enforced and a shortfall fails the run. |
| `bun run typecheck` | `tsc --noEmit`. Bun does not typecheck when it runs tests, so this catches what tests cannot. |
| `bun run lint` | `biome lint` |
| `bun run format` | `biome format --write` |
| `bun run build` | Regenerates `dist/main.js` |
| `bun run schema:generate` | Regenerates `schema.json` |

Before opening a pull request:

```bash
bun run format && bun run lint && bun run typecheck && bun test
```

## Generated files

`dist/main.js` and `schema.json` are generated **and committed**.

GitHub never runs an install step for an action — it checks out the repository
and runs it — so the bundle has to be in the repository, with every dependency
inlined. A stale `dist/` ships broken code to everyone using the action, which
is why CI regenerates both files and fails when what you committed differs.

For pull requests from branches in this repository, CI regenerates them and
commits the result for you. From a fork it cannot push, so run `bun run build`
and `bun run schema:generate` yourself and commit the output.

Never hand-edit either file. `schema.json` comes from the Valibot schema in
`src/config.ts`; edit that instead.

## Tests

Tests live in `src/__tests__` and use `bun:test`.

Two things worth knowing:

- **`await` your rejection assertions.** `expect(promise).rejects.toThrow(...)`
  without `await` passes even when the assertion is wrong. If you add one, break
  it on purpose once and confirm the suite goes red.
- Anything reaching the network takes an injectable `fetcher`; anything random
  takes an injectable `rng`. Use them rather than mocking globals.

## Code style

Biome handles formatting and linting, so there is nothing to argue about there.

One rule it cannot enforce: **comments explain why, not what.** A comment that
restates the code is noise that hides the comments that matter. Reach for one
when a reader would otherwise wonder why an obvious alternative was not taken —
for example why normalization sits outside the Valibot pipeline, or why the
`solo` rule has no minimum reviewer count.

## Design decisions to know before proposing a change

These come up often enough to write down.

- **`rules` is an array that holds exactly one rule.** The array shape is there
  for path-scoped rules later. Until `paths` exists, several rules would all
  match every pull request with no defined meaning, so the config is rejected
  rather than given an invented merge policy.
- **The `solo` rule exists** because `all` and `random` both assume someone
  other than the author is always available, which is false in a
  single-maintainer repository.
- **Normalization is not in the Valibot pipeline.** `transform` actions cannot
  be represented in JSON Schema, and including them would force schema
  generation into a mode that silently drops actions — including real
  constraints added later. The schema stays purely declarative; normalization
  happens after validation.
- **Reviewers are assigned once per pull request.** CodeRabbit approves again
  after every new commit, so the action checks submitted reviews as well as
  pending requests before doing anything.

If you want to change one of these, that is fine — open an issue first so the
reasoning can be revisited rather than rediscovered in review.

## Reporting bugs

Include the workflow run log if you can. The action logs which configuration
files it read and why it skipped, which is usually enough to see what happened.

For anything security-sensitive, please report it privately through GitHub's
security advisories rather than as a public issue.

## License

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
