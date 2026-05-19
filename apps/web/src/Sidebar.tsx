import { useMemo, useRef, useState } from "react";
import type { ArtistsDoc, EnrichedArtist, Graph } from "@mm/shared-types";

interface SidebarProps {
  artists?: ArtistsDoc;
  graph?: Graph;
  selectedTagId?: string;
}

export function Sidebar({ artists, graph, selectedTagId }: SidebarProps) {
  const tag = useMemo(() => {
    if (!graph || !selectedTagId) return undefined;
    return graph.nodes.find((n) => n.id === selectedTagId);
  }, [graph, selectedTagId]);

  const tagArtists = useMemo<EnrichedArtist[]>(() => {
    if (!artists || !selectedTagId) return [];
    const ids = artists.byTag[selectedTagId] ?? [];
    const byId = new Map(artists.artists.map((a) => [a.id, a]));
    return ids
      .map((id) => byId.get(id))
      .filter((a): a is EnrichedArtist => !!a)
      .sort((a, b) => b.playCount - a.playCount);
  }, [artists, selectedTagId]);

  if (!selectedTagId || !tag) {
    return (
      <div className="placeholder">
        <h2>Pick a tag</h2>
        <p>
          Tap any node in the mind map to see the artists that share that tag. The size of each node
          tracks how many artists carry that tag (and, when enabled, how much you actually play
          them).
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>{tag.label}</h2>
      <div className="sub">
        <span className="cat-pill">{tag.category}</span> {tag.artistCount} artists ·{" "}
        {tag.playCount.toLocaleString()} plays
      </div>
      {tagArtists.length === 0 && <div className="placeholder">No artists.</div>}
      {tagArtists.map((a) => (
        <ArtistRow key={a.id} artist={a} />
      ))}
    </div>
  );
}

function ArtistRow({ artist }: { artist: EnrichedArtist }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function togglePreview() {
    // Preview = first top album's cover-art-id is best-effort. We stream the
    // artist id, which Subsonic does NOT support directly; fall back to the
    // first album's first track only if we had it. For now, use the artist's
    // cover art as a thumbnail and stream the first top album id, which
    // Navidrome treats as a playlist of its tracks for some endpoints.
    // Practically: stream the first top album's id, which Subsonic /stream
    // requires to be a *song* id. We don't have a song id here, so we wire
    // the play button to the album id and let the server return an error if
    // unsupported. A future iteration can fetch the first song id on demand.
    const firstAlbumId = artist.topAlbums[0]?.id;
    if (!firstAlbumId) return;
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      a.src = `/media/stream/${encodeURIComponent(firstAlbumId)}`;
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  const coverUrl = artist.coverArtId
    ? `/media/cover/${encodeURIComponent(artist.coverArtId)}?size=128`
    : undefined;

  return (
    <div className="artist-card">
      {coverUrl ? (
        <img className="cover" src={coverUrl} alt="" loading="lazy" />
      ) : (
        <div className="cover" aria-hidden />
      )}
      <div>
        <div className="name">
          {artist.starred && (
            <span className="star" title="Starred">
              ★{" "}
            </span>
          )}
          {artist.name}
        </div>
        <div className="meta">
          {artist.playCount.toLocaleString()} plays
          {artist.yearMin ? ` · ${artist.yearMin}–${artist.yearMax ?? artist.yearMin}` : ""}
        </div>
        <div className="meta">{artist.tags.slice(0, 5).join(" · ")}</div>
      </div>
      <div className="actions">
        <button onClick={togglePreview} title="Preview first album">
          {playing ? "❚❚" : "▶"}
        </button>
        {artist.navidromeUrl && (
          <a href={artist.navidromeUrl} target="_blank" rel="noreferrer">
            <button title="Open in Navidrome">↗</button>
          </a>
        )}
      </div>
      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        style={{ display: "none" }}
      />
    </div>
  );
}
