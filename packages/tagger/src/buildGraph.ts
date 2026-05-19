import type {
  AlbumLite,
  ArtistsDoc,
  EnrichedArtist,
  Graph,
  TagEdge,
  TagNode,
} from "@mm/shared-types";
import { eraForYear, mapTags, regionForArea } from "./normalize.ts";
import { slugify } from "./slug.ts";
import { TAG_BY_ID } from "./taxonomy.ts";
import type { CachedArtist } from "./ingest.ts";
import { lookupMbArtist, mbEnabled } from "./sources/musicbrainz.ts";
import { llmEnabled, suggestTagsForArtist } from "./sources/llm.ts";

export interface BuildOptions {
  /** Drop edges with fewer than this many co-occurrences. */
  minEdgeWeight?: number;
  /** Drop tag nodes with fewer than this many artists. */
  minNodeArtists?: number;
  /** Trigger LLM fallback when an artist has fewer than this many tags. */
  llmThreshold?: number;
  /** α in: weight = artistCount + α · log(1 + sumPlayCount). */
  playCountWeightAlpha?: number;
  /** Build deep links into Navidrome UI; needs base URL. */
  navidromeBaseUrl?: string;
}

export interface BuildResult {
  graph: Graph;
  artistsDoc: ArtistsDoc;
  /** Raw genre strings we saw that didn't map to anything. */
  unmappedRawTags: Record<string, number>;
}

function uniq<T>(xs: Iterable<T>): T[] {
  return [...new Set(xs)];
}

function buildNavidromeUrl(base: string | undefined, artistId: string): string | undefined {
  if (!base) return undefined;
  return `${base.replace(/\/+$/, "")}/app/#/artist/${encodeURIComponent(artistId)}/show`;
}

/**
 * Enrich one cached artist with normalized tags drawn from all sources.
 * Side effect: returns the union of *raw* unmapped tags via `unmappedSink`.
 */
async function enrichOne(
  artist: CachedArtist,
  opts: BuildOptions,
  unmappedSink: Map<string, number>,
): Promise<EnrichedArtist> {
  const embedded: string[] = [];
  const moods: string[] = [];
  for (const al of artist.albums) {
    embedded.push(...al.genreStrings);
    moods.push(...al.moodStrings);
  }
  const allRaws = uniq([...embedded, ...moods]);
  const mapped = new Set(mapTags(allRaws, artist.name));

  // Track unmapped raws for visibility into taxonomy gaps.
  for (const r of allRaws) {
    const dummy = mapTags([r], artist.name);
    if (dummy.length === 0) {
      const key = r.trim();
      if (key) unmappedSink.set(key, (unmappedSink.get(key) ?? 0) + 1);
    }
  }

  // Era tags from album years (prefer originalReleaseDate when present).
  const years = artist.albums
    .map((a) => a.originalYear ?? a.year)
    .filter((y): y is number => typeof y === "number" && y > 0);
  let yearMin: number | undefined;
  let yearMax: number | undefined;
  if (years.length) {
    yearMin = Math.min(...years);
    yearMax = Math.max(...years);
    for (const y of years) {
      const era = eraForYear(y);
      if (era) mapped.add(era);
    }
  }

  // Region from MusicBrainz (optional).
  let mbArea: string | undefined;
  if (mbEnabled() && artist.mbid) {
    const mb = await lookupMbArtist(artist.mbid);
    const area = mb?.area?.name ?? mb?.country;
    if (area) {
      mbArea = area;
      const reg = regionForArea(area);
      if (reg) mapped.add(reg);
    }
  }

  let llmTags: string[] | undefined;
  if (llmEnabled() && mapped.size < (opts.llmThreshold ?? 2)) {
    const r = await suggestTagsForArtist({
      artistName: artist.name,
      bio: artist.bio,
      existingTagIds: [...mapped],
    });
    if (r.tags.length) {
      llmTags = r.tags;
      for (const t of r.tags) if (TAG_BY_ID[t]) mapped.add(t);
    }
  }

  const topAlbums: AlbumLite[] = artist.albums
    .slice()
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      name: a.name,
      year: a.originalYear ?? a.year,
      coverArtId: a.coverArtId,
      playCount: a.playCount,
      genres: a.genreStrings,
    }));

  return {
    id: artist.id,
    name: artist.name,
    slug: slugify(artist.name) || artist.id,
    coverArtId: artist.coverArtId,
    mbid: artist.mbid,
    yearMin,
    yearMax,
    playCount: artist.playCount,
    starred: artist.starred,
    tags: [...mapped].sort(),
    rawTags: {
      embedded: uniq(embedded),
      artistInfo: undefined,
      mbArea,
      llm: llmTags,
    },
    topAlbums,
    similarArtistIds: artist.similarArtistIds,
    bio: artist.bio,
    navidromeUrl: buildNavidromeUrl(opts.navidromeBaseUrl, artist.id),
  };
}

