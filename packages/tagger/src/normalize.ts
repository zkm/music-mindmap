import { slugify } from "./slug.ts";
import { SYNONYMS, TAG_BY_ID } from "./taxonomy.ts";

/** Strings that look like decade tags such as "90s", "70S", "1990s". */
const ERA_RE = /^(?:(?:19|20)?(\d0))s$/i;

/** Map raw genre/mood text to a taxonomy id, or null if unrecognized. */
export function mapTag(raw: string, artistName?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Filter artist-name noise that some sources inject into the genre stream.
  if (artistName && trimmed.toLowerCase() === artistName.toLowerCase()) {
    return null;
  }

  // Era-shaped raw strings (e.g. "90s", "1990s", "70S") map straight to era ids.
  const eraMatch = trimmed.match(ERA_RE);
  if (eraMatch) {
    const decade = eraMatch[1]!;
    const candidate = `${decade}s`; // "90s", "00s", "10s", ...
    const normalized =
      candidate === "00s" ? "2000s" :
      candidate === "10s" ? "2010s" :
      candidate === "20s" ? "2020s" :
      candidate;
    if (TAG_BY_ID[normalized]) return normalized;
  }

  const lower = trimmed.toLowerCase();
  if (SYNONYMS[lower]) return SYNONYMS[lower]!;

  // Secondary: slug match against canonical ids.
  const slug = slugify(trimmed);
  if (TAG_BY_ID[slug]) return slug;
  if (SYNONYMS[slug]) return SYNONYMS[slug]!;

  return null;
}

export function mapTags(raws: string[], artistName?: string): string[] {
  const out = new Set<string>();
  for (const r of raws) {
    const m = mapTag(r, artistName);
    if (m) out.add(m);
  }
  return [...out];
}

/** Bucket a release year into a decade era tag id. */
export function eraForYear(year: number | undefined): string | null {
  if (typeof year !== "number" || !Number.isFinite(year) || year <= 0) {
    return null;
  }
  if (year < 1950) return "pre-50s";
  if (year < 1960) return "50s";
  if (year < 1970) return "60s";
  if (year < 1980) return "70s";
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  if (year < 2010) return "2000s";
  if (year < 2020) return "2010s";
  return "2020s";
}

/**
 * Map a MusicBrainz `area.name` / `country` to a region tag id.
 * Intentionally coarse — we want broad clusters, not nation-states.
 */
const REGION_MAP: Record<string, string> = {
  "united states": "us",
  "usa": "us",
  "us": "us",
  "u.s.": "us",
  "u.s.a.": "us",
  "united kingdom": "uk",
  "uk": "uk",
  "england": "uk",
  "scotland": "uk",
  "wales": "uk",
  "northern ireland": "uk",
  "great britain": "uk",
  "ireland": "ireland",
  "canada": "canada",
  "australia": "australia",
  "germany": "germany",
  "west germany": "germany",
  "east germany": "germany",
  "france": "france",
  "japan": "japan",
  "mexico": "latin-america",
  "brazil": "latin-america",
  "argentina": "latin-america",
  "colombia": "latin-america",
  "cuba": "latin-america",
  "chile": "latin-america",
  "peru": "latin-america",
  "south africa": "africa",
  "nigeria": "africa",
  "mali": "africa",
  "senegal": "africa",
  "ethiopia": "africa",
};

export function regionForArea(area: string | undefined | null): string | null {
  if (!area) return null;
  const key = area.trim().toLowerCase();
  return REGION_MAP[key] ?? null;
}
