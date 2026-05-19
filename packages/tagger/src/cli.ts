import { resolve } from "node:path";
import { loadWorkspaceEnv, dataDir } from "./env.ts";
import { writeJson } from "./fs-util.ts";
import { ingestAll } from "./ingest.ts";
import { buildGraph } from "./buildGraph.ts";

loadWorkspaceEnv();

function parseArgs(argv: string[]): {
  command: string;
  refresh: boolean;
  limit?: number;
} {
  const args = argv.slice(2);
  const command = args[0] ?? "ingest";
  let refresh = false;
  let limit: number | undefined;
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "--refresh") refresh = true;
    else if (a === "--limit") {
      const next = args[++i];
      if (next) limit = Number(next);
    }
  }
  return { command, refresh, limit };
}

async function main(): Promise<void> {
  const { command, refresh, limit } = parseArgs(process.argv);
  if (command !== "ingest" && command !== "build") {
    console.error(`Unknown command: ${command}. Use "ingest" or "build".`);
    process.exit(2);
  }

  console.log(`Ingesting library (refresh=${refresh}${limit ? `, limit=${limit}` : ""}) ...`);
  const t0 = Date.now();
  const ing = await ingestAll({
    refresh,
    limit,
    onProgress: (done, total, name) => {
      if (done === 1 || done === total || done % 25 === 0) {
        process.stdout.write(`  [${done}/${total}] ${name}\n`);
      }
    },
  });
  const t1 = Date.now();
  console.log(
    `Ingest done in ${((t1 - t0) / 1000).toFixed(1)}s — ` +
      `${ing.artists.length} artists (cache: ${ing.fromCache}, fetched: ${ing.fetched})`,
  );

  console.log("Building graph ...");
  const navBase = process.env.NAVIDROME_URL?.trim();
  const built = await buildGraph(ing.artists, {
    navidromeBaseUrl: navBase,
  });
  const t2 = Date.now();
  console.log(
    `Graph built in ${((t2 - t1) / 1000).toFixed(1)}s — ` +
      `${built.graph.nodes.length} nodes, ${built.graph.edges.length} edges, ` +
      `${built.graph.stats.taggedArtistCount}/${built.graph.stats.artistCount} tagged`,
  );

  const out = dataDir();
  await writeJson(resolve(out, "graph.json"), built.graph);
  await writeJson(resolve(out, "artists.json"), built.artistsDoc);
  await writeJson(resolve(out, "unmapped-tags.json"), built.unmappedRawTags);

  // Top 20 unmapped tags for visibility into taxonomy gaps.
  const top = Object.entries(built.unmappedRawTags).slice(0, 20);
  if (top.length) {
    console.log("\nTop 20 unmapped raw tags (consider adding to taxonomy):");
    for (const [raw, n] of top) {
      console.log(`  ${String(n).padStart(4)} × ${raw}`);
    }
  }

  console.log(`\nWrote: ${out}/{graph,artists,unmapped-tags}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
