import { describe, it, expect } from "vitest";
import { authParams, endpoint } from "./auth.js";

describe("authParams", () => {
  it("includes the standard Subsonic fields", () => {
    const p = authParams({
      url: "http://x",
      user: "alice",
      password: "secret",
      client: "music-mindmap",
      version: "1.16.1",
    });
    expect(p.get("u")).toBe("alice");
    expect(p.get("c")).toBe("music-mindmap");
    expect(p.get("v")).toBe("1.16.1");
    expect(p.get("f")).toBe("json");
    expect(p.get("s")).toMatch(/^[0-9a-f]+$/);
    expect(p.get("t")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("uses a fresh salt each call", () => {
    const a = authParams({
      url: "",
      user: "u",
      password: "p",
      client: "c",
      version: "v",
    });
    const b = authParams({
      url: "",
      user: "u",
      password: "p",
      client: "c",
      version: "v",
    });
    expect(a.get("s")).not.toEqual(b.get("s"));
    expect(a.get("t")).not.toEqual(b.get("t"));
  });
});

describe("endpoint", () => {
  it("strips trailing slashes", () => {
    expect(endpoint("http://x/", "ping")).toBe("http://x/rest/ping.view");
    expect(endpoint("http://x///", "getArtists")).toBe("http://x/rest/getArtists.view");
  });
});
