import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { workspaceRoot, dataDir } from "./env.ts";

describe("env helpers", () => {
    it("workspaceRoot resolves to the monorepo root (contains package.json)", () => {
        const root = workspaceRoot();
        expect(existsSync(`${root}/package.json`)).toBe(true);
    });

    it("dataDir is <workspaceRoot>/data", () => {
        expect(dataDir()).toBe(`${workspaceRoot()}/data`);
    });
});
