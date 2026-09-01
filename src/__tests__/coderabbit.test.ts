import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifyRequestChangesWorkflow } from "../coderabbit.ts";

const workspaces: string[] = [];

afterEach(() => {
  for (const dir of workspaces.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function workspace(files: Record<string, string>): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "coderabbit-"));
  workspaces.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    await Bun.write(join(dir, name), contents);
  }
  return dir;
}

describe("verifyRequestChangesWorkflow", () => {
  it("accepts request_changes_workflow: true", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: true\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).resolves.toContain(".coderabbit.yaml");
  });

  it("accepts the setting alongside other CodeRabbit options", async () => {
    const dir = await workspace({
      ".coderabbit.yaml":
        "# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json\n" +
        "reviews:\n  request_changes_workflow: true\n  slop_detection:\n    enabled: true\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).resolves.toBeDefined();
  });

  it("falls back to the .yml spelling", async () => {
    const dir = await workspace({
      ".coderabbit.yml": "reviews:\n  request_changes_workflow: true\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).resolves.toContain(".coderabbit.yml");
  });

  it("prefers .yaml when both spellings exist", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: true\n",
      ".coderabbit.yml": "reviews:\n  request_changes_workflow: false\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).resolves.toContain(".coderabbit.yaml");
  });

  it("rejects request_changes_workflow: false", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: false\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/set to false/);
  });

  it('rejects the quoted string "true", which CodeRabbit does not honour', async () => {
    const dir = await workspace({
      ".coderabbit.yaml": 'reviews:\n  request_changes_workflow: "true"\n',
    });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/set to "true"/);
  });

  it("rejects a missing request_changes_workflow key", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  slop_detection:\n    enabled: true\n",
    });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/not set/);
  });

  it("rejects a file with no reviews section", async () => {
    const dir = await workspace({ ".coderabbit.yaml": "language: en\n" });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/not set/);
  });

  it("rejects an empty file", async () => {
    const dir = await workspace({ ".coderabbit.yaml": "" });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/not set/);
  });

  it("rejects malformed YAML, naming the file", async () => {
    const dir = await workspace({ ".coderabbit.yaml": "reviews:\n  - [unclosed\n" });
    await expect(verifyRequestChangesWorkflow(dir)).rejects.toThrow(/is not valid YAML/);
  });

  it("explains what to do when no configuration exists at all", async () => {
    const dir = await workspace({});
    const promise = verifyRequestChangesWorkflow(dir);
    await expect(promise).rejects.toThrow(/CodeRabbit configuration not found/);
    await expect(promise).rejects.toThrow(/actions\/checkout/);
  });

  it("uses an explicit path without falling back", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: true\n",
      "custom.yaml": "reviews:\n  request_changes_workflow: false\n",
    });
    await expect(verifyRequestChangesWorkflow(dir, "custom.yaml")).rejects.toThrow(/set to false/);
  });

  it("reports the explicit path when it does not exist", async () => {
    const dir = await workspace({
      ".coderabbit.yaml": "reviews:\n  request_changes_workflow: true\n",
    });
    await expect(verifyRequestChangesWorkflow(dir, "missing.yaml")).rejects.toThrow(
      /looked for "missing.yaml"/,
    );
  });
});
