import type { Env } from "./env.ts";
import { run } from "./run.ts";

try {
  await run(process.env as Env);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`::error::${message}`);
  process.exit(1);
}
