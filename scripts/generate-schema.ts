import { toJsonSchema } from "@valibot/to-json-schema";
import { ConfigSchema } from "../src/config.ts";

export const SCHEMA_PATH = new URL("../schema.json", import.meta.url);

export function buildSchema(): Record<string, unknown> {
  const { $schema: dialect, ...generated } = toJsonSchema(ConfigSchema, {
    typeMode: "input",
  });

  return {
    $schema: dialect,
    $id: "https://raw.githubusercontent.com/ouka-lab/assign-reviewer-on-coderabbit-approval/main/schema.json",
    title: "assign-reviewer-on-coderabbit-approval configuration",
    description:
      "Rules describing which human reviewers to assign when CodeRabbit approves a pull request.",
    ...generated,
  };
}

export function serializeSchema(): string {
  return `${JSON.stringify(buildSchema(), null, 2)}\n`;
}

if (import.meta.main) {
  await Bun.write(SCHEMA_PATH, serializeSchema());
  console.log(`Wrote ${SCHEMA_PATH.pathname}`);
}
