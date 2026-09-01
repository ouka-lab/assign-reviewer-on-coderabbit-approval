import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Env } from "../env.ts";
import { type Logger, run } from "../run.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const VALID_CODERABBIT = "reviews:\n  request_changes_workflow: true\n";
const SOLO_CONFIG = JSON.stringify({ rules: [{ rule: "solo", reviewers: ["@maintainer"] }] });
const ALL_CONFIG = JSON.stringify({ rules: [{ rule: "all", reviewers: ["@alice", "@bob"] }] });

async function workspace(files: Record<string, string>): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "run-"));
  dirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    await Bun.write(join(dir, name), contents);
  }
  return dir;
}

async function defaultWorkspace(config = ALL_CONFIG): Promise<string> {
  return await workspace({
    ".coderabbit.yaml": VALID_CODERABBIT,
    ".github/assign-reviewer-on-coderabbit-approval.json": config,
  });
}

function env(workspaceDir: string, overrides: Partial<Env> = {}): Env {
  return {
    INPUT_GITHUB_TOKEN: "t0ken",
    INPUT_REPOSITORY: "ouka-lab/demo",
    INPUT_PR_NUMBER: "7",
    INPUT_PR_AUTHOR: "contributor",
    EVENT_REVIEW_STATE: "approved",
    EVENT_REVIEW_AUTHOR: "coderabbitai[bot]",
    GITHUB_WORKSPACE: workspaceDir,
    ...overrides,
  };
}

interface Api {
  requested?: string[];
  reviews?: { accountId: string; state: string }[];
}

function stubApi({ requested = [], reviews = [] }: Api = {}) {
  const posts: { url: string; reviewers: string[] }[] = [];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (init?.method === "POST") {
      posts.push({ url: href, reviewers: JSON.parse(String(init.body)).reviewers });
      return new Response("{}", { status: 201 });
    }
    if (href.includes("/requested_reviewers")) {
      return Response.json({ users: requested.map((login) => ({ login })) });
    }
    return Response.json(reviews.map((r) => ({ user: { login: r.accountId }, state: r.state })));
  }) as unknown as typeof fetch;

  return { fetcher, posts };
}

function silentLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return { messages, log: (m) => messages.push(m), warn: (m) => messages.push(m) };
}

describe("run - trigger", () => {
  it.each([
    ["changes_requested", "not-approved"],
    ["commented", "not-approved"],
    ["", "not-approved"],
  ] as const)('skips when the review state is "%s"', async (state, reason) => {
    const result = await run({ EVENT_REVIEW_STATE: state }, { logger: silentLogger() });
    expect(result.skipped).toBe(reason);
  });

  it("skips an approval from anyone but CodeRabbit", async () => {
    const result = await run(
      { EVENT_REVIEW_STATE: "approved", EVENT_REVIEW_AUTHOR: "alice" },
      { logger: silentLogger() },
    );
    expect(result.skipped).toBe("not-coderabbit-approval");
  });

  it("accepts the uppercase state the REST API returns", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi();
    const result = await run(env(dir, { EVENT_REVIEW_STATE: "APPROVED" }), {
      fetcher,
      logger: silentLogger(),
    });
    expect(result.skipped).toBeUndefined();
    expect(posts).toHaveLength(1);
  });

  it("skips before requiring any input, so an unrelated review costs nothing", async () => {
    const result = await run({ EVENT_REVIEW_STATE: "commented" }, { logger: silentLogger() });
    expect(result.assigned).toEqual([]);
  });
});

describe("run - assignment", () => {
  it("assigns every reviewer for an all rule", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi();

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.assigned).toEqual(["alice", "bob"]);
    expect(posts[0]?.reviewers).toEqual(["alice", "bob"]);
  });

  it("assigns the maintainer on an outsider's pull request under a solo rule", async () => {
    const dir = await defaultWorkspace(SOLO_CONFIG);
    const { fetcher, posts } = stubApi();

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.assigned).toEqual(["maintainer"]);
    expect(posts).toHaveLength(1);
  });

  it("assigns nobody on the maintainer's own pull request under a solo rule", async () => {
    const dir = await defaultWorkspace(SOLO_CONFIG);
    const { fetcher, posts } = stubApi();

    const result = await run(env(dir, { INPUT_PR_AUTHOR: "maintainer" }), {
      fetcher,
      logger: silentLogger(),
    });

    expect(result.skipped).toBe("nobody-to-assign");
    expect(posts).toHaveLength(0);
  });

  it("picks needApprovalCount reviewers for a random rule", async () => {
    const dir = await defaultWorkspace(
      JSON.stringify({
        rules: [{ rule: "random", needApprovalCount: 2, reviewers: ["@a", "@b", "@c", "@d"] }],
      }),
    );
    const { fetcher, posts } = stubApi();

    const result = await run(env(dir), { fetcher, rng: () => 0, logger: silentLogger() });

    expect(result.assigned).toEqual(["a", "b"]);
    expect(posts[0]?.reviewers).toEqual(["a", "b"]);
  });

  it("never assigns the pull request author", async () => {
    const dir = await defaultWorkspace();
    const { fetcher } = stubApi();

    const result = await run(env(dir, { INPUT_PR_AUTHOR: "alice" }), {
      fetcher,
      logger: silentLogger(),
    });

    expect(result.assigned).toEqual(["bob"]);
  });

  it("makes no request in dry-run mode", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi();

    const result = await run(env(dir, { INPUT_DRY_RUN: "true" }), {
      fetcher,
      logger: silentLogger(),
    });

    expect(result.assigned).toEqual(["alice", "bob"]);
    expect(posts).toHaveLength(0);
  });
});

