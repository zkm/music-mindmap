import { describe, expect, it } from "vitest";
import { buildGraph } from "./buildGraph.ts";
import type { CachedArtist } from "./ingest.ts";

function artist(name: string, genres: string[], year = 2000, plays = 0): CachedArtist {
    return {
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        starred: false,
        playCount: plays,
        albums: [
            {
                id: `${name}-album`,
                name: "X",
                year,
                originalYear: year,
                coverArtId: undefined,
                playCount: plays,
                genreStrings: genres,
                moodStrings: [],
            },
        ],
        raw: { artist: null, info: null },
    };
}

describe("buildGraph", () => {
    it("produces nodes and edges from co-occurrence", async () => {
        const cached: CachedArtist[] = [
            artist("Foo Fighters", ["Alternative Rock", "Grunge", "Hard Rock"], 1997, 50),
            artist("Pearl Jam", ["Alternative Rock", "Grunge"], 1991, 30),
            artist("Soundgarden", ["Grunge", "Hard Rock"], 1994, 20),
            artist("Nirvana", ["Grunge", "Alternative Rock"], 1991, 100),
            artist("Bob Dylan", ["Folk", "Singer-Songwriter"], 1965, 10),
        ];
        const { graph } = await buildGraph(cached, {
            minEdgeWeight: 2,
            minNodeArtists: 2,
        });
        const nodeIds = graph.nodes.map((n) => n.id).sort();
        expect(nodeIds).toContain("grunge");
        expect(nodeIds).toContain("alt-rock");
        expect(nodeIds).toContain("90s");
        // Folk + singer-songwriter only on one artist -> filtered out by minNodeArtists.
        expect(nodeIds).not.toContain("folk");

        const grungeAltRock = graph.edges.find(
            (e) =>
                (e.source === "grunge" && e.target === "alt-rock") ||
                (e.source === "alt-rock" && e.target === "grunge"),
        );
        expect(grungeAltRock?.weight).toBe(3);
    });

    it("weight grows with play count", async () => {
        const low = await buildGraph(
            [artist("A", ["Rock"], 2000, 1), artist("B", ["Rock"], 2000, 1)],
            {
                minNodeArtists: 1,
                minEdgeWeight: 1,
            },
        );
        const high = await buildGraph(
            [artist("A", ["Rock"], 2000, 1000), artist("B", ["Rock"], 2000, 1000)],
            { minNodeArtists: 1, minEdgeWeight: 1 },
        );
        const lw = low.graph.nodes.find((n) => n.id === "rock")!.weight;
        const hw = high.graph.nodes.find((n) => n.id === "rock")!.weight;
        expect(hw).toBeGreaterThan(lw);
    });
});
