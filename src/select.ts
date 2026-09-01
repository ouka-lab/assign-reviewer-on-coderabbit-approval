import { type ReviewerRule, eligibleReviewers } from "./config.ts";

export interface SelectionOptions {
  prAuthor: string;
  excludeAccountIds?: ReadonlySet<string>;
  rng?: () => number;
}

export function resolveRule(rules: ReviewerRule[]): ReviewerRule {
  const rule = rules[0];
  if (rule === undefined) {
    throw new Error("Configuration contains no rules");
  }
  return rule;
}

function pickRandom(candidates: string[], count: number, rng: () => number): string[] {
  if (count >= candidates.length) {
    return [...candidates];
  }

  const remaining = candidates.map((_, index) => index);
  const chosen = new Set<number>();
  for (let i = 0; i < count; i++) {
    const at = Math.floor(rng() * remaining.length);
    const [index] = remaining.splice(at, 1);
    if (index !== undefined) {
      chosen.add(index);
    }
  }

  return candidates.filter((_, index) => chosen.has(index));
}

export function selectAssignees(rule: ReviewerRule, options: SelectionOptions): string[] {
  const { prAuthor, excludeAccountIds = new Set<string>(), rng = Math.random } = options;
  const candidates = eligibleReviewers(rule, prAuthor, excludeAccountIds);

  switch (rule.rule) {
    case "all":
    case "solo":
      return candidates;
    case "random":
      return pickRandom(candidates, rule.needApprovalCount, rng);
  }
}
