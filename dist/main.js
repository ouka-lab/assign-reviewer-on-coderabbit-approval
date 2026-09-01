// @bun
// src/run.ts
import { resolve as resolve2 } from "path";

// src/coderabbit.ts
import { resolve } from "path";
var DEFAULT_CODERABBIT_CONFIG_FILES = [".coderabbit.yaml", ".coderabbit.yml"];
var MISSING_FILE_MESSAGE = "This action requires `reviews.request_changes_workflow: true`, which it reads " + "from the CodeRabbit configuration committed to the repository. Configuring " + "CodeRabbit through its web UI alone is not enough: the file has to exist in the " + "checked-out tree for the setting to be verifiable. Also make sure `actions/checkout` " + "runs before this action.";
var DISABLED_MESSAGE = "Without it CodeRabbit never posts the approval this action triggers on, so the " + "workflow would silently never assign anyone.";
async function readFirstExisting(workspaceRoot, candidates) {
  for (const candidate of candidates) {
    const path = resolve(workspaceRoot, candidate);
    const file = Bun.file(path);
    if (await file.exists()) {
      return { path, text: await file.text() };
    }
  }
  return;
}
async function verifyRequestChangesWorkflow(workspaceRoot, configFile) {
  const candidates = configFile ? [configFile] : DEFAULT_CODERABBIT_CONFIG_FILES;
  const found = await readFirstExisting(workspaceRoot, candidates);
  if (!found) {
    const looked = candidates.map((candidate) => `"${candidate}"`).join(" or ");
    throw new Error(`CodeRabbit configuration not found (looked for ${looked}). ${MISSING_FILE_MESSAGE}`);
  }
  let parsed;
  try {
    parsed = Bun.YAML.parse(found.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${found.path} is not valid YAML: ${message}`);
  }
  const reviews = typeof parsed === "object" && parsed !== null ? parsed.reviews : undefined;
  const value = typeof reviews === "object" && reviews !== null ? reviews.request_changes_workflow : undefined;
  if (value !== true) {
    const actual = value === undefined ? "not set" : `set to ${JSON.stringify(value)}`;
    throw new Error(`${found.path} must set \`reviews.request_changes_workflow: true\`, but it is ${actual}. ${DISABLED_MESSAGE}`);
  }
  return found.path;
}

