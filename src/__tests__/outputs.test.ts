import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setOutput } from "../outputs.ts";

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function outputFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "outputs-"));
  dirs.push(dir);
  return join(dir, "output");
}

describe("setOutput", () => {
  it("writes a name/value pair GitHub Actions can parse", async () => {
    const path = outputFile();
    await setOutput("assigned-reviewers", "alice,bob", path);

    const written = await Bun.file(path).text();
    expect(written).toMatch(/^assigned-reviewers<<ghadelimiter_[0-9a-f-]+\n/);
    expect(written).toContain("\nalice,bob\n");
  });

  it("appends rather than replacing", async () => {
    const path = outputFile();
    await setOutput("first", "1", path);
    await setOutput("second", "2", path);

    const written = await Bun.file(path).text();
    expect(written).toContain("first<<");
    expect(written).toContain("second<<");
  });

  it("keeps a value containing newlines inside its delimiter block", async () => {
    const path = outputFile();
    await setOutput("skipped-reason", "line1\nsmuggled=yes", path);

    const written = await Bun.file(path).text();
    const match = written.match(/^skipped-reason<<(\S+)\n([\s\S]*)\n\1\n$/);
    expect(match).not.toBeNull();
    // The whole thing is the value; it cannot be read as a second output.
    expect(match?.[2]).toBe("line1\nsmuggled=yes");
  });

  it("does nothing when the runner provides no output file", async () => {
    await expect(setOutput("name", "value", undefined)).resolves.toBeUndefined();
  });
});
