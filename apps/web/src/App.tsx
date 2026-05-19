import { useEffect, useState } from "react";
import type { ArtistsDoc, Graph } from "@mm/shared-types";
import { GraphView } from "./GraphView.tsx";
import { Sidebar } from "./Sidebar.tsx";

interface AppState {
  graph?: Graph;
  artists?: ArtistsDoc;
  error?: string;
  loading: boolean;
  selectedTagId?: string;
  weightByPlays: boolean;
}

export function App() {
  const [state, setState] = useState<AppState>({
    loading: true,
    weightByPlays: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [g, a] = await Promise.all([
          fetch("/api/graph").then((r) => {
            if (!r.ok) throw new Error(`/api/graph → ${r.status}`);
            return r.json() as Promise<Graph>;
          }),
          fetch("/api/artists").then((r) => {
            if (!r.ok) throw new Error(`/api/artists → ${r.status}`);
            return r.json() as Promise<ArtistsDoc>;
          }),
        ]);
        if (cancelled) return;
        setState((s) => ({ ...s, graph: g, artists: a, loading: false }));
      } catch (err) {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <span className="title">Music Mind Map</span>
        <span className="stats">
          {state.graph
            ? `${state.graph.nodes.length} tags · ${state.graph.edges.length} links · ${state.graph.stats.taggedArtistCount}/${state.graph.stats.artistCount} artists`
            : state.loading
              ? "Loading…"
              : ""}
        </span>
        <span className="spacer" />
        <button
          aria-pressed={state.weightByPlays}
          onClick={() => setState((s) => ({ ...s, weightByPlays: !s.weightByPlays }))}
          title="Toggle: scale tag nodes by your play counts"
        >
          ♪ Weight by plays
        </button>
      </header>

      <main className="graph">
        {state.error && <div className="error">{state.error}</div>}
        {state.graph && (
          <GraphView
            graph={state.graph}
            weightByPlays={state.weightByPlays}
            selectedTagId={state.selectedTagId}
            onSelectTag={(id) => setState((s) => ({ ...s, selectedTagId: id }))}
          />
        )}
      </main>

      <aside className="side">
        <Sidebar artists={state.artists} graph={state.graph} selectedTagId={state.selectedTagId} />
      </aside>
    </div>
  );
}
