import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { Sidebar } from "./Sidebar.tsx";
import type { ArtistsDoc, Graph } from "@mm/shared-types";

afterEach(cleanup);

const mockGraph: Graph = {
    nodes: [
        {
            id: "rock",
            label: "Rock",
            category: "genre",
            artistCount: 3,
            playCount: 500,
            weight: 4,
        },
    ],
    edges: [],
    generatedAt: "2024-01-01T00:00:00Z",
    stats: { artistCount: 10, taggedArtistCount: 8, rawTagCount: 15 },
};

const mockArtists: ArtistsDoc = {
    generatedAt: "2024-01-01T00:00:00Z",
    artists: [],
    byTag: { rock: [] },
};

describe("Sidebar", () => {
    it("shows placeholder when no tag is selected", () => {
        render(<Sidebar />);
        expect(screen.getByText("Pick a tag")).toBeTruthy();
    });

    it("shows tag details when a tag is selected", () => {
        render(<Sidebar graph={mockGraph} artists={mockArtists} selectedTagId="rock" />);
        expect(screen.getByText("Rock")).toBeTruthy();
        expect(screen.getByText(/3 artists/)).toBeTruthy();
    });

    it("shows 'No artists' when the tag has no linked artists", () => {
        render(<Sidebar graph={mockGraph} artists={mockArtists} selectedTagId="rock" />);
        expect(screen.getByText("No artists.")).toBeTruthy();
    });
});
