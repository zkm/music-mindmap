import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/** Load .env from the workspace root regardless of cwd. */
export function loadWorkspaceEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/env.ts -> packages/tagger/src -> packages/tagger -> packages -> root
  loadEnv({ path: resolve(here, "../../../.env") });
}

export function workspaceRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "../../..");
}

export function dataDir(): string {
  return resolve(workspaceRoot(), "data");
}

export function cacheDir(): string {
  return resolve(dataDir(), "cache");
}
