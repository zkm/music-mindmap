import { resolve } from "node:path";
import pLimit from "p-limit";
import { clientFromEnv, type SubsonicClient } from "@mm/subsonic-client";
import { cacheDir } from "./env.ts";
import { readJson, writeJson } from "./fs-util.ts";

/**
 * The slice of Navidrome data we keep per artist after ingest. This is what
 * downstream stages (normalize / buildGraph) consume — it is intentionally
 * loose so unknown OpenSubsonic fields can come along for the ride.
 */
export interface CachedArtist {
  id: string;
  name: string;
  mbid?: string;
  coverArtId?: string;
  starred: boolean;
  /** Raw album records (genres[], moods[], year, playCount, etc). */
  albums: CachedAlbum[];
  /** Aggregate play count summed across albums (best-effort). */
  playCount: number;
  /** From getArtistInfo2. */
  bio?: string;
  similarArtistIds?: string[];
  // Raw responses kept for forensics / future-proofing.
  raw: {
    artist: unknown;
    info: unknown;
  };
}

export interface CachedAlbum {
  id: string;
  name: string;
  year?: number;
  originalYear?: number;
  coverArtId?: string;
  playCount?: number;
  genreStrings: string[];
  moodStrings: string[];
  mbid?: string;
}

interface RawArtistRef {
  id: string;
  name: string;
  coverArt?: string;
  musicBrainzId?: string;
  starred?: string;
}

interface RawAlbum {
  id: string;
  name: string;
  year?: number;
  coverArt?: string;
  genre?: string;
  playCount?: number;
  musicBrainzId?: string;
  originalReleaseDate?: { year?: number };
  genres?: Array<{ name: string }>;
  moods?: Array<{ name: string }>;
}

function albumFromRaw(a: RawAlbum): CachedAlbum {
  const genreStrings = new Set<string>();
  if (a.genre) genreStrings.add(a.genre);
  for (const g of a.genres ?? []) {
    if (g?.name) genreStrings.add(g.name);
  }
  const moodStrings = new Set<string>();
  for (const m of a.moods ?? []) {
    if (m?.name) moodStrings.add(m.name);
  }
  return {
    id: a.id,
    name: a.name,
    year: a.year,
    originalYear: a.originalReleaseDate?.year,
    coverArtId: a.coverArt,
    playCount: a.playCount,
    genreStrings: [...genreStrings],
    moodStrings: [...moodStrings],
    mbid: a.musicBrainzId,
  };
}

async function fetchArtistOnce(client: SubsonicClient, ref: RawArtistRef): Promise<CachedArtist> {
  const [detail, info] = await Promise.all([
    client.getArtist(ref.id),
    client.getArtistInfo2(ref.id).catch(() => null),
  ]);
  const rawAlbums = (detail.artist as unknown as { album?: RawAlbum[] }).album ?? [];
  const albums = rawAlbums.map(albumFromRaw);
  const playCount = albums.reduce((s, a) => s + (a.playCount ?? 0), 0);
  const info2 = info?.artistInfo2;
  const bio = info2?.biography;
  const similar = info2?.similarArtist?.map((s) => s.id).filter(Boolean);
  return {
    id: ref.id,
    name: ref.name,
    mbid: ref.musicBrainzId,
    coverArtId: ref.coverArt,
    starred: !!ref.starred,
    albums,
    playCount,
    bio: bio && bio !== "undefined" ? bio : undefined,
    similarArtistIds: similar && similar.length ? similar : undefined,
    raw: {
      artist: detail,
      info,
    },
  };
}

export interface IngestOptions {
  /** When true, ignore on-disk cache and re-fetch everything. */
  refresh?: boolean;
  /** Optional cap for quick smoke runs. */
  limit?: number;
  /** Progress callback. */
  onProgress?: (done: number, total: number, name: string) => void;
}

export interface IngestResult {
  artists: CachedArtist[];
  fromCache: number;
  fetched: number;
}

/**
 * Full library ingest. Walks getArtists, then fetches per-artist data with
 * concurrency. Caches to data/cache/navidrome/<artistId>.json so re-runs are
 * cheap.
 */
export async function ingestAll(options: IngestOptions = {}): Promise<IngestResult> {
  const { client, error } = clientFromEnv();
  if (!client) throw new Error(error ?? "no client");

  const list = await client.getArtists();
  const refs: RawArtistRef[] = (list.artists.index ?? []).flatMap(
    (i) => (i.artist ?? []) as RawArtistRef[],
  );
  const trimmed = options.limit ? refs.slice(0, options.limit) : refs;

  let fromCache = 0;
  let fetched = 0;
  const total = trimmed.length;
  let done = 0;

  const limit = pLimit(6);
  const results = await Promise.all(
    trimmed.map((ref) =>
      limit(async () => {
        const cachePath = resolve(cacheDir(), "navidrome", `${ref.id}.json`);
        let entry: CachedArtist | null = null;
        if (!options.refresh) {
          entry = await readJson<CachedArtist>(cachePath);
          if (entry) fromCache++;
        }
        if (!entry) {
          entry = await fetchArtistOnce(client, ref);
          await writeJson(cachePath, entry);
          fetched++;
        }
        done++;
        options.onProgress?.(done, total, ref.name);
        return entry;
      }),
    ),
  );

  return { artists: results, fromCache, fetched };
}