describe("run - the already-involved gate", () => {
  it("does nothing when a human is already a requested reviewer", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi({ requested: ["carol"] });

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.skipped).toBe("already-involved");
    expect(posts).toHaveLength(0);
  });

  it("does nothing when a human already submitted a review", async () => {
    // Approving removes a reviewer from requested_reviewers, so without this
    // the next CodeRabbit approval would assign a second round of reviewers.
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi({
      reviews: [{ accountId: "carol", state: "APPROVED" }],
    });

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.skipped).toBe("already-involved");
    expect(posts).toHaveLength(0);
  });

  it("ignores CodeRabbit's own review", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi({
      reviews: [{ accountId: "coderabbitai[bot]", state: "APPROVED" }],
    });

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.assigned).toEqual(["alice", "bob"]);
    expect(posts).toHaveLength(1);
  });

  it("ignores other bots", async () => {
    const dir = await defaultWorkspace();
    const { fetcher } = stubApi({ requested: ["renovate[bot]"] });

    const result = await run(env(dir), { fetcher, logger: silentLogger() });

    expect(result.assigned).toEqual(["alice", "bob"]);
  });

  it("ignores an excluded account", async () => {
    const dir = await defaultWorkspace();
    const { fetcher } = stubApi({ requested: ["helper"] });

    const result = await run(env(dir, { INPUT_EXCLUDE_AUTHORS: "helper" }), {
      fetcher,
      logger: silentLogger(),
    });

    expect(result.assigned).toEqual(["alice", "bob"]);
  });

  it("ignores the author's own review of their pull request", async () => {
    const dir = await defaultWorkspace();
    const { fetcher, posts } = stubApi({
      reviews: [{ accountId: "contributor", state: "COMMENTED" }],
    });

    await run(env(dir), { fetcher, logger: silentLogger() });

    expect(posts).toHaveLength(1);
  });
});

describe("run - validation", () => {
  it("fails when request_changes_workflow is not enabled", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: false\n",
      ".github/assign-reviewer-on-coderabbit-approval.json": ALL_CONFIG,
    });
    const { fetcher } = stubApi();

    await expect(run(env(dir), { fetcher, logger: silentLogger() })).rejects.toThrow(
      /request_changes_workflow/,
    );
  });

  it("fails when the configuration file is missing", async () => {
    const dir = await workspace({ ".coderabbit.yaml": VALID_CODERABBIT });
    const { fetcher } = stubApi();

    await expect(run(env(dir), { fetcher, logger: silentLogger() })).rejects.toThrow(
      /Configuration file not found/,
    );
  });

  it("fails when the configuration is invalid", async () => {
    const dir = await defaultWorkspace(JSON.stringify({ rules: [{ rule: "nope" }] }));
    const { fetcher } = stubApi();

    await expect(run(env(dir), { fetcher, logger: silentLogger() })).rejects.toThrow(
      /Invalid configuration/,
    );
  });

  it("reports a configuration that cannot cover this author", async () => {
    const dir = await defaultWorkspace(
      JSON.stringify({ rules: [{ rule: "all", reviewers: ["@alice"] }] }),
    );
    const { fetcher } = stubApi();

    expect(
      run(env(dir, { INPUT_PR_AUTHOR: "alice" }), { fetcher, logger: silentLogger() }),
    ).rejects.toThrow(/"rule": "solo"/);
  });

  it("validates before the already-involved gate, so misconfiguration cannot hide", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: false\n",
      ".github/assign-reviewer-on-coderabbit-approval.json": ALL_CONFIG,
    });
    const { fetcher } = stubApi({ requested: ["carol"] });

    await expect(run(env(dir), { fetcher, logger: silentLogger() })).rejects.toThrow(
      /request_changes_workflow/,
    );
  });
});

describe("run - outputs", () => {
  it("writes the assigned reviewers and an empty skip reason", async () => {
    const dir = await defaultWorkspace();
    const outputPath = join(dir, "gh-output");
    const { fetcher } = stubApi();

    await run(env(dir, { GITHUB_OUTPUT: outputPath }), { fetcher, logger: silentLogger() });

    const written = await Bun.file(outputPath).text();
    expect(written).toContain("assigned-reviewers<<");
    expect(written).toContain("alice,bob");
    expect(written).toContain("skipped-reason<<");
  });

  it("writes the skip reason when it skips", async () => {
    const dir = await defaultWorkspace();
    const outputPath = join(dir, "gh-output");
    const { fetcher } = stubApi({ requested: ["carol"] });

    await run(env(dir, { GITHUB_OUTPUT: outputPath }), { fetcher, logger: silentLogger() });

    expect(await Bun.file(outputPath).text()).toContain("already-involved");
  });
});

describe("run - avoiding needless API calls", () => {
  it("makes no request at all when the rule assigns nobody", async () => {
    // The common case for a solo maintainer: every one of their own pull
    // requests would otherwise cost two API calls to learn nothing.
    const dir = await defaultWorkspace(SOLO_CONFIG);
    let requests = 0;
    const fetcher = (async () => {
      requests += 1;
      return Response.json({ users: [] });
    }) as unknown as typeof fetch;

    const result = await run(env(dir, { INPUT_PR_AUTHOR: "maintainer" }), {
      fetcher,
      logger: silentLogger(),
    });

    expect(result.skipped).toBe("nobody-to-assign");
    expect(requests).toBe(0);
  });
});
