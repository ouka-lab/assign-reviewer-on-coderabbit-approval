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

## Documentation

Full usage, configuration reference, and the reasoning behind each rule are
being written and land with the first release.
