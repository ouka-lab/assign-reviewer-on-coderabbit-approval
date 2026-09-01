import { appendFile } from "node:fs/promises";

export async function setOutput(
  name: string,
  value: string,
  outputFile: string | undefined,
): Promise<void> {
  if (!outputFile) {
    return;
  }
  const delimiter = `ghadelimiter_${crypto.randomUUID()}`;
  await appendFile(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}
