/**
 * Probe: dump a sample artist's getArtist + getAlbum + getArtistInfo2 + getGenres
 * responses so we can see which fields Navidrome actually populates.
 *
 * Run: yarn workspace @mm/subsonic-client exec tsx src/probe.ts [artistName]
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { clientFromEnv } from "./index.js";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });

async function main(): Promise<void> {
  const target = (process.argv[2] || "Foo Fighters").toLowerCase();
  const { client, error } = clientFromEnv();
  if (!client) {
    console.error(error);
    process.exit(2);
  }

  const list = await client.getArtists();
  const all = (list.artists.index ?? []).flatMap((i) => i.artist ?? []);
  const hit = all.find((a) => a.name.toLowerCase() === target) ?? all[0];
  if (!hit) {
    console.error("No artists in library");
    process.exit(1);
  }
  console.log(`-- ArtistRef from getArtists --`);
  console.log(JSON.stringify(hit, null, 2));

  const detail = await client.getArtist(hit.id);
  console.log(`\n-- getArtist(${hit.id}) --`);
  console.log(JSON.stringify(detail, null, 2));

  const firstAlbumId = detail.artist.album?.[0]?.id;
  if (firstAlbumId) {
    const album = await client.getAlbum(firstAlbumId);
    console.log(`\n-- getAlbum(${firstAlbumId}) --`);
    // Print album minus the bulk of songs, but keep first 2 songs for shape.
    const slim = {
      ...album,
      album: {
        ...album.album,
        song: album.album.song?.slice(0, 2),
      },
    };
    console.log(JSON.stringify(slim, null, 2));
  }

  const info = await client.getArtistInfo2(hit.id);
  console.log(`\n-- getArtistInfo2(${hit.id}) --`);
  // Trim biography for readability.
  const slimInfo = {
    artistInfo2: {
      ...info.artistInfo2,
      biography: info.artistInfo2.biography?.slice(0, 300) + "...",
      similarArtist: info.artistInfo2.similarArtist?.slice(0, 5),
    },
  };
  console.log(JSON.stringify(slimInfo, null, 2));

  const genres = await client.getGenres();
  console.log(`\n-- getGenres (top 20 by songCount) --`);
  const sorted = (genres.genres.genre ?? [])
    .slice()
    .sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0))
    .slice(0, 20);
  console.log(JSON.stringify(sorted, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
