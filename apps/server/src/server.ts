import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import Fastify, { type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import { request as undiciRequest } from "undici";
import { clientFromEnv } from "@mm/subsonic-client";
import type { ArtistsDoc, EnrichedArtist, Graph } from "@mm/shared-types";
import { dataDir, loadWorkspaceEnv, workspaceRoot } from "./env.ts";

loadWorkspaceEnv();

const PORT = Number(process.env.PORT ?? 5173);
const HOST = process.env.HOST ?? "0.0.0.0";
const PREVIEW_FORMAT = process.env.PREVIEW_FORMAT ?? "mp3";
const PREVIEW_BITRATE = Number(process.env.PREVIEW_BITRATE ?? 128);

const { client: subsonic, error: subsonicError } = clientFromEnv();
if (!subsonic) {
    console.error(`[server] Subsonic client not configured: ${subsonicError}`);
    process.exit(1);
}

const fastify = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
});

// ── Data cache (re-read on disk change; cheap, files are small) ──────────────
let graphCache: { mtime: number; data: Graph } | null = null;
let artistsCache: { mtime: number; data: ArtistsDoc; byId: Map<string, EnrichedArtist> } | null =
    null;

async function loadGraph(): Promise<Graph> {
    const path = resolve(dataDir(), "graph.json");
    const { mtimeMs } = await import("node:fs/promises").then((m) => m.stat(path));
    if (graphCache && graphCache.mtime === mtimeMs) return graphCache.data;
    const data = JSON.parse(await readFile(path, "utf8")) as Graph;
    graphCache = { mtime: mtimeMs, data };
    return data;
}

async function loadArtists(): Promise<{
    doc: ArtistsDoc;
    byId: Map<string, EnrichedArtist>;
}> {
    const path = resolve(dataDir(), "artists.json");
    const { mtimeMs } = await import("node:fs/promises").then((m) => m.stat(path));
    if (artistsCache && artistsCache.mtime === mtimeMs) {
        return { doc: artistsCache.data, byId: artistsCache.byId };
    }
    const data = JSON.parse(await readFile(path, "utf8")) as ArtistsDoc;
    const byId = new Map(data.artists.map((a) => [a.id, a]));
    artistsCache = { mtime: mtimeMs, data, byId };
    return { doc: data, byId };
}

// ── API routes ───────────────────────────────────────────────────────────────
fastify.get("/api/graph", async (_req, reply) => {
    try {
        const graph = await loadGraph();
        reply.header("cache-control", "no-cache");
        return graph;
    } catch (err) {
        reply.code(503);
        return { error: "graph not yet built; run `yarn ingest` first", detail: String(err) };
    }
});

fastify.get("/api/artists", async (_req, reply) => {
    try {
        const { doc } = await loadArtists();
        reply.header("cache-control", "no-cache");
        return doc;
    } catch (err) {
        reply.code(503);
        return { error: "artists not yet ingested", detail: String(err) };
    }
});

fastify.get<{ Params: { id: string } }>("/api/tags/:id/artists", async (req, reply) => {
    const { doc } = await loadArtists();
    const ids = doc.byTag[req.params.id] ?? [];
    const list = ids
        .map((id) => doc.artists.find((a) => a.id === id))
        .filter((a): a is EnrichedArtist => !!a)
        // Stable, useful default ordering: most-played first
        .sort((a, b) => b.playCount - a.playCount);
    if (!ids.length) reply.code(404);
    return { tag: req.params.id, count: list.length, artists: list };
});

fastify.get<{ Params: { id: string } }>("/api/artists/:id", async (req, reply) => {
    const { byId } = await loadArtists();
    const a = byId.get(req.params.id);
    if (!a) {
        reply.code(404);
        return { error: "artist not found" };
    }
    return a;
});

// ── Media proxy (cover art + audio preview) ──────────────────────────────────
async function proxyToNavidrome(
    url: string,
    reply: FastifyReply,
    reqHeaders: Record<string, string | string[] | undefined>,
): Promise<FastifyReply> {
    const headers: Record<string, string> = {};
    // Forward Range so audio scrubbing works.
    const range = reqHeaders["range"];
    if (typeof range === "string") headers["range"] = range;

    const upstream = await undiciRequest(url, { method: "GET", headers });
    reply.code(upstream.statusCode);
    // Forward a useful subset of headers.
    for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
        const v = upstream.headers[k];
        if (typeof v === "string") reply.header(k, v);
    }
    return reply.send(upstream.body);
}

fastify.get<{ Params: { id: string }; Querystring: { size?: string } }>(
    "/media/cover/:id",
    async (req, reply) => {
        const size = req.query.size ? Number(req.query.size) : undefined;
        const url = subsonic.coverArtUrl(req.params.id, size);
        return proxyToNavidrome(url, reply, req.headers as Record<string, string | undefined>);
    },
);

fastify.get<{ Params: { id: string } }>("/media/stream/:id", async (req, reply) => {
    const url = subsonic.streamUrl(req.params.id, {
        format: PREVIEW_FORMAT,
        maxBitRate: PREVIEW_BITRATE,
    });
    return proxyToNavidrome(url, reply, req.headers as Record<string, string | undefined>);
});

fastify.get<{ Params: { id: string } }>("/api/navidrome-url/:id", async (req) => {
    const base = process.env.NAVIDROME_URL?.replace(/\/+$/, "");
    return {
        url: base ? `${base}/app/#/artist/${encodeURIComponent(req.params.id)}/show` : null,
    };
});

// ── Static web app (if built) ────────────────────────────────────────────────
const webDist = resolve(workspaceRoot(), "apps/web/dist");
if (existsSync(webDist)) {
    await fastify.register(fastifyStatic, { root: webDist, prefix: "/" });
    // SPA fallback: serve index.html for non-API routes
    fastify.setNotFoundHandler((req, reply) => {
        if (req.url.startsWith("/api/") || req.url.startsWith("/media/")) {
            reply.code(404).send({ error: "not found" });
            return;
        }
        reply.sendFile("index.html");
    });
} else {
    fastify.log.warn(
        `apps/web/dist not found at ${webDist} — run \`yarn workspace @mm/web build\` to enable static UI`,
    );
}

await fastify.listen({ port: PORT, host: HOST });
fastify.log.info(`listening on http://${HOST}:${PORT}`);
