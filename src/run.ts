import { resolve } from "node:path";
import { verifyRequestChangesWorkflow } from "./coderabbit.ts";
import { parseConfigText, validateAgainstAuthor } from "./config.ts";
import { type ActionInputs, type Env, coderabbitAccountIdOf, parseInputs } from "./env.ts";
import { getRequestedReviewers, listSubmittedReviews, requestReviewers } from "./github.ts";
import { setOutput } from "./outputs.ts";
import { resolveRule, selectAssignees } from "./select.ts";

export type SkipReason =
  | "not-approved"
  | "not-coderabbit-approval"
  | "already-involved"
  | "nobody-to-assign";

export interface Logger {
  log: (message: string) => void;
  warn: (message: string) => void;
}

export interface RunDeps {
  fetcher?: typeof fetch;
  rng?: () => number;
  logger?: Logger;
}

export interface RunResult {
  assigned: string[];
  skipped?: SkipReason;
}

function triggerSkipReason(env: Env): SkipReason | undefined {
  if ((env.EVENT_REVIEW_STATE ?? "").toLowerCase() !== "approved") {
    return "not-approved";
  }
  const author = (env.EVENT_REVIEW_AUTHOR ?? "").toLowerCase();
  if (author !== coderabbitAccountIdOf(env).toLowerCase()) {
    return "not-coderabbit-approval";
  }
  return undefined;
}

function isHuman(accountId: string, excludeAccountIds: ReadonlySet<string>): boolean {
  const key = accountId.toLowerCase();
  return !excludeAccountIds.has(key) && !key.endsWith("[bot]");
}

async function readConfig(inputs: ActionInputs) {
  const path = resolve(inputs.workspace, inputs.configFile);
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(
      `Configuration file not found: ${path}. Create it, or point \`config-file\` at ` +
        "your own path. Also make sure `actions/checkout` runs before this action.",
    );
  }
  return parseConfigText(await file.text(), path);
}

// A human already being on the pull request is what makes re-running harmless:
// CodeRabbit approves again after every new commit, and without this check each
// approval would pile on more reviewers.
async function humanAlreadyInvolved(
  inputs: ActionInputs,
  fetcher: typeof fetch | undefined,
): Promise<boolean> {
  const context = {
    token: inputs.token,
    owner: inputs.owner,
    repo: inputs.repo,
    ...(fetcher ? { fetcher } : {}),
  };

  const requested = await getRequestedReviewers(context, inputs.prNumber);
  if (requested.some((accountId) => isHuman(accountId, inputs.excludeAccountIds))) {
    return true;
  }

  // Approving removes someone from requested_reviewers, so a submitted review
  // is the only remaining trace that a human was already asked.
  const author = inputs.prAuthor.toLowerCase();
  const reviews = await listSubmittedReviews(context, inputs.prNumber);
  return reviews.some(
    (review) =>
      isHuman(review.accountId, inputs.excludeAccountIds) &&
      review.accountId.toLowerCase() !== author,
  );
}

export async function run(env: Env, deps: RunDeps = {}): Promise<RunResult> {
  const logger = deps.logger ?? console;

  const triggerSkip = triggerSkipReason(env);
  if (triggerSkip) {
    logger.log(
      triggerSkip === "not-approved"
        ? `Review state is "${env.EVENT_REVIEW_STATE ?? ""}", not an approval. Nothing to do.`
        : `Approval came from "${env.EVENT_REVIEW_AUTHOR ?? ""}", not CodeRabbit. Nothing to do.`,
    );
    return await finish(env.GITHUB_OUTPUT, [], triggerSkip);
  }

  const inputs = parseInputs(env);

  // Validation runs before the skip gate on purpose: a broken configuration
  // must surface even on pull requests this action would not act on.
  const coderabbitConfigPath = await verifyRequestChangesWorkflow(
    inputs.workspace,
    inputs.coderabbitConfigFile,
  );
  logger.log(`Verified request_changes_workflow in ${coderabbitConfigPath}`);

  const config = await readConfig(inputs);
  validateAgainstAuthor(config, inputs.prAuthor, inputs.excludeAccountIds);

  const rule = resolveRule(config.rules);
  const assignees = selectAssignees(rule, {
    prAuthor: inputs.prAuthor,
    excludeAccountIds: inputs.excludeAccountIds,
    ...(deps.rng ? { rng: deps.rng } : {}),
  });

  // Decided before the gate below so that a run which would assign nobody —
  // a solo maintainer opening their own pull request, every run — costs no
  // API calls at all.
  if (assignees.length === 0) {
    logger.log(
      `Rule "${rule.rule}" leaves nobody to assign for a pull request by "${inputs.prAuthor}".`,
    );
    return await finish(inputs.outputFile, [], "nobody-to-assign");
  }

  if (await humanAlreadyInvolved(inputs, deps.fetcher)) {
    logger.log("A human reviewer is already involved in this pull request. Nothing to do.");
    return await finish(inputs.outputFile, [], "already-involved");
  }

  if (inputs.dryRun) {
    logger.log(`[dry-run] Would assign: ${assignees.join(", ")}`);
    return await finish(inputs.outputFile, assignees);
  }

  await requestReviewers(
    {
      token: inputs.token,
      owner: inputs.owner,
      repo: inputs.repo,
      ...(deps.fetcher ? { fetcher: deps.fetcher } : {}),
    },
    inputs.prNumber,
    assignees,
  );
  logger.log(`Assigned reviewers: ${assignees.join(", ")}`);
  return await finish(inputs.outputFile, assignees);
}

async function finish(
  outputFile: string | undefined,
  assigned: string[],
  skipped?: SkipReason,
): Promise<RunResult> {
  await setOutput("assigned-reviewers", assigned.join(","), outputFile);
  await setOutput("skipped-reason", skipped ?? "", outputFile);
  return skipped ? { assigned, skipped } : { assigned };
}
