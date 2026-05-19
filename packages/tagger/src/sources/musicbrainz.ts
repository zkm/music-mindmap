import { request } from "undici";
import { resolve } from "node:path";
import pLimit from "p-limit";
import { cacheDir } from "../env.ts";
import { readJson, writeJson } from "../fs-util.ts";

/**
 * MusicBrainz artist lookup, used only for the `region` tag category.
 * Disabled when MB_USER_AGENT is unset (MB requires a contact UA per policy).
 */
export interface MbArtist {
  id: string;
  name: string;
  country?: string;
  area?: { name?: string; "iso-3166-1-codes"?: string[] };
  "begin-area"?: { name?: string };
  type?: string;
}

const limit = pLimit(1); // MB asks for 1 rps.
const MB_BASE = "https://musicbrainz.org/ws/2";

export function mbEnabled(): boolean {
  return !!(process.env.MB_USER_AGENT && process.env.MB_USER_AGENT.trim());
}

export async function lookupMbArtist(mbid: string): Promise<MbArtist | null> {
  if (!mbEnabled()) return null;
  const cachePath = resolve(cacheDir(), "musicbrainz", `${mbid}.json`);
  const cached = await readJson<MbArtist | null>(cachePath);
  if (cached !== null) return cached;

  const ua = process.env.MB_USER_AGENT!;
  const url = `${MB_BASE}/artist/${encodeURIComponent(mbid)}?fmt=json`;
  try {
    const result = await limit(async () => {
      // Polite delay to stay under 1 rps even across cold cache bursts.
      await new Promise((r) => setTimeout(r, 1100));
      const { statusCode, body } = await request(url, {
        headers: { "User-Agent": ua, Accept: "application/json" },
        headersTimeout: 15_000,
        bodyTimeout: 30_000,
      });
      const text = await body.text();
      if (statusCode !== 200) {
        return null;
      }
      return JSON.parse(text) as MbArtist;
    });
    await writeJson(cachePath, result);
    return result;
  } catch {
    return null;
  }
}
