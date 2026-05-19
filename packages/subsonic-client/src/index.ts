export * from "./auth.js";
export * from "./client.js";
export * from "./types.js";

import { SubsonicClient } from "./client.js";

/**
 * Build a SubsonicClient from process.env. Returns null with an explanation
 * if required vars are missing — the caller decides whether to throw.
 */
export function clientFromEnv(env: NodeJS.ProcessEnv = process.env): {
    client?: SubsonicClient;
    error?: string;
} {
    const url = env.NAVIDROME_URL?.trim();
    const user = env.NAVIDROME_USER?.trim();
    const password = env.NAVIDROME_PASSWORD;
    if (!url || !user || !password) {
        return {
            error: "Missing NAVIDROME_URL / NAVIDROME_USER / NAVIDROME_PASSWORD in environment",
        };
    }
    return {
        client: new SubsonicClient({
            url,
            user,
            password,
            client: env.NAVIDROME_CLIENT?.trim() || "music-mindmap",
            version: "1.16.1",
        }),
    };
}
