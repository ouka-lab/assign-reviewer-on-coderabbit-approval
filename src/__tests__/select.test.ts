import { describe, expect, it } from "bun:test";
import type { ReviewerRule } from "../config.ts";
import { resolveRule, selectAssignees } from "../select.ts";

/** Feeds a fixed sequence of values to the selector, then cycles. */
function scriptedRng(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length];
    index += 1;
    return value ?? 0;
  };
}

const all: ReviewerRule = { rule: "all", reviewers: ["alice", "bob", "carol"] };
const solo: ReviewerRule = { rule: "solo", reviewers: ["maintainer"] };
const random: ReviewerRule = {
  rule: "random",
  needApprovalCount: 2,
  reviewers: ["alice", "bob", "carol", "dave"],
};

describe("resolveRule", () => {
  it("returns the single configured rule", () => {
    expect(resolveRule([all])).toBe(all);
  });

  it("throws when there are no rules", () => {
    expect(() => resolveRule([])).toThrow(/no rules/);
  });
});

describe('selectAssignees - rule "all"', () => {
  it("assigns every eligible reviewer", () => {
    expect(selectAssignees(all, { prAuthor: "nobody" })).toEqual(["alice", "bob", "carol"]);
  });

  it("never assigns the pull request author", () => {
    expect(selectAssignees(all, { prAuthor: "bob" })).toEqual(["alice", "carol"]);
  });

  it("skips excluded accounts", () => {
    const excludeAccountIds = new Set(["carol"]);
    expect(selectAssignees(all, { prAuthor: "nobody", excludeAccountIds })).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("preserves the order written in the configuration", () => {
    const reversed: ReviewerRule = { rule: "all", reviewers: ["carol", "bob", "alice"] };
    expect(selectAssignees(reversed, { prAuthor: "nobody" })).toEqual(["carol", "bob", "alice"]);
  });
});

describe('selectAssignees - rule "solo"', () => {
  it("assigns the maintainer on someone else's pull request", () => {
    expect(selectAssignees(solo, { prAuthor: "contributor" })).toEqual(["maintainer"]);
  });

  it("assigns nobody on the maintainer's own pull request", () => {
    expect(selectAssignees(solo, { prAuthor: "maintainer" })).toEqual([]);
  });

  it("matches the maintainer case-insensitively", () => {
    expect(selectAssignees(solo, { prAuthor: "MAINTAINER" })).toEqual([]);
  });
});

describe('selectAssignees - rule "random"', () => {
  it("assigns exactly needApprovalCount reviewers", () => {
    expect(selectAssignees(random, { prAuthor: "nobody" })).toHaveLength(2);
  });

  it("is deterministic for a given rng", () => {
    const first = selectAssignees(random, { prAuthor: "nobody", rng: scriptedRng(0, 0) });
    const second = selectAssignees(random, { prAuthor: "nobody", rng: scriptedRng(0, 0) });
    expect(first).toEqual(second);
  });

  it("picks the candidates the rng points at", () => {
    // rng 0 takes the first remaining index each time.
    expect(selectAssignees(random, { prAuthor: "nobody", rng: scriptedRng(0) })).toEqual([
      "alice",
      "bob",
    ]);
  });

  it("returns results in configuration order, not selection order", () => {
    // 0.99 takes the last remaining index, so dave is drawn before carol.
    const picked = selectAssignees(random, { prAuthor: "nobody", rng: scriptedRng(0.99) });
    expect(picked).toEqual(["carol", "dave"]);
  });

  it("falls back to every candidate when needApprovalCount exceeds them", () => {
    const greedy: ReviewerRule = {
      rule: "random",
      needApprovalCount: 10,
      reviewers: ["alice", "bob"],
    };
    expect(selectAssignees(greedy, { prAuthor: "nobody" })).toEqual(["alice", "bob"]);
  });

  it("counts the author out before picking", () => {
    const picked = selectAssignees(random, { prAuthor: "alice" });
    expect(picked).toHaveLength(2);
    expect(picked).not.toContain("alice");
  });

  it("never returns duplicates", () => {
    for (let i = 0; i < 200; i++) {
      const picked = selectAssignees(random, { prAuthor: "nobody" });
      expect(new Set(picked).size).toBe(picked.length);
    }
  });

  it("draws candidates with roughly equal probability", () => {
    // Guards against a biased shuffle, which would silently keep picking the
    // same reviewer forever.
    const counts = new Map<string, number>();
    const runs = 12000;
    for (let i = 0; i < runs; i++) {
      for (const account of selectAssignees(random, { prAuthor: "nobody" })) {
        counts.set(account, (counts.get(account) ?? 0) + 1);
      }
    }
    const expected = (runs * 2) / 4;
    for (const account of random.reviewers) {
      expect(counts.get(account) ?? 0).toBeGreaterThan(expected * 0.9);
      expect(counts.get(account) ?? 0).toBeLessThan(expected * 1.1);
    }
  });
});
