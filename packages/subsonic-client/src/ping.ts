/**
 * Smoke test: ping Navidrome and list artist counts per index letter.
 * Run with: yarn workspace @mm/subsonic-client run ping
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { clientFromEnv } from "./index.js";

// Load .env from the workspace root (two levels up from packages/subsonic-client/src).
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

async function main(): Promise<void> {
  const { client, error } = clientFromEnv();
  if (!client) {
    console.error(error);
    process.exitCode = 2;
    return;
  }

  console.log(`Pinging ${process.env.NAVIDROME_URL} ...`);
  const pong = await client.ping();
  console.log(
    `  ok — server ${pong.type ?? "?"} v${pong.serverVersion ?? "?"} (protocol ${pong.version})`,
  );

  console.log("Fetching artist list ...");
  const list = await client.getArtists();
  const indexes = list.artists.index ?? [];
  let total = 0;
  for (const idx of indexes) {
    const count = idx.artist?.length ?? 0;
    total += count;
    console.log(`  [${idx.name}] ${count}`);
  }
  console.log(`Total artists: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
