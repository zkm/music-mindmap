import { request } from "undici";
import pLimit from "p-limit";
import { authParams, endpoint, type SubsonicAuth } from "./auth.js";
import type {
    AlbumDetail,
    ArtistDetail,
    ArtistInfo2,
    ArtistsList,
    Genres,
    Starred2,
    SubsonicEnvelope,
} from "./types.js";

export interface ClientOptions extends SubsonicAuth {
    /** Max concurrent in-flight requests. */
    concurrency?: number;
    /** Max retries on 5xx / network errors. */
    retries?: number;
}

export class SubsonicError extends Error {
    constructor(
        public readonly code: number,
        message: string,
    ) {
        super(`Subsonic error ${code}: ${message}`);
    }
}

export class SubsonicClient {
    private readonly auth: SubsonicAuth;
    private readonly limit: ReturnType<typeof pLimit>;
    private readonly retries: number;

    constructor(opts: ClientOptions) {
        this.auth = {
            url: opts.url,
            user: opts.user,
            password: opts.password,
            client: opts.client || "music-mindmap",
            version: opts.version || "1.16.1",
        };
        this.limit = pLimit(opts.concurrency ?? 6);
        this.retries = opts.retries ?? 3;
    }

    /** Build a fully signed GET URL for a Subsonic endpoint (e.g. for streaming). */
    buildUrl(name: string, extra: Record<string, string | number | undefined> = {}): string {
        const params = authParams(this.auth);
        for (const [k, v] of Object.entries(extra)) {
            if (v !== undefined && v !== null) params.set(k, String(v));
        }
        return `${endpoint(this.auth.url, name)}?${params.toString()}`;
    }

    /** Low-level JSON call with retry. */
    private async call<T>(
        name: string,
        extra: Record<string, string | number | undefined> = {},
    ): Promise<T> {
        return this.limit(async () => {
            let lastErr: unknown;
            for (let attempt = 0; attempt <= this.retries; attempt++) {
                try {
                    const url = this.buildUrl(name, extra);
                    const { statusCode, body } = await request(url, {
                        method: "GET",
                        headersTimeout: 15_000,
                        bodyTimeout: 30_000,
                    });
                    if (statusCode >= 500) {
                        throw new Error(`HTTP ${statusCode} on ${name}`);
                    }
                    const text = await body.text();
                    if (statusCode >= 400) {
                        throw new Error(`HTTP ${statusCode} on ${name}: ${text.slice(0, 200)}`);
                    }
                    const env = JSON.parse(text) as SubsonicEnvelope<T>;
                    const root = env["subsonic-response"];
                    if (!root) throw new Error(`Malformed response on ${name}`);
                    if (root.status !== "ok") {
                        throw new SubsonicError(
                            root.error?.code ?? -1,
                            root.error?.message ?? "unknown",
                        );
                    }
                    return root as unknown as T;
                } catch (err) {
                    lastErr = err;
                    // Don't retry application-level Subsonic errors.
                    if (err instanceof SubsonicError) throw err;
                    const backoff = 200 * Math.pow(2, attempt);
                    await new Promise((r) => setTimeout(r, backoff));
                }
            }
            throw lastErr;
        });
    }

    async ping(): Promise<{ version: string; serverVersion?: string; type?: string }> {
        const r = await this.call<{
            version: string;
            serverVersion?: string;
            type?: string;
        }>("ping");
        return {
            version: r.version,
            serverVersion: r.serverVersion,
            type: r.type,
        };
    }

    getArtists(): Promise<ArtistsList> {
        return this.call<ArtistsList>("getArtists");
    }

    getArtist(id: string): Promise<ArtistDetail> {
        return this.call<ArtistDetail>("getArtist", { id });
    }

    getAlbum(id: string): Promise<AlbumDetail> {
        return this.call<AlbumDetail>("getAlbum", { id });
    }

    getArtistInfo2(id: string, count = 20): Promise<ArtistInfo2> {
        return this.call<ArtistInfo2>("getArtistInfo2", {
            id,
            count,
            includeNotPresent: "false",
        });
    }

    getGenres(): Promise<Genres> {
        return this.call<Genres>("getGenres");
    }

    getStarred2(): Promise<Starred2> {
        return this.call<Starred2>("getStarred2");
    }

    /** Build a signed stream URL (returns URL, doesn't download). */
    streamUrl(id: string, opts: { format?: string; maxBitRate?: number } = {}): string {
        return this.buildUrl("stream", {
            id,
            format: opts.format,
            maxBitRate: opts.maxBitRate,
        });
    }

    /** Build a signed cover-art URL. */
    coverArtUrl(id: string, size?: number): string {
        return this.buildUrl("getCoverArt", { id, size });
    }
}
