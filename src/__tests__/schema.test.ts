import { describe, expect, it } from "bun:test";
import { SCHEMA_PATH, buildSchema, serializeSchema } from "../../scripts/generate-schema.ts";

describe("schema.json", () => {
  it("matches what the Valibot schema currently generates", async () => {
    const committed = await Bun.file(SCHEMA_PATH).text();
    expect(serializeSchema()).toBe(committed);
  });

  it("encodes the exactly-one-rule constraint so editors flag it too", () => {
    const schema = buildSchema() as {
      properties: { rules: { minItems: number; maxItems: number; description: string } };
    };
    expect(schema.properties.rules.minItems).toBe(1);
    expect(schema.properties.rules.maxItems).toBe(1);
    expect(schema.properties.rules.description).toContain("exactly one rule");
  });

  it("describes all three rule kinds", () => {
    const serialized = serializeSchema();
    for (const kind of ["all", "random", "solo"]) {
      expect(serialized).toContain(`"const": "${kind}"`);
    }
  });

  it("forbids unknown properties", () => {
    const schema = buildSchema() as { additionalProperties: boolean };
    expect(schema.additionalProperties).toBe(false);
  });
});
