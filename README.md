# Music Mind Map

A mind-map view of a Navidrome library: artists are clustered by AI-derived
tags (genre / subgenre / mood / era / region), and the graph is sized by
either tag popularity or your own play counts.

```
┌─────────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Navidrome /        │    │  @mm/tagger      │    │  @mm/server      │
│  Subsonic REST      │───▶│  normalize +     │───▶│  Fastify + media │
│  (361 artists)      │    │  buildGraph      │    │  proxy           │
└─────────────────────┘    └──────────────────┘    └──────────────────┘
                                  │                          │
                                  ▼                          ▼
                          data/graph.json            apps/web (Vite +
                          data/artists.json          React + Cytoscape
                          data/unmapped-tags.json    fcose)
```

## Layout

```
music-mindmap/
  apps/
    server/   Fastify: serves data/*.json + proxies cover art / preview audio
    web/      Vite + React + Cytoscape (fcose layout, dark UI)
  packages/
    shared-types/      Graph / Tag / EnrichedArtist types
    subsonic-client/   Token+salt Subsonic client (undici)
    tagger/            Taxonomy + normalize + ingest CLI + graph builder
  data/                Output of the tagger (git-ignored)
  .env                 Navidrome creds (git-ignored)
```

## One-time setup

```bash
corepack enable                # ensures yarn 4.x
yarn install
cp .env.example .env           # fill in NAVIDROME_URL / USER / PASSWORD
```

The minimum `.env` for ingest + UI:

```
NAVIDROME_URL=http://navipi:4533
NAVIDROME_USER=zkm
NAVIDROME_PASSWORD=••••
# Optional: enables MusicBrainz region tagging (please supply a real UA)
MB_USER_AGENT=music-mindmap/0.1 (you@example.com)
```

## Day-to-day commands

| Command               | What it does                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `yarn ping`           | Connectivity check against Navidrome — should print artist count                                                                 |
| `yarn ingest`         | Pulls all artists+albums, normalizes tags, writes `data/{graph,artists,unmapped-tags}.json`. Uses on-disk cache; safe to re-run. |
| `yarn ingest:refresh` | Same, but ignores cache (call after Navidrome changes)                                                                           |
| `yarn dev`            | Runs `@mm/server` and `@mm/web` together — open <http://localhost:5175>                                                          |
| `yarn build`          | Builds the web bundle into `apps/web/dist`                                                                                       |
| `yarn start`          | Serves the built bundle from Fastify on `PORT` (default 5173)                                                                    |
| `yarn typecheck`      | All workspaces                                                                                                                   |
| `yarn test`           | Vitest across all workspaces                                                                                                     |

## GitHub Pages / static demo mode

GitHub Pages cannot serve the backend API (`/api/graph`, `/api/artists`, `/media/*`).
For static hosting, the web app supports bundled mock data.

Use this when building the web app for Pages:

```bash
VITE_USE_MOCK=true VITE_BASE_URL=/music-mindmap/ yarn workspace @mm/web build
```

- `VITE_USE_MOCK=true` forces local mock graph/artist data.
- `VITE_BASE_URL=/music-mindmap/` sets the asset base path for a project page.
- If `VITE_USE_MOCK` is not set, the app still auto-falls back to mock data when API calls fail.

## How the mind map is built

1. **Ingest** (`@mm/tagger ingest`): for every artist in the library, fetch
   `getArtist` + `getArtistInfo2` from Navidrome's Subsonic API. Cache the
   raw responses per artist under `data/cache/navidrome/<id>.json`.
2. **Normalize** (`@mm/tagger/normalize`): collapse raw genre / mood strings
   into a curated taxonomy (`@mm/tagger/taxonomy`). Reject artist-name noise,
   route decade-shaped strings (`90s`, `70S`) to era tags, slug-match as a
   fallback. Album years drive an additional `era` tag per artist.
3. **Region (optional)**: if `MB_USER_AGENT` is set and the artist has an
   `mbid`, look up the MusicBrainz area at 1 rps and map it to a region tag.
4. **Build graph** (`@mm/tagger build`): nodes = curated tags carried by ≥2
   artists; edges = co-occurrence weighted by artist count. Node size mixes
   artist count with `log(1 + play count)` so heavily-played tags dominate
   visually when "Weight by plays" is on.
5. **Serve** (`@mm/server`): static-serves the web app and proxies
   `/media/cover/:id` + `/media/stream/:id` through to Navidrome — your
   browser never sees Subsonic credentials.

## Troubleshooting

- **`yarn ping` fails:** Most often a wrong `NAVIDROME_PASSWORD` (Subsonic
  hashes it with a per-request salt, so a typo shows as "Wrong username or
  password"). Double-check from a `curl` against `/rest/ping.view`.
- **`/api/graph` returns 503:** Run `yarn ingest` first.
- **No tag matches in graph:** Inspect `data/unmapped-tags.json` — the top
  entries are the cheapest taxonomy wins. Add them to
  `packages/tagger/src/taxonomy.ts` and re-run `yarn ingest` (cached data is
  reused; no extra API calls).
- **MusicBrainz lookups failing:** They're disabled unless `MB_USER_AGENT`
  is set, and limited to 1 rps as the MB ToS requires.