// node_modules/valibot/dist/index.mjs
var store$4;
var DEFAULT_CONFIG = {
  lang: undefined,
  message: undefined,
  abortEarly: undefined,
  abortPipeEarly: undefined
};
function getGlobalConfig(config$1) {
  if (!config$1 && !store$4)
    return DEFAULT_CONFIG;
  return {
    lang: config$1?.lang ?? store$4?.lang,
    message: config$1?.message,
    abortEarly: config$1?.abortEarly ?? store$4?.abortEarly,
    abortPipeEarly: config$1?.abortPipeEarly ?? store$4?.abortPipeEarly
  };
}
var store$3;
function getGlobalMessage(lang) {
  return store$3?.get(lang);
}
var store$2;
function getSchemaMessage(lang) {
  return store$2?.get(lang);
}
var store$1;
function getSpecificMessage(reference, lang) {
  return store$1?.get(reference)?.get(lang);
}
function _stringify(input) {
  const type = typeof input;
  if (type === "string")
    return `"${input}"`;
  if (type === "number" || type === "bigint" || type === "boolean")
    return `${input}`;
  if (type === "object" || type === "function")
    return (input && Object.getPrototypeOf(input)?.constructor?.name) ?? "null";
  return type;
}
function _addIssue(context, label, dataset, config$1, other) {
  const input = other && "input" in other ? other.input : dataset.value;
  const expected = other?.expected ?? context.expects ?? null;
  const received = other?.received ?? /* @__PURE__ */ _stringify(input);
  const issue = {
    kind: context.kind,
    type: context.type,
    input,
    expected,
    received,
    message: `Invalid ${label}: ${expected ? `Expected ${expected} but r` : "R"}eceived ${received}`,
    requirement: context.requirement,
    path: other?.path,
    issues: other?.issues,
    lang: config$1.lang,
    abortEarly: config$1.abortEarly,
    abortPipeEarly: config$1.abortPipeEarly
  };
  const isSchema = context.kind === "schema";
  const message$1 = other?.message ?? context.message ?? /* @__PURE__ */ getSpecificMessage(context.reference, issue.lang) ?? (isSchema ? /* @__PURE__ */ getSchemaMessage(issue.lang) : null) ?? config$1.message ?? /* @__PURE__ */ getGlobalMessage(issue.lang);
  if (message$1 !== undefined)
    issue.message = typeof message$1 === "function" ? message$1(issue) : message$1;
  if (isSchema)
    dataset.typed = false;
  if (dataset.issues)
    dataset.issues.push(issue);
  else
    dataset.issues = [issue];
}
var _standardCache = /* @__PURE__ */ new WeakMap;
function _getStandardProps(context) {
  let cached = _standardCache.get(context);
  if (!cached) {
    cached = {
      version: 1,
      vendor: "valibot",
      validate(value$1) {
        return context["~run"]({ value: value$1 }, /* @__PURE__ */ getGlobalConfig());
      }
    };
    _standardCache.set(context, cached);
  }
  return cached;
}
function _joinExpects(values$1, separator) {
  const list = [...new Set(values$1)];
  if (list.length > 1)
    return `(${list.join(` ${separator} `)})`;
  return list[0] ?? "never";
}
function getDotPath(issue) {
  if (issue.path) {
    let key = "";
    for (const item of issue.path)
      if (typeof item.key === "string" || typeof item.key === "number")
        if (key)
          key += `.${item.key}`;
        else
          key += item.key;
      else
        return null;
    return key;
  }
  return null;
}
function description(description_) {
  return {
    kind: "metadata",
    type: "description",
    reference: description,
    description: description_
  };
}
function integer(message$1) {
  return {
    kind: "validation",
    type: "integer",
    reference: integer,
    async: false,
    expects: null,
    requirement: Number.isInteger,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !this.requirement(dataset.value))
        _addIssue(this, "integer", dataset, config$1);
      return dataset;
    }
  };
}
function length(requirement, message$1) {
  return {
    kind: "validation",
    type: "length",
    reference: length,
    async: false,
    expects: `${requirement}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && dataset.value.length !== this.requirement)
        _addIssue(this, "length", dataset, config$1, { received: `${dataset.value.length}` });
      return dataset;
    }
  };
}
function minLength(requirement, message$1) {
  return {
    kind: "validation",
    type: "min_length",
    reference: minLength,
    async: false,
    expects: `>=${requirement}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && dataset.value.length < this.requirement)
        _addIssue(this, "length", dataset, config$1, { received: `${dataset.value.length}` });
      return dataset;
    }
  };
}
function minValue(requirement, message$1) {
  return {
    kind: "validation",
    type: "min_value",
    reference: minValue,
    async: false,
    expects: `>=${requirement instanceof Date ? requirement.toJSON() : /* @__PURE__ */ _stringify(requirement)}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !(dataset.value >= this.requirement))
        _addIssue(this, "value", dataset, config$1, { received: dataset.value instanceof Date ? dataset.value.toJSON() : /* @__PURE__ */ _stringify(dataset.value) });
      return dataset;
    }
  };
}
function regex(requirement, message$1) {
  return {
    kind: "validation",
    type: "regex",
    reference: regex,
    async: false,
    expects: `${requirement}`,
    requirement,
    message: message$1,
    "~run"(dataset, config$1) {
      if (dataset.typed && !this.requirement.test(dataset.value))
        _addIssue(this, "format", dataset, config$1);
      return dataset;
    }
  };
}
var ABORT_EARLY_CONFIG = { abortEarly: true };
function getFallback(schema, dataset, config$1) {
  return typeof schema.fallback === "function" ? schema.fallback(dataset, config$1) : schema.fallback;
}
function getDefault(schema, dataset, config$1) {
  return typeof schema.default === "function" ? schema.default(dataset, config$1) : schema.default;
}
function array(item, message$1) {
  return {
    kind: "schema",
    type: "array",
    reference: array,
    expects: "Array",
    async: false,
    item,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (Array.isArray(input)) {
        dataset.typed = true;
        dataset.value = [];
        for (let key = 0;key < input.length; key++) {
          const value$1 = input[key];
          const itemDataset = this.item["~run"]({ value: value$1 }, config$1);
          if (itemDataset.issues) {
            const pathItem = {
              type: "array",
              origin: "value",
              input,
              key,
              value: value$1
            };
            for (const issue of itemDataset.issues) {
              if (issue.path)
                issue.path.unshift(pathItem);
              else
                issue.path = [pathItem];
              dataset.issues?.push(issue);
            }
            if (!dataset.issues)
              dataset.issues = itemDataset.issues;
            if (config$1.abortEarly) {
              dataset.typed = false;
              break;
            }
          }
          if (!itemDataset.typed)
            dataset.typed = false;
          dataset.value.push(itemDataset.value);
        }
      } else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function literal(literal_, message$1) {
  return {
    kind: "schema",
    type: "literal",
    reference: literal,
    expects: /* @__PURE__ */ _stringify(literal_),
    async: false,
    literal: literal_,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === this.literal)
        dataset.typed = true;
      else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function number(message$1) {
  return {
    kind: "schema",
    type: "number",
    reference: number,
    expects: "number",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "number" && !isNaN(dataset.value))
        dataset.typed = true;
      else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function optional(wrapped, default_) {
  return {
    kind: "schema",
    type: "optional",
    reference: optional,
    expects: `(${wrapped.expects} | undefined)`,
    async: false,
    wrapped,
    default: default_,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (dataset.value === undefined) {
        if (this.default !== undefined)
          dataset.value = /* @__PURE__ */ getDefault(this, dataset, config$1);
        if (dataset.value === undefined) {
          dataset.typed = true;
          return dataset;
        }
      }
      return this.wrapped["~run"](dataset, config$1);
    }
  };
}
function strictObject(entries$1, message$1) {
  return {
    kind: "schema",
    type: "strict_object",
    reference: strictObject,
    expects: "Object",
    async: false,
    entries: entries$1,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        dataset.typed = true;
        dataset.value = {};
        for (const key in this.entries) {
          const valueSchema = this.entries[key];
          if (key in input || (valueSchema.type === "exact_optional" || valueSchema.type === "optional" || valueSchema.type === "nullish") && valueSchema.default !== undefined) {
            const value$1 = key in input ? input[key] : /* @__PURE__ */ getDefault(valueSchema);
            const valueDataset = valueSchema["~run"]({ value: value$1 }, config$1);
            if (valueDataset.issues) {
              const pathItem = {
                type: "object",
                origin: "value",
                input,
                key,
                value: value$1
              };
              for (const issue of valueDataset.issues) {
                if (issue.path)
                  issue.path.unshift(pathItem);
                else
                  issue.path = [pathItem];
                dataset.issues?.push(issue);
              }
              if (!dataset.issues)
                dataset.issues = valueDataset.issues;
              if (config$1.abortEarly) {
                dataset.typed = false;
                break;
              }
            }
            if (!valueDataset.typed)
              dataset.typed = false;
            dataset.value[key] = valueDataset.value;
          } else if (valueSchema.fallback !== undefined)
            dataset.value[key] = /* @__PURE__ */ getFallback(valueSchema);
          else if (valueSchema.type !== "exact_optional" && valueSchema.type !== "optional" && valueSchema.type !== "nullish") {
            _addIssue(this, "key", dataset, config$1, {
              input: undefined,
              expected: `"${key}"`,
              path: [{
                type: "object",
                origin: "key",
                input,
                key,
                value: input[key]
              }]
            });
            if (config$1.abortEarly)
              break;
          }
        }
        if (!dataset.issues || !config$1.abortEarly) {
          for (const key in input)
            if (!(key in this.entries)) {
              _addIssue(this, "key", dataset, config$1, {
                input: key,
                expected: "never",
                path: [{
                  type: "object",
                  origin: "key",
                  input,
                  key,
                  value: input[key]
                }]
              });
              break;
            }
        }
      } else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function string(message$1) {
  return {
    kind: "schema",
    type: "string",
    reference: string,
    expects: "string",
    async: false,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      if (typeof dataset.value === "string")
        dataset.typed = true;
      else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function variant(key, options, message$1) {
  return {
    kind: "schema",
    type: "variant",
    reference: variant,
    expects: "Object",
    async: false,
    key,
    options,
    message: message$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      const input = dataset.value;
      if (input && typeof input === "object") {
        let outputDataset;
        let maxDiscriminatorPriority = 0;
        let invalidDiscriminatorKey = this.key;
        let expectedDiscriminators = [];
        const parseOptions = (variant$1, allKeys) => {
          for (const schema of variant$1.options) {
            if (schema.type === "variant")
              parseOptions(schema, new Set(allKeys).add(schema.key));
            else {
              let keysAreValid = true;
              let currentPriority = 0;
              for (const currentKey of allKeys) {
                const discriminatorSchema = schema.entries[currentKey];
                if (currentKey in input ? discriminatorSchema["~run"]({
                  typed: false,
                  value: input[currentKey]
                }, ABORT_EARLY_CONFIG).issues : discriminatorSchema.type !== "exact_optional" && discriminatorSchema.type !== "optional" && discriminatorSchema.type !== "nullish") {
                  keysAreValid = false;
                  if (invalidDiscriminatorKey !== currentKey && (maxDiscriminatorPriority < currentPriority || maxDiscriminatorPriority === currentPriority && (currentKey in input) && !(invalidDiscriminatorKey in input))) {
                    maxDiscriminatorPriority = currentPriority;
                    invalidDiscriminatorKey = currentKey;
                    expectedDiscriminators = [];
                  }
                  if (invalidDiscriminatorKey === currentKey)
                    expectedDiscriminators.push(schema.entries[currentKey].expects);
                  break;
                }
                currentPriority++;
              }
              if (keysAreValid) {
                const optionDataset = schema["~run"]({ value: input }, config$1);
                if (!outputDataset || !outputDataset.typed && optionDataset.typed)
                  outputDataset = optionDataset;
              }
            }
            if (outputDataset && !outputDataset.issues)
              break;
          }
        };
        parseOptions(this, new Set([this.key]));
        if (outputDataset)
          return outputDataset;
        _addIssue(this, "type", dataset, config$1, {
          input: input[invalidDiscriminatorKey],
          expected: /* @__PURE__ */ _joinExpects(expectedDiscriminators, "|"),
          path: [{
            type: "object",
            origin: "value",
            input,
            key: invalidDiscriminatorKey,
            value: input[invalidDiscriminatorKey]
          }]
        });
      } else
        _addIssue(this, "type", dataset, config$1);
      return dataset;
    }
  };
}
function pipe(...pipe$1) {
  return {
    ...pipe$1[0],
    pipe: pipe$1,
    get "~standard"() {
      return /* @__PURE__ */ _getStandardProps(this);
    },
    "~run"(dataset, config$1) {
      for (const item of pipe$1)
        if (item.kind !== "metadata") {
          if (dataset.issues && (item.kind === "schema" || item.kind === "transformation")) {
            dataset.typed = false;
            break;
          }
          if (!dataset.issues || !config$1.abortEarly && !config$1.abortPipeEarly)
            dataset = item["~run"](dataset, config$1);
        }
      return dataset;
    }
  };
}
function safeParse(schema, input, config$1) {
  const dataset = schema["~run"]({ value: input }, /* @__PURE__ */ getGlobalConfig(config$1));
  return {
    typed: dataset.typed,
    success: !dataset.issues,
    output: dataset.value,
    issues: dataset.issues
  };
}

// src/config.ts
var ACCOUNT_ID_PATTERN = /^@?[A-Za-z\d](?:[A-Za-z\d]|-(?=[A-Za-z\d])){0,38}$/;
var ACCOUNT_ID_MESSAGE = 'must be a GitHub account ID such as "@alice" or "alice" ' + '(team handles like "@org/team" are not supported, because reviewers are ' + "requested individually)";
var MULTIPLE_RULES_MESSAGE = '"rules" must contain exactly one rule in this version. It is an array ' + 'because path-scoped rules are planned: a future "paths" field will let ' + "each rule target different files. Until then every rule would match every " + 'pull request, which makes multiple rules ambiguous \u2014 "all" and "random" ' + "would contradict each other about how many approvals a pull request needs. " + 'Pick a single rule: "all", "random", or "solo".';
var ReviewerAccountIdSchema = pipe(string(), regex(ACCOUNT_ID_PATTERN, ACCOUNT_ID_MESSAGE));
var ReviewersSchema = pipe(array(ReviewerAccountIdSchema), minLength(1, "must list at least one reviewer"), description('GitHub account IDs eligible to review. A leading "@" is optional. The ' + "pull request author is always removed from this list before assignment."));
var NeedApprovalCountSchema = pipe(number(), integer("must be a whole number"), minValue(1, "must be at least 1"), description("How many human approvals this pull request needs, excluding CodeRabbit. " + "That many reviewers are picked at random from `reviewers`."));
var RuleSchema = variant("rule", [
  pipe(strictObject({
    rule: literal("all"),
    reviewers: ReviewersSchema
  }), description("Assign every reviewer in the list.")),
  pipe(strictObject({
    rule: literal("random"),
    needApprovalCount: NeedApprovalCountSchema,
    reviewers: ReviewersSchema
  }), description("Assign `needApprovalCount` reviewers picked at random from the list.")),
  pipe(strictObject({
    rule: literal("solo"),
    reviewers: ReviewersSchema
  }), description("For repositories with a single maintainer. Assigns the maintainer on " + "other people's pull requests, and does nothing on the maintainer's own " + "\u2014 having nobody left to assign is expected here, not an error."))
]);
var ConfigSchema = strictObject({
  $schema: optional(string()),
  rules: pipe(array(RuleSchema), length(1, MULTIPLE_RULES_MESSAGE), description(MULTIPLE_RULES_MESSAGE))
});
function normalizeAccountId(accountId) {
  return accountId.startsWith("@") ? accountId.slice(1) : accountId;
}
function normalizeReviewers(reviewers) {
  const seen = new Set;
  const result = [];
  for (const raw of reviewers) {
    const accountId = normalizeAccountId(raw);
    const key = accountId.toLowerCase();
    if (seen.has(key))
      continue;
    seen.add(key);
    result.push(accountId);
  }
  return result;
}
function formatIssues(issues) {
  const lines = issues.map((issue) => {
    const path = getDotPath(issue);
    return path ? `  ${path}: ${issue.message}` : `  ${issue.message}`;
  });
  return [...new Set(lines)].join(`
`);
}
function parseConfig(input) {
  const result = safeParse(ConfigSchema, input);
  if (!result.success) {
    throw new Error(`Invalid configuration:
${formatIssues(result.issues)}`);
  }
  const rules = result.output.rules.map((rule) => ({
    ...rule,
    reviewers: normalizeReviewers(rule.reviewers)
  }));
  return { rules };
}
function parseConfigText(text, filePath) {
  let json;
  try {
    json = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${filePath} is not valid JSON: ${message}`);
  }
  return parseConfig(json);
}
function eligibleReviewers(rule, prAuthor, excludeAccountIds = new Set) {
  const author = prAuthor.toLowerCase();
  const excluded = new Set([...excludeAccountIds].map((accountId) => accountId.toLowerCase()));
  return rule.reviewers.filter((accountId) => {
    const key = accountId.toLowerCase();
    return key !== author && !excluded.has(key);
  });
}
function validateAgainstAuthor(config, prAuthor, excludeAccountIds = new Set) {
  const problems = [];
  config.rules.forEach((rule, index) => {
    const eligible = eligibleReviewers(rule, prAuthor, excludeAccountIds);
    const context = `rule ${index} ("${rule.rule}") lists ${rule.reviewers.length} reviewer(s), ` + `but only ${eligible.length} can be assigned to this pull request ` + `(the author "${prAuthor}" and any excluded accounts are removed)`;
    if (rule.rule === "random" && eligible.length < rule.needApprovalCount) {
      problems.push(`${context}, which is fewer than the needApprovalCount of ${rule.needApprovalCount}. ` + "Add more reviewers, or lower needApprovalCount.");
      return;
    }
    if (rule.rule === "all" && eligible.length === 0) {
      problems.push(`${context}, leaving nobody to assign. If this repository is maintained by ` + 'a single person, use `"rule": "solo"` instead: it assigns the maintainer ' + "on everyone else's pull requests and does nothing on their own.");
    }
  });
  if (problems.length > 0) {
    throw new Error(`Configuration cannot be applied to this pull request:
${problems.join(`
`)}`);
  }
}

