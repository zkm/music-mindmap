import { describe, expect, it } from "vitest";
import { eraForYear, mapTag, mapTags, regionForArea } from "./normalize.ts";

describe("mapTag", () => {
    it("maps simple genres", () => {
        expect(mapTag("Rock")).toBe("rock");
        expect(mapTag("Alternative Rock")).toBe("alt-rock");
        expect(mapTag("Hip-Hop")).toBe("hip-hop");
        expect(mapTag("hip hop")).toBe("hip-hop");
    });

    it("routes era-shaped genre strings to era tags", () => {
        expect(mapTag("90s")).toBe("90s");
        expect(mapTag("70S")).toBe("70s");
    });

    it("maps moods", () => {
        expect(mapTag("Mellow")).toBe("mellow");
        expect(mapTag("Sad")).toBe("melancholic");
    });

    it("rejects artist name as tag", () => {
        expect(mapTag("Foo Fighters", "Foo Fighters")).toBeNull();
    });

    it("returns null for unknown tags", () => {
        expect(mapTag("zzz unknown")).toBeNull();
    });

    it("dedupes via mapTags", () => {
        const out = mapTags(["Rock", "rock", "Hard Rock"]);
        expect(out.sort()).toEqual(["hard-rock", "rock"]);
    });
});

describe("eraForYear", () => {
    it("buckets decades", () => {
        expect(eraForYear(1997)).toBe("90s");
        expect(eraForYear(2009)).toBe("2000s");
        expect(eraForYear(2024)).toBe("2020s");
        expect(eraForYear(1948)).toBe("pre-50s");
        expect(eraForYear(undefined)).toBeNull();
    });
});

describe("regionForArea", () => {
    it("maps common areas", () => {
        expect(regionForArea("United States")).toBe("us");
        expect(regionForArea("England")).toBe("uk");
        expect(regionForArea("zzz")).toBeNull();
    });
});
