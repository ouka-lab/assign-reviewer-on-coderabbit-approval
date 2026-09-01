const DEFAULT_BASE_URL = "https://api.github.com";
const PER_PAGE = 100;
const MAX_PAGES = 100;

export interface GitHubContext {
  token: string;
  owner: string;
  repo: string;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export interface SubmittedReview {
  accountId: string;
  state: string;
}

interface RequestedReviewersPayload {
  users?: { login: string }[] | null;
}

interface ReviewPayload {
  user?: { login: string } | null;
  state?: string | null;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function pullUrl(context: GitHubContext, prNumber: number, suffix: string): string {
  const base = context.baseUrl ?? DEFAULT_BASE_URL;
  return `${base}/repos/${context.owner}/${context.repo}/pulls/${prNumber}${suffix}`;
}

async function failure(response: Response, action: string): Promise<Error> {
  const body = await response.text().catch(() => "");
  const detail = body ? `: ${body}` : "";
  return new Error(`Failed to ${action}: ${response.status} ${response.statusText}${detail}`);
}

export async function getRequestedReviewers(
  context: GitHubContext,
  prNumber: number,
): Promise<string[]> {
  const fetcher = context.fetcher ?? fetch;
  const response = await fetcher(pullUrl(context, prNumber, "/requested_reviewers"), {
    headers: headers(context.token),
  });

  if (!response.ok) {
    throw await failure(response, "fetch requested reviewers");
  }

  const payload = (await response.json()) as RequestedReviewersPayload;
  return (payload.users ?? []).map((user) => user.login);
}

export async function listSubmittedReviews(
  context: GitHubContext,
  prNumber: number,
): Promise<SubmittedReview[]> {
  const fetcher = context.fetcher ?? fetch;
  const reviews: SubmittedReview[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = pullUrl(context, prNumber, `/reviews?per_page=${PER_PAGE}&page=${page}`);
    const response = await fetcher(url, {
      headers: headers(context.token),
    });

    if (!response.ok) {
      throw await failure(response, "fetch reviews");
    }

    const payload = (await response.json()) as ReviewPayload[];
    for (const review of payload) {
      const accountId = review.user?.login;
      if (accountId) {
        reviews.push({ accountId, state: review.state ?? "" });
      }
    }

    if (payload.length < PER_PAGE) {
      return reviews;
    }
  }

  return reviews;
}

export async function requestReviewers(
  context: GitHubContext,
  prNumber: number,
  accountIds: string[],
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }

  const fetcher = context.fetcher ?? fetch;
  const response = await fetcher(pullUrl(context, prNumber, "/requested_reviewers"), {
    method: "POST",
    headers: {
      ...headers(context.token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reviewers: accountIds }),
  });

  if (!response.ok) {
    throw await failure(response, "request reviewers");
  }
}
