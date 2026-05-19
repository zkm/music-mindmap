/**
 * LLM fallback hook for artists with too few normalized tags after
 * Navidrome + MusicBrainz. Disabled by default — controlled by LLM_PROVIDER.
 *
 * To enable later, populate LLM_PROVIDER=ollama|openai|anthropic in .env and
 * implement the provider calls below. We intentionally leave the body as a
 * stub so v1 stays Navidrome-only; the env flag in normalize/buildGraph
 * decides whether to call this at all.
 */
export interface LlmTagsResult {
    /** Tag ids from our taxonomy. Empty array if disabled or no result. */
    tags: string[];
}

export function llmEnabled(): boolean {
    const p = process.env.LLM_PROVIDER?.trim().toLowerCase();
    return p === "ollama" || p === "openai" || p === "anthropic";
}

export async function suggestTagsForArtist(_args: {
    artistName: string;
    bio?: string;
    existingTagIds: string[];
}): Promise<LlmTagsResult> {
    // Not implemented in v1 — see comment above.
    return { tags: [] };
}
