import { resolve } from "node:path";

export const DEFAULT_CODERABBIT_CONFIG_FILES = [".coderabbit.yaml", ".coderabbit.yml"];

const MISSING_FILE_MESSAGE =
  "This action requires `reviews.request_changes_workflow: true`, which it reads " +
  "from the CodeRabbit configuration committed to the repository. Configuring " +
  "CodeRabbit through its web UI alone is not enough: the file has to exist in the " +
  "checked-out tree for the setting to be verifiable. Also make sure `actions/checkout` " +
  "runs before this action.";

const DISABLED_MESSAGE =
  "Without it CodeRabbit never posts the approval this action triggers on, so the " +
  "workflow would silently never assign anyone.";

async function readFirstExisting(
  workspaceRoot: string,
  candidates: string[],
): Promise<{ path: string; text: string } | undefined> {
  for (const candidate of candidates) {
    const path = resolve(workspaceRoot, candidate);
    const file = Bun.file(path);
    if (await file.exists()) {
      return { path, text: await file.text() };
    }
  }
  return undefined;
}

export async function verifyRequestChangesWorkflow(
  workspaceRoot: string,
  configFile?: string,
): Promise<string> {
  const candidates = configFile ? [configFile] : DEFAULT_CODERABBIT_CONFIG_FILES;
  const found = await readFirstExisting(workspaceRoot, candidates);

  if (!found) {
    const looked = candidates.map((candidate) => `"${candidate}"`).join(" or ");
    throw new Error(
      `CodeRabbit configuration not found (looked for ${looked}). ${MISSING_FILE_MESSAGE}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(found.text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${found.path} is not valid YAML: ${message}`);
  }

  const reviews =
    typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>).reviews
      : undefined;
  const value =
    typeof reviews === "object" && reviews !== null
      ? (reviews as Record<string, unknown>).request_changes_workflow
      : undefined;

  if (value !== true) {
    const actual = value === undefined ? "not set" : `set to ${JSON.stringify(value)}`;
    throw new Error(
      `${found.path} must set \`reviews.request_changes_workflow: true\`, but it is ${actual}. ${DISABLED_MESSAGE}`,
    );
  }

  return found.path;
}
