export interface Env {
  INPUT_GITHUB_TOKEN?: string | undefined;
  INPUT_CONFIG_FILE?: string | undefined;
  INPUT_CODERABBIT_CONFIG_FILE?: string | undefined;
  INPUT_CODERABBIT_ACCOUNT_ID?: string | undefined;
  INPUT_EXCLUDE_AUTHORS?: string | undefined;
  INPUT_PR_NUMBER?: string | undefined;
  INPUT_PR_AUTHOR?: string | undefined;
  INPUT_REPOSITORY?: string | undefined;
  INPUT_DRY_RUN?: string | undefined;
  EVENT_REVIEW_STATE?: string | undefined;
  EVENT_REVIEW_AUTHOR?: string | undefined;
  GITHUB_WORKSPACE?: string | undefined;
  GITHUB_OUTPUT?: string | undefined;
}

export const DEFAULT_CONFIG_FILE = ".github/assign-reviewer-on-coderabbit-approval.json";
export const DEFAULT_CODERABBIT_ACCOUNT_ID = "coderabbitai[bot]";

export interface ActionInputs {
  token: string;
  configFile: string;
  coderabbitConfigFile: string | undefined;
  coderabbitAccountId: string;
  excludeAccountIds: Set<string>;
  prNumber: number;
  prAuthor: string;
  owner: string;
  repo: string;
  dryRun: boolean;
  workspace: string;
  outputFile: string | undefined;
}

function trimmed(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

export function coderabbitAccountIdOf(env: Env): string {
  return trimmed(env.INPUT_CODERABBIT_ACCOUNT_ID) ?? DEFAULT_CODERABBIT_ACCOUNT_ID;
}

export function parseInputs(env: Env): ActionInputs {
  const token = trimmed(env.INPUT_GITHUB_TOKEN);
  if (!token) {
    throw new Error("`github-token` is required");
  }

  const repository = trimmed(env.INPUT_REPOSITORY);
  if (!repository) {
    throw new Error("`repository` is required");
  }
  const [owner, repo] = repository.split("/");
  if (!owner || !repo || repository.split("/").length !== 2) {
    throw new Error(`\`repository\` must be in "owner/repo" format, got: "${repository}"`);
  }

  const rawPrNumber = trimmed(env.INPUT_PR_NUMBER);
  const prNumber = Number(rawPrNumber);
  if (!rawPrNumber || !Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`\`pr-number\` must be a positive integer, got: "${rawPrNumber ?? ""}"`);
  }

  const prAuthor = trimmed(env.INPUT_PR_AUTHOR);
  if (!prAuthor) {
    throw new Error("`pr-author` is required");
  }

  const coderabbitAccountId = coderabbitAccountIdOf(env);

  const excludeAccountIds = new Set<string>([coderabbitAccountId.toLowerCase()]);
  for (const entry of (env.INPUT_EXCLUDE_AUTHORS ?? "").split(",")) {
    const account = entry.trim();
    if (account) {
      excludeAccountIds.add(account.replace(/^@/, "").toLowerCase());
    }
  }

  return {
    token,
    configFile: trimmed(env.INPUT_CONFIG_FILE) ?? DEFAULT_CONFIG_FILE,
    coderabbitConfigFile: trimmed(env.INPUT_CODERABBIT_CONFIG_FILE),
    coderabbitAccountId,
    excludeAccountIds,
    prNumber,
    prAuthor,
    owner,
    repo,
    dryRun: trimmed(env.INPUT_DRY_RUN)?.toLowerCase() === "true",
    workspace: trimmed(env.GITHUB_WORKSPACE) ?? process.cwd(),
    outputFile: trimmed(env.GITHUB_OUTPUT),
  };
}
