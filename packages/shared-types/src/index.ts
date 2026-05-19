/**
 * Shared types for the Music Mind Map.
 * Kept intentionally minimal and JSON-serializable.
 */

export type TagCategory =
  | "genre"
  | "subgenre"
  | "mood"
  | "era"
  | "region"
  | "energy"
  | "vocal"
  | "instrument";

export interface TagDef {
  /** Stable kebab-case id, e.g. "alt-rock", "blues". */
  id: string;
  /** Human label, e.g. "Alt Rock". */
  label: string;
  category: TagCategory;
}

/** A tag as it appears on the graph (post-aggregation). */
export interface TagNode extends TagDef {
  /** Count of artists carrying this tag. */
  artistCount: number;
  /** Sum of play counts across artists carrying this tag. */
  playCount: number;
  /** Final visual weight (combined artistCount + log play count). */
  weight: number;
}

export interface TagEdge {
  source: string;
  target: string;
  /** Number of artists carrying both tags. */
  weight: number;
}

export interface Graph {
  nodes: TagNode[];
  edges: TagEdge[];
  /** When the graph was built (ISO). */
  generatedAt: string;
  /** Source statistics. */
  stats: {
    artistCount: number;
    taggedArtistCount: number;
    rawTagCount: number;
  };
}

export interface AlbumLite {
  id: string;
  name: string;
  year?: number;
  coverArtId?: string;
  playCount?: number;
  genres?: string[];
}

export interface EnrichedArtist {
  /** Navidrome/Subsonic artist id. */
  id: string;
  name: string;
  /** Slugified name for URL paths. */
  slug: string;
  /** Subsonic coverArt id (often == artist id). */
  coverArtId?: string;
  /** MusicBrainz id, when known. */
  mbid?: string;
  /** Min/max album year. */
  yearMin?: number;
  yearMax?: number;
  /** Aggregate play count across this artist's tracks. */
  playCount: number;
  starred: boolean;
  /** Final normalized taxonomy tag ids. */
  tags: string[];
  /** Raw tags from each source, kept for transparency / debugging. */
  rawTags: {
    embedded?: string[];
    similarFrom?: string[];
    artistInfo?: string[];
    mbArea?: string;
    llm?: string[];
  };
  /** Up to N top albums. */
  topAlbums: AlbumLite[];
  /** Similar-artist ids from Navidrome (truncated). */
  similarArtistIds?: string[];
  /** Bio summary (plain text). */
  bio?: string;
  /** Deep link into Navidrome web UI (built server-side). */
  navidromeUrl?: string;
}

export interface ArtistsDoc {
  generatedAt: string;
  artists: EnrichedArtist[];
  /** Tag-id -> artist-ids index for fast side-panel lookup. */
  byTag: Record<string, string[]>;
}
