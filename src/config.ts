import * as v from "valibot";

const ACCOUNT_ID_PATTERN = /^@?[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;

const ACCOUNT_ID_MESSAGE =
  'must be a GitHub account ID such as "@alice" or "alice" ' +
  '(team handles like "@org/team" are not supported, because reviewers are ' +
  "requested individually)";

export const MULTIPLE_RULES_MESSAGE =
  '"rules" must contain exactly one rule in this version. It is an array ' +
  'because path-scoped rules are planned: a future "paths" field will let ' +
  "each rule target different files. Until then every rule would match every " +
  'pull request, which makes multiple rules ambiguous — "all" and "random" ' +
  "would contradict each other about how many approvals a pull request needs. " +
  'Pick a single rule: "all", "random", or "solo".';

const ReviewerAccountIdSchema = v.pipe(v.string(), v.regex(ACCOUNT_ID_PATTERN, ACCOUNT_ID_MESSAGE));

const ReviewersSchema = v.pipe(
  v.array(ReviewerAccountIdSchema),
  v.minLength(1, "must list at least one reviewer"),
  v.description(
    'GitHub account IDs eligible to review. A leading "@" is optional. The ' +
      "pull request author is always removed from this list before assignment.",
  ),
);

const NeedApprovalCountSchema = v.pipe(
  v.number(),
  v.integer("must be a whole number"),
  v.minValue(1, "must be at least 1"),
  v.description(
    "How many human approvals this pull request needs, excluding CodeRabbit. " +
      "That many reviewers are picked at random from `reviewers`.",
  ),
);

const RuleSchema = v.variant("rule", [
  v.pipe(
    v.strictObject({
      rule: v.literal("all"),
      reviewers: ReviewersSchema,
    }),
    v.description("Assign every reviewer in the list."),
  ),
  v.pipe(
    v.strictObject({
      rule: v.literal("random"),
      needApprovalCount: NeedApprovalCountSchema,
      reviewers: ReviewersSchema,
    }),
    v.description("Assign `needApprovalCount` reviewers picked at random from the list."),
  ),
  v.pipe(
    v.strictObject({
      rule: v.literal("solo"),
      reviewers: ReviewersSchema,
    }),
    v.description(
      "For repositories with a single maintainer. Assigns the maintainer on " +
        "other people's pull requests, and does nothing on the maintainer's own " +
        "— having nobody left to assign is expected here, not an error.",
    ),
  ),
]);

export const ConfigSchema = v.strictObject({
  $schema: v.optional(v.string()),
  rules: v.pipe(
    v.array(RuleSchema),
    v.length(1, MULTIPLE_RULES_MESSAGE),
    v.description(MULTIPLE_RULES_MESSAGE),
  ),
});

export type ReviewerRule =
  | { rule: "all"; reviewers: string[] }
  | { rule: "random"; needApprovalCount: number; reviewers: string[] }
  | { rule: "solo"; reviewers: string[] };

export interface ActionConfig {
  rules: ReviewerRule[];
}

export function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("@") ? accountId.slice(1) : accountId;
}

function normalizeReviewers(reviewers: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of reviewers) {
    const accountId = normalizeAccountId(raw);
    const key = accountId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(accountId);
  }
  return result;
}

function formatIssues(issues: readonly v.BaseIssue<unknown>[]): string {
  const lines = issues.map((issue) => {
    const path = v.getDotPath(issue);
    return path ? `  ${path}: ${issue.message}` : `  ${issue.message}`;
  });
  return [...new Set(lines)].join("\n");
}

export function parseConfig(input: unknown): ActionConfig {
  const result = v.safeParse(ConfigSchema, input);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${formatIssues(result.issues)}`);
  }

  const rules = result.output.rules.map(
    (rule): ReviewerRule => ({
      ...rule,
      reviewers: normalizeReviewers(rule.reviewers),
    }),
  );

  return { rules };
}

export function parseConfigText(text: string, filePath: string): ActionConfig {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${filePath} is not valid JSON: ${message}`);
  }
  return parseConfig(json);
}

export function eligibleReviewers(
  rule: ReviewerRule,
  prAuthor: string,
  excludeAccountIds: ReadonlySet<string> = new Set(),
): string[] {
  const author = prAuthor.toLowerCase();
  const excluded = new Set([...excludeAccountIds].map((accountId) => accountId.toLowerCase()));
  return rule.reviewers.filter((accountId) => {
    const key = accountId.toLowerCase();
    return key !== author && !excluded.has(key);
  });
}

export function validateAgainstAuthor(
  config: ActionConfig,
  prAuthor: string,
  excludeAccountIds: ReadonlySet<string> = new Set(),
): void {
  const problems: string[] = [];

  config.rules.forEach((rule, index) => {
    const eligible = eligibleReviewers(rule, prAuthor, excludeAccountIds);
    const context =
      `rule ${index} ("${rule.rule}") lists ${rule.reviewers.length} reviewer(s), ` +
      `but only ${eligible.length} can be assigned to this pull request ` +
      `(the author "${prAuthor}" and any excluded accounts are removed)`;

    if (rule.rule === "random" && eligible.length < rule.needApprovalCount) {
      problems.push(
        `${context}, which is fewer than the needApprovalCount of ${rule.needApprovalCount}. ` +
          "Add more reviewers, or lower needApprovalCount.",
      );
      return;
    }

    if (rule.rule === "all" && eligible.length === 0) {
      problems.push(
        `${context}, leaving nobody to assign. If this repository is maintained by ` +
          'a single person, use `"rule": "solo"` instead: it assigns the maintainer ' +
          "on everyone else's pull requests and does nothing on their own.",
      );
    }
  });

  if (problems.length > 0) {
    throw new Error(
      `Configuration cannot be applied to this pull request:\n${problems.join("\n")}`,
    );
  }
}
