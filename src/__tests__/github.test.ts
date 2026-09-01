import { describe, expect, it } from "bun:test";
import {
  type GitHubContext,
  getRequestedReviewers,
  listSubmittedReviews,
  requestReviewers,
} from "../github.ts";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stub(responses: Response[]): { context: GitHubContext; calls: Call[] } {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return queue.shift() ?? jsonResponse([]);
  }) as unknown as typeof fetch;

  return {
    context: { token: "t0ken", owner: "ouka-lab", repo: "demo", fetcher },
    calls,
  };
}

function headerOf(call: Call | undefined, name: string): string | undefined {
  return (call?.init?.headers as Record<string, string> | undefined)?.[name];
}

describe("getRequestedReviewers", () => {
  it("returns account IDs, translating the wire field", async () => {
    const { context } = stub([jsonResponse({ users: [{ login: "alice" }, { login: "bob" }] })]);
    expect(await getRequestedReviewers(context, 7)).toEqual(["alice", "bob"]);
  });

  it("calls the pull request's requested_reviewers endpoint", async () => {
    const { context, calls } = stub([jsonResponse({ users: [] })]);
    await getRequestedReviewers(context, 7);
    expect(calls[0]?.url).toBe(
      "https://api.github.com/repos/ouka-lab/demo/pulls/7/requested_reviewers",
    );
  });

  it("authenticates and pins the API version", async () => {
    const { context, calls } = stub([jsonResponse({ users: [] })]);
    await getRequestedReviewers(context, 7);
    expect(headerOf(calls[0], "Authorization")).toBe("Bearer t0ken");
    expect(headerOf(calls[0], "X-GitHub-Api-Version")).toBe("2022-11-28");
  });

  it("treats a missing users field as nobody requested", async () => {
    const { context } = stub([jsonResponse({})]);
    expect(await getRequestedReviewers(context, 7)).toEqual([]);
  });

  it("surfaces the response body when the request fails", async () => {
    const { context } = stub([new Response("Not Found", { status: 404, statusText: "Not Found" })]);
    await expect(getRequestedReviewers(context, 7)).rejects.toThrow(/404.*Not Found/s);
  });
});

describe("listSubmittedReviews", () => {
  it("returns each review's author and state", async () => {
    const { context } = stub([
      jsonResponse([
        { user: { login: "coderabbitai[bot]" }, state: "APPROVED" },
        { user: { login: "alice" }, state: "COMMENTED" },
      ]),
    ]);
    expect(await listSubmittedReviews(context, 7)).toEqual([
      { accountId: "coderabbitai[bot]", state: "APPROVED" },
      { accountId: "alice", state: "COMMENTED" },
    ]);
  });

  it("skips reviews whose author no longer exists", async () => {
    const { context } = stub([
      jsonResponse([
        { user: null, state: "APPROVED" },
        { user: { login: "alice" }, state: "APPROVED" },
      ]),
    ]);
    expect(await listSubmittedReviews(context, 7)).toEqual([
      { accountId: "alice", state: "APPROVED" },
    ]);
  });

  it("stops after a short page", async () => {
    const { context, calls } = stub([
      jsonResponse([{ user: { login: "alice" }, state: "APPROVED" }]),
    ]);
    await listSubmittedReviews(context, 7);
    expect(calls).toHaveLength(1);
  });

  it("follows pagination until a short page arrives", async () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      user: { login: `user${index}` },
      state: "COMMENTED",
    }));
    const { context, calls } = stub([
      jsonResponse(full),
      jsonResponse([{ user: { login: "last" }, state: "APPROVED" }]),
    ]);

    const reviews = await listSubmittedReviews(context, 7);
    expect(reviews).toHaveLength(101);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain("page=1");
    expect(calls[1]?.url).toContain("page=2");
    expect(calls[0]?.url).toContain("per_page=100");
  });

  it("surfaces a failed page", async () => {
    const { context } = stub([new Response("boom", { status: 500, statusText: "Server Error" })]);
    await expect(listSubmittedReviews(context, 7)).rejects.toThrow(/Failed to fetch reviews: 500/);
  });
});

describe("requestReviewers", () => {
  it("posts the account IDs", async () => {
    const { context, calls } = stub([jsonResponse({}, 201)]);
    await requestReviewers(context, 7, ["alice", "bob"]);

    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.url).toBe(
      "https://api.github.com/repos/ouka-lab/demo/pulls/7/requested_reviewers",
    );
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ reviewers: ["alice", "bob"] });
  });

  it("makes no request when there is nobody to assign", async () => {
    const { context, calls } = stub([]);
    await requestReviewers(context, 7, []);
    expect(calls).toHaveLength(0);
  });

  it("surfaces the response body when assignment fails", async () => {
    const { context } = stub([
      new Response('{"message":"Reviews may only be requested from collaborators"}', {
        status: 422,
        statusText: "Unprocessable Entity",
      }),
    ]);
    await expect(requestReviewers(context, 7, ["stranger"])).rejects.toThrow(/collaborators/);
  });
});

describe("resilience", () => {
  it("still reports the status when the body cannot be read", async () => {
    const unreadable = {
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: () => Promise.reject(new Error("stream closed")),
    } as unknown as Response;
    const { context } = stub([unreadable]);

    await expect(getRequestedReviewers(context, 7)).rejects.toThrow(/503 Service Unavailable/);
  });

  it("stops paginating instead of looping forever on a server that never ends", async () => {
    const full = Array.from({ length: 100 }, (_, index) => ({
      user: { login: `user${index}` },
      state: "COMMENTED",
    }));
    let requests = 0;
    const fetcher = (async () => {
      requests += 1;
      return jsonResponse(full);
    }) as unknown as typeof fetch;

    const reviews = await listSubmittedReviews({ token: "t", owner: "o", repo: "r", fetcher }, 1);
    expect(requests).toBe(100);
    expect(reviews).toHaveLength(10000);
  });
});

describe("baseUrl", () => {
  it("supports GitHub Enterprise hosts", async () => {
    const calls: Call[] = [];
    const fetcher = (async (url: string | URL | Request) => {
      calls.push({ url: String(url), init: undefined });
      return jsonResponse({ users: [] });
    }) as unknown as typeof fetch;

    await getRequestedReviewers(
      { token: "t", owner: "o", repo: "r", baseUrl: "https://ghe.example.com/api/v3", fetcher },
      1,
    );
    expect(calls[0]?.url).toBe(
      "https://ghe.example.com/api/v3/repos/o/r/pulls/1/requested_reviewers",
    );
  });
});
