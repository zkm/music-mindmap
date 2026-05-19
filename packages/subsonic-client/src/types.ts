/**
 * Minimal types for the subset of Subsonic responses we consume.
 * Subsonic's actual schema is messier (string-or-array, missing fields),
 * so consumers should treat these as best-effort.
 */

export interface SubsonicEnvelope<T> {
  "subsonic-response": {
    status: "ok" | "failed";
    version: string;
    type?: string;
    serverVersion?: string;
    error?: { code: number; message: string };
  } & T;
}

export interface ArtistRef {
  id: string;
  name: string;
  coverArt?: string;
  artistImageUrl?: string;
  albumCount?: number;
  starred?: string;
}

export interface ArtistIndex {
  name: string;
  artist?: ArtistRef[];
}

export interface ArtistsList {
  artists: {
    ignoredArticles?: string;
    index?: ArtistIndex[];
  };
}

export interface AlbumRef {
  id: string;
  name: string;
  artist?: string;
  artistId?: string;
  year?: number;
  songCount?: number;
  duration?: number;
  coverArt?: string;
  genre?: string;
  playCount?: number;
  starred?: string;
}

export interface ArtistDetail {
  artist: ArtistRef & {
    album?: AlbumRef[];
  };
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  year?: number;
  genre?: string;
  /** Newer servers expose multiple genres here. */
  genres?: Array<{ name: string }>;
  playCount?: number;
  duration?: number;
  starred?: string;
}

export interface AlbumDetail {
  album: AlbumRef & {
    song?: Song[];
  };
}

export interface ArtistInfo2 {
  artistInfo2: {
    biography?: string;
    musicBrainzId?: string;
    lastFmUrl?: string;
    smallImageUrl?: string;
    mediumImageUrl?: string;
    largeImageUrl?: string;
    similarArtist?: ArtistRef[];
  };
}

export interface Genres {
  genres: {
    genre?: Array<{ value: string; songCount?: number; albumCount?: number }>;
  };
}

export interface Starred2 {
  starred2: {
    artist?: ArtistRef[];
    album?: AlbumRef[];
    song?: Song[];
  };
}
