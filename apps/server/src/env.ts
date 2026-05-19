import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));

/** Load .env from the workspace root regardless of which package cwd we're in. */
export function loadWorkspaceEnv(): void {
  // apps/server/src → ../../../ = workspace root
  loadEnv({ path: resolve(here, "../../../.env") });
}

export function workspaceRoot(): string {
  return resolve(here, "../../..");
}

export function dataDir(): string {
  return resolve(workspaceRoot(), "data");
}