// src/env.ts
var DEFAULT_CONFIG_FILE = ".github/assign-reviewer-on-coderabbit-approval.json";
var DEFAULT_CODERABBIT_ACCOUNT_ID = "coderabbitai[bot]";
function trimmed(value) {
  const result = value?.trim();
  return result ? result : undefined;
}
function coderabbitAccountIdOf(env) {
  return trimmed(env.INPUT_CODERABBIT_ACCOUNT_ID) ?? DEFAULT_CODERABBIT_ACCOUNT_ID;
}
function parseInputs(env) {
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
  const excludeAccountIds = new Set([coderabbitAccountId.toLowerCase()]);
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
    outputFile: trimmed(env.GITHUB_OUTPUT)
  };
}

// src/github.ts
var DEFAULT_BASE_URL = "https://api.github.com";
var PER_PAGE = 100;
var MAX_PAGES = 100;
function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}
function pullUrl(context, prNumber, suffix) {
  const base = context.baseUrl ?? DEFAULT_BASE_URL;
  return `${base}/repos/${context.owner}/${context.repo}/pulls/${prNumber}${suffix}`;
}
async function failure(response, action) {
  const body = await response.text().catch(() => "");
  const detail = body ? `: ${body}` : "";
  return new Error(`Failed to ${action}: ${response.status} ${response.statusText}${detail}`);
}
async function getRequestedReviewers(context, prNumber) {
  const fetcher = context.fetcher ?? fetch;
  const response = await fetcher(pullUrl(context, prNumber, "/requested_reviewers"), {
    headers: headers(context.token)
  });
  if (!response.ok) {
    throw await failure(response, "fetch requested reviewers");
  }
  const payload = await response.json();
  return (payload.users ?? []).map((user) => user.login);
}
async function listSubmittedReviews(context, prNumber) {
  const fetcher = context.fetcher ?? fetch;
  const reviews = [];
  for (let page = 1;page <= MAX_PAGES; page++) {
    const url = pullUrl(context, prNumber, `/reviews?per_page=${PER_PAGE}&page=${page}`);
    const response = await fetcher(url, {
      headers: headers(context.token)
    });
    if (!response.ok) {
      throw await failure(response, "fetch reviews");
    }
    const payload = await response.json();
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
async function requestReviewers(context, prNumber, accountIds) {
  if (accountIds.length === 0) {
    return;
  }
  const fetcher = context.fetcher ?? fetch;
  const response = await fetcher(pullUrl(context, prNumber, "/requested_reviewers"), {
    method: "POST",
    headers: {
      ...headers(context.token),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ reviewers: accountIds })
  });
  if (!response.ok) {
    const error = await failure(response, `request reviewers ${accountIds.join(", ")}`);
    if (response.status === 422) {
      error.message += `
GitHub only accepts review requests for accounts that already have access to ` + "the repository. Check that every account above is a collaborator \u2014 an invitation " + "that has not been accepted yet does not count \u2014 and that each ID is spelled correctly.";
    }
    throw error;
  }
}

// src/outputs.ts
import { appendFile } from "fs/promises";
async function setOutput(name, value, outputFile) {
  if (!outputFile) {
    return;
  }
  const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
  await appendFile(outputFile, `${name}<<${delimiter}
${value}
${delimiter}
`);
}

// src/select.ts
function resolveRule(rules) {
  const rule = rules[0];
  if (rule === undefined) {
    throw new Error("Configuration contains no rules");
  }
  return rule;
}
function pickRandom(candidates, count, rng) {
  if (count >= candidates.length) {
    return [...candidates];
  }
  const remaining = candidates.map((_, index) => index);
  const chosen = new Set;
  for (let i = 0;i < count; i++) {
    const at = Math.floor(rng() * remaining.length);
    const [index] = remaining.splice(at, 1);
    if (index !== undefined) {
      chosen.add(index);
    }
  }
  return candidates.filter((_, index) => chosen.has(index));
}
function selectAssignees(rule, options) {
  const { prAuthor, excludeAccountIds = new Set, rng = Math.random } = options;
  const candidates = eligibleReviewers(rule, prAuthor, excludeAccountIds);
  switch (rule.rule) {
    case "all":
    case "solo":
      return candidates;
    case "random":
      return pickRandom(candidates, rule.needApprovalCount, rng);
  }
}

// src/run.ts
function triggerSkipReason(env) {
  if ((env.EVENT_REVIEW_STATE ?? "").toLowerCase() !== "approved") {
    return "not-approved";
  }
  const author = (env.EVENT_REVIEW_AUTHOR ?? "").toLowerCase();
  if (author !== coderabbitAccountIdOf(env).toLowerCase()) {
    return "not-coderabbit-approval";
  }
  return;
}
function isHuman(accountId, excludeAccountIds) {
  const key = accountId.toLowerCase();
  return !excludeAccountIds.has(key) && !key.endsWith("[bot]");
}
async function readConfig(inputs) {
  const path = resolve2(inputs.workspace, inputs.configFile);
  const file = Bun.file(path);
  if (!await file.exists()) {
    throw new Error(`Configuration file not found: ${path}. Create it, or point \`config-file\` at ` + "your own path. Also make sure `actions/checkout` runs before this action.");
  }
  return parseConfigText(await file.text(), path);
}
async function humanAlreadyInvolved(inputs, fetcher) {
  const context = {
    token: inputs.token,
    owner: inputs.owner,
    repo: inputs.repo,
    ...fetcher ? { fetcher } : {}
  };
  const requested = await getRequestedReviewers(context, inputs.prNumber);
  if (requested.some((accountId) => isHuman(accountId, inputs.excludeAccountIds))) {
    return true;
  }
  const author = inputs.prAuthor.toLowerCase();
  const reviews = await listSubmittedReviews(context, inputs.prNumber);
  return reviews.some((review) => isHuman(review.accountId, inputs.excludeAccountIds) && review.accountId.toLowerCase() !== author);
}
async function run(env, deps = {}) {
  const logger = deps.logger ?? console;
  const triggerSkip = triggerSkipReason(env);
  if (triggerSkip) {
    logger.log(triggerSkip === "not-approved" ? `Review state is "${env.EVENT_REVIEW_STATE ?? ""}", not an approval. Nothing to do.` : `Approval came from "${env.EVENT_REVIEW_AUTHOR ?? ""}", not CodeRabbit. Nothing to do.`);
    return await finish(env.GITHUB_OUTPUT, [], triggerSkip);
  }
  const inputs = parseInputs(env);
  const coderabbitConfigPath = await verifyRequestChangesWorkflow(inputs.workspace, inputs.coderabbitConfigFile);
  logger.log(`Verified request_changes_workflow in ${coderabbitConfigPath}`);
  const config = await readConfig(inputs);
  validateAgainstAuthor(config, inputs.prAuthor, inputs.excludeAccountIds);
  const rule = resolveRule(config.rules);
  const assignees = selectAssignees(rule, {
    prAuthor: inputs.prAuthor,
    excludeAccountIds: inputs.excludeAccountIds,
    ...deps.rng ? { rng: deps.rng } : {}
  });
  if (assignees.length === 0) {
    logger.log(`Rule "${rule.rule}" leaves nobody to assign for a pull request by "${inputs.prAuthor}".`);
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
  await requestReviewers({
    token: inputs.token,
    owner: inputs.owner,
    repo: inputs.repo,
    ...deps.fetcher ? { fetcher: deps.fetcher } : {}
  }, inputs.prNumber, assignees);
  logger.log(`Assigned reviewers: ${assignees.join(", ")}`);
  return await finish(inputs.outputFile, assignees);
}
async function finish(outputFile, assigned, skipped) {
  await setOutput("assigned-reviewers", assigned.join(","), outputFile);
  await setOutput("skipped-reason", skipped ?? "", outputFile);
  return skipped ? { assigned, skipped } : { assigned };
}

// src/main.ts
try {
  await run(process.env);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`::error::${message}`);
  process.exit(1);
}