export async function buildGraph(
  cached: CachedArtist[],
  options: BuildOptions = {},
): Promise<BuildResult> {
  const minEdge = options.minEdgeWeight ?? 2;
  const minNode = options.minNodeArtists ?? 2;
  const alpha = options.playCountWeightAlpha ?? 1;

  const unmapped = new Map<string, number>();
  const enriched: EnrichedArtist[] = [];
  for (const c of cached) {
    enriched.push(await enrichOne(c, options, unmapped));
  }

  // --- node weights
  const artistsByTag = new Map<string, Set<string>>();
  const playByTag = new Map<string, number>();
  for (const a of enriched) {
    for (const tid of a.tags) {
      let set = artistsByTag.get(tid);
      if (!set) {
        set = new Set();
        artistsByTag.set(tid, set);
      }
      set.add(a.id);
      playByTag.set(tid, (playByTag.get(tid) ?? 0) + (a.playCount ?? 0));
    }
  }

  const nodes: TagNode[] = [];
  for (const [tid, set] of artistsByTag) {
    const def = TAG_BY_ID[tid];
    if (!def) continue;
    const artistCount = set.size;
    if (artistCount < minNode) continue;
    const playCount = playByTag.get(tid) ?? 0;
    const weight = artistCount + alpha * Math.log(1 + playCount);
    nodes.push({
      ...def,
      artistCount,
      playCount,
      weight: Number(weight.toFixed(3)),
    });
  }
  nodes.sort((a, b) => b.weight - a.weight);

  const keptTagIds = new Set(nodes.map((n) => n.id));

  // --- edges (co-occurrence)
  const edgeWeights = new Map<string, number>();
  for (const a of enriched) {
    const tags = a.tags.filter((t) => keptTagIds.has(t)).sort();
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = `${tags[i]}|${tags[j]}`;
        edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
      }
    }
  }
  const edges: TagEdge[] = [];
  for (const [key, w] of edgeWeights) {
    if (w < minEdge) continue;
    const [source, target] = key.split("|") as [string, string];
    edges.push({ source, target, weight: w });
  }
  edges.sort((a, b) => b.weight - a.weight);

  // --- by-tag index (post-filter)
  const byTag: Record<string, string[]> = {};
  for (const a of enriched) {
    for (const t of a.tags) {
      if (!keptTagIds.has(t)) continue;
      (byTag[t] ??= []).push(a.id);
    }
  }
  for (const t of Object.keys(byTag)) {
    byTag[t]!.sort((idA, idB) => {
      const A = enriched.find((x) => x.id === idA)!;
      const B = enriched.find((x) => x.id === idB)!;
      return (B.playCount ?? 0) - (A.playCount ?? 0) || A.name.localeCompare(B.name);
    });
  }

  const taggedArtistCount = enriched.filter((a) => a.tags.some((t) => keptTagIds.has(t))).length;

  const graph: Graph = {
    nodes,
    edges,
    generatedAt: new Date().toISOString(),
    stats: {
      artistCount: enriched.length,
      taggedArtistCount,
      rawTagCount: unmapped.size,
    },
  };

  const artistsDoc: ArtistsDoc = {
    generatedAt: graph.generatedAt,
    artists: enriched,
    byTag,
  };

  return {
    graph,
    artistsDoc,
    unmappedRawTags: Object.fromEntries([...unmapped.entries()].sort((a, b) => b[1] - a[1])),
  };
}
