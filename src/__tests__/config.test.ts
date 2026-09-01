import { describe, expect, it } from "bun:test";
import {
  type ActionConfig,
  MULTIPLE_RULES_MESSAGE,
  type ReviewerRule,
  eligibleReviewers,
  normalizeAccountId,
  parseConfig,
  parseConfigText,
  validateAgainstAuthor,
} from "../config.ts";

function expectParseError(input: unknown): string {
  try {
    parseConfig(input);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("expected parseConfig to throw, but it succeeded");
}

function rules(...entries: unknown[]): unknown {
  return { rules: entries };
}

describe("parseConfig - accepted configurations", () => {
  it('accepts a "random" rule', () => {
    const config = parseConfig(
      rules({ rule: "random", needApprovalCount: 2, reviewers: ["@alice", "@bob", "@carol"] }),
    );
    expect(config).toEqual({
      rules: [{ rule: "random", needApprovalCount: 2, reviewers: ["alice", "bob", "carol"] }],
    });
  });

  it('accepts an "all" rule', () => {
    const config = parseConfig(rules({ rule: "all", reviewers: ["@alice", "@bob"] }));
    expect(config).toEqual({ rules: [{ rule: "all", reviewers: ["alice", "bob"] }] });
  });

  it('accepts a "solo" rule', () => {
    const config = parseConfig(rules({ rule: "solo", reviewers: ["@ysknsid25"] }));
    expect(config).toEqual({ rules: [{ rule: "solo", reviewers: ["ysknsid25"] }] });
  });

  it("accepts account IDs with and without a leading @", () => {
    const config = parseConfig(rules({ rule: "all", reviewers: ["@alice", "bob"] }));
    expect(config.rules[0]?.reviewers).toEqual(["alice", "bob"]);
  });

  it("accepts hyphenated and numeric account IDs", () => {
    const config = parseConfig(rules({ rule: "all", reviewers: ["@a-b-c", "user123", "x"] }));
    expect(config.rules[0]?.reviewers).toEqual(["a-b-c", "user123", "x"]);
  });

  it("tolerates the $schema key used for editor completion", () => {
    const config = parseConfig({
      $schema: "https://example.com/schema.json",
      rules: [{ rule: "all", reviewers: ["@alice"] }],
    });
    expect(config.rules).toHaveLength(1);
  });

  it("de-duplicates reviewers case-insensitively, keeping the first spelling", () => {
    const config = parseConfig(rules({ rule: "all", reviewers: ["@Alice", "alice", "@bob"] }));
    expect(config.rules[0]?.reviewers).toEqual(["Alice", "bob"]);
  });
});

describe("parseConfig - rejected configurations", () => {
  it("rejects an unknown top-level key", () => {
    expect(expectParseError({ rules: [{ rule: "all", reviewers: ["@a"] }], extra: 1 })).toContain(
      "extra",
    );
  });

  it("rejects an unknown key inside a rule", () => {
    expect(expectParseError(rules({ rule: "all", reviewers: ["@a"], paths: ["src/"] }))).toContain(
      "paths",
    );
  });

  it('rejects "random" without needApprovalCount', () => {
    expect(expectParseError(rules({ rule: "random", reviewers: ["@a", "@b"] }))).toContain(
      "needApprovalCount",
    );
  });

  it('rejects "all" carrying a needApprovalCount', () => {
    const message = expectParseError(
      rules({ rule: "all", needApprovalCount: 2, reviewers: ["@a", "@b"] }),
    );
    expect(message).toContain("needApprovalCount");
  });

  it('rejects "solo" carrying a needApprovalCount', () => {
    const message = expectParseError(
      rules({ rule: "solo", needApprovalCount: 1, reviewers: ["@a"] }),
    );
    expect(message).toContain("needApprovalCount");
  });

  it("rejects a non-integer needApprovalCount", () => {
    expect(
      expectParseError(rules({ rule: "random", needApprovalCount: 1.5, reviewers: ["@a", "@b"] })),
    ).toContain("whole number");
  });

  it("rejects a needApprovalCount below 1", () => {
    expect(
      expectParseError(rules({ rule: "random", needApprovalCount: 0, reviewers: ["@a", "@b"] })),
    ).toContain("at least 1");
  });

  it("rejects an empty reviewers list", () => {
    expect(expectParseError(rules({ rule: "all", reviewers: [] }))).toContain(
      "at least one reviewer",
    );
  });

  it("rejects team handles, explaining why", () => {
    const message = expectParseError(rules({ rule: "all", reviewers: ["@org/team"] }));
    expect(message).toContain("@org/team");
    expect(message).toContain("not supported");
  });

  it("rejects an unknown rule kind", () => {
    expect(expectParseError(rules({ rule: "everyone", reviewers: ["@a"] }))).toContain("rule");
  });

  it("rejects a account ID with invalid characters", () => {
    expect(expectParseError(rules({ rule: "all", reviewers: ["ali ce"] }))).toContain("account ID");
  });

  it("rejects a account ID with surrounding whitespace", () => {
    expect(expectParseError(rules({ rule: "all", reviewers: [" alice"] }))).toContain("account ID");
  });

  it("rejects a account ID longer than 39 characters", () => {
    expect(expectParseError(rules({ rule: "all", reviewers: ["a".repeat(40)] }))).toContain(
      "account ID",
    );
  });

  it("rejects a non-object configuration", () => {
    expect(expectParseError("nope")).toContain("Invalid configuration");
  });

  it("reports every problem at once, each with its path", () => {
    const message = expectParseError({
      rules: [{ rule: "random", needApprovalCount: 0, reviewers: ["@org/team", "bad name"] }],
    });
    expect(message).toContain("rules.0.needApprovalCount");
    expect(message).toContain("rules.0.reviewers.0");
    expect(message).toContain("rules.0.reviewers.1");
    expect(message.split("\n").length).toBeGreaterThanOrEqual(4);
  });
});

describe("parseConfig - the exactly-one-rule constraint", () => {
  it("rejects an empty rules array", () => {
    expect(expectParseError({ rules: [] })).toContain(MULTIPLE_RULES_MESSAGE);
  });

  it("rejects two rules", () => {
    const message = expectParseError(
      rules({ rule: "all", reviewers: ["@a"] }, { rule: "solo", reviewers: ["@b"] }),
    );
    expect(message).toContain(MULTIPLE_RULES_MESSAGE);
  });

  it("explains why the array currently takes only one entry", () => {
    // Regression guard: seeing an array, users reasonably expect to write
    // several rules, so this must not decay into a bare length error.
    const message = expectParseError(
      rules({ rule: "all", reviewers: ["@a"] }, { rule: "all", reviewers: ["@b"] }),
    );
    expect(message).toContain("exactly one rule");
    expect(message).toContain("paths");
    expect(message).toContain("ambiguous");
    expect(message).toContain('"all", "random", or "solo"');
  });
});

describe("parseConfigText", () => {
  it("parses valid JSON text", () => {
    const config = parseConfigText('{"rules":[{"rule":"all","reviewers":["@alice"]}]}', "cfg.json");
    expect(config.rules[0]?.reviewers).toEqual(["alice"]);
  });

  it("names the file when the JSON is malformed", () => {
    expect(() => parseConfigText("{ not json", ".github/cfg.json")).toThrow(
      /\.github\/cfg\.json is not valid JSON/,
    );
  });
});

describe("normalizeAccountId", () => {
  it("strips a single leading @", () => {
    expect(normalizeAccountId("@alice")).toBe("alice");
  });

  it("leaves a bare account ID untouched", () => {
    expect(normalizeAccountId("alice")).toBe("alice");
  });
});

describe("eligibleReviewers", () => {
  const rule: ReviewerRule = { rule: "all", reviewers: ["alice", "bob", "carol"] };

  it("removes the pull request author", () => {
    expect(eligibleReviewers(rule, "bob")).toEqual(["alice", "carol"]);
  });

  it("compares the author case-insensitively", () => {
    expect(eligibleReviewers(rule, "BOB")).toEqual(["alice", "carol"]);
  });

  it("removes excluded accounts", () => {
    expect(eligibleReviewers(rule, "dave", new Set(["Carol"]))).toEqual(["alice", "bob"]);
  });

  it("preserves the order written in the configuration", () => {
    expect(eligibleReviewers(rule, "nobody")).toEqual(["alice", "bob", "carol"]);
  });
});

describe("validateAgainstAuthor", () => {
  function config(rule: ActionConfig["rules"][number]): ActionConfig {
    return { rules: [rule] };
  }

  it('passes when "random" has exactly enough eligible reviewers', () => {
    const cfg = config({ rule: "random", needApprovalCount: 2, reviewers: ["a", "b", "author"] });
    expect(() => validateAgainstAuthor(cfg, "author")).not.toThrow();
  });

  it('fails when the author drops "random" below needApprovalCount', () => {
    const cfg = config({ rule: "random", needApprovalCount: 2, reviewers: ["a", "author"] });
    expect(() => validateAgainstAuthor(cfg, "author")).toThrow(/needApprovalCount of 2/);
  });

  it("counts excluded accounts as unavailable", () => {
    const cfg = config({ rule: "random", needApprovalCount: 2, reviewers: ["a", "b", "c"] });
    expect(() => validateAgainstAuthor(cfg, "author", new Set(["b", "c"]))).toThrow(
      /needApprovalCount of 2/,
    );
  });

  it('fails when "all" has nobody left, and points at the solo rule', () => {
    const cfg = config({ rule: "all", reviewers: ["author"] });
    expect(() => validateAgainstAuthor(cfg, "author")).toThrow(/"rule": "solo"/);
  });

  it('passes for "all" when at least one reviewer remains', () => {
    const cfg = config({ rule: "all", reviewers: ["author", "a"] });
    expect(() => validateAgainstAuthor(cfg, "author")).not.toThrow();
  });

  it('allows "solo" to have nobody left — that is its whole point', () => {
    const cfg = config({ rule: "solo", reviewers: ["maintainer"] });
    expect(() => validateAgainstAuthor(cfg, "maintainer")).not.toThrow();
  });

  it('still assigns for "solo" when someone else opened the pull request', () => {
    const cfg = config({ rule: "solo", reviewers: ["maintainer"] });
    expect(() => validateAgainstAuthor(cfg, "contributor")).not.toThrow();
    const soloRule = cfg.rules[0];
    expect(soloRule).toBeDefined();
    expect(eligibleReviewers(soloRule as ReviewerRule, "contributor")).toEqual(["maintainer"]);
  });
});
