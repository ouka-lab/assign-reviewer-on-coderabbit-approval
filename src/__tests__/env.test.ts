import { describe, expect, it } from "bun:test";
import { type Env, DEFAULT_CONFIG_FILE, coderabbitAccountIdOf, parseInputs } from "../env.ts";

function env(overrides: Partial<Env> = {}): Env {
  return {
    INPUT_GITHUB_TOKEN: "t0ken",
    INPUT_REPOSITORY: "ouka-lab/demo",
    INPUT_PR_NUMBER: "7",
    INPUT_PR_AUTHOR: "alice",
    ...overrides,
  };
}

describe("parseInputs", () => {
  it("splits the repository into owner and repo", () => {
    const inputs = parseInputs(env());
    expect(inputs.owner).toBe("ouka-lab");
    expect(inputs.repo).toBe("demo");
  });

  it("defaults the configuration file path", () => {
    expect(parseInputs(env()).configFile).toBe(DEFAULT_CONFIG_FILE);
  });

  it("always excludes CodeRabbit, whose approval is the trigger", () => {
    expect(parseInputs(env()).excludeAccountIds).toContain("coderabbitai[bot]");
  });

  it("adds exclude-authors, normalizing @ and case", () => {
    const inputs = parseInputs(env({ INPUT_EXCLUDE_AUTHORS: "@Renovate[bot], dependabot[bot] " }));
    expect(inputs.excludeAccountIds).toContain("renovate[bot]");
    expect(inputs.excludeAccountIds).toContain("dependabot[bot]");
  });

  it("treats dry-run as a case-insensitive boolean", () => {
    expect(parseInputs(env({ INPUT_DRY_RUN: "TRUE" })).dryRun).toBe(true);
    expect(parseInputs(env({ INPUT_DRY_RUN: "false" })).dryRun).toBe(false);
    expect(parseInputs(env()).dryRun).toBe(false);
  });

  it.each([
    ["INPUT_GITHUB_TOKEN", /github-token/],
    ["INPUT_REPOSITORY", /repository/],
    ["INPUT_PR_AUTHOR", /pr-author/],
  ] as const)("rejects a missing %s", (key, expected) => {
    expect(() => parseInputs(env({ [key]: undefined }))).toThrow(expected);
  });

  it.each(["owner", "a/b/c", ""])('rejects the repository "%s"', (repository) => {
    expect(() => parseInputs(env({ INPUT_REPOSITORY: repository }))).toThrow(/repository/);
  });

  it.each(["0", "-1", "abc", "1.5", ""])('rejects the pr-number "%s"', (value) => {
    expect(() => parseInputs(env({ INPUT_PR_NUMBER: value }))).toThrow(/pr-number/);
  });

  it("treats whitespace-only values as absent", () => {
    expect(() => parseInputs(env({ INPUT_GITHUB_TOKEN: "   " }))).toThrow(/github-token/);
  });
});

describe("coderabbitAccountIdOf", () => {
  it("defaults to the CodeRabbit app account", () => {
    expect(coderabbitAccountIdOf({})).toBe("coderabbitai[bot]");
  });

  it("honours an override", () => {
    expect(coderabbitAccountIdOf({ INPUT_CODERABBIT_ACCOUNT_ID: "my-bot" })).toBe("my-bot");
  });
});
