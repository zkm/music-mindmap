import { createHash, randomBytes } from "node:crypto";

export interface SubsonicAuth {
  url: string;
  user: string;
  password: string;
  client: string;
  version: string;
}

/**
 * Build the auth query params for a Subsonic request.
 * Uses salt + md5(password + salt) — the standard Subsonic auth flow.
 * A fresh salt is generated per call to avoid replay reuse.
 */
export function authParams(auth: SubsonicAuth): URLSearchParams {
  const salt = randomBytes(8).toString("hex");
  const token = createHash("md5").update(auth.password + salt).digest("hex");
  return new URLSearchParams({
    u: auth.user,
    t: token,
    s: salt,
    v: auth.version,
    c: auth.client,
    f: "json",
  });
}

/** Join base URL + Subsonic endpoint path. Handles trailing slashes. */
export function endpoint(baseUrl: string, name: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/rest/${name}.view`;
}
