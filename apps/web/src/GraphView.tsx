import { useEffect, useRef } from "react";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import fcose from "cytoscape-fcose";
import type { Graph, TagCategory } from "@mm/shared-types";

// Register the fcose layout exactly once across HMR reloads.
let fcoseRegistered = false;
function ensureFcose() {
  if (!fcoseRegistered) {
    cytoscape.use(fcose);
    fcoseRegistered = true;
  }
}

const CATEGORY_COLORS: Record<TagCategory, string> = {
  genre: "#7c5cff",
  subgenre: "#a78bfa",
  mood: "#f472b6",
  era: "#fbbf24",
  region: "#4fd1c5",
  energy: "#fb923c",
  vocal: "#60a5fa",
  instrument: "#34d399",
};

interface GraphViewProps {
  graph: Graph;
  weightByPlays: boolean;
  selectedTagId?: string;
  onSelectTag(id: string | undefined): void;
}

export function GraphView({
  graph,
  weightByPlays,
  selectedTagId,
  onSelectTag,
}: GraphViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // Build / rebuild the graph when underlying data changes.
  useEffect(() => {
    ensureFcose();
    const host = hostRef.current;
    if (!host) return;

    // Determine size mapping. Without play-count weighting we fall back to
    // a pure artist count scale, so the user can compare structures.
    const sizeOf = (n: { artistCount: number; weight: number }) =>
      weightByPlays ? n.weight : n.artistCount;

    const sizes = graph.nodes.map(sizeOf);
    const sMin = Math.min(...sizes, 1);
    const sMax = Math.max(...sizes, sMin + 1);
    const scale = (v: number) => 18 + ((v - sMin) / (sMax - sMin)) * 62;

    const elements: ElementDefinition[] = [
      ...graph.nodes.map<ElementDefinition>((n) => ({
        data: {
          id: n.id,
          label: n.label,
          category: n.category,
          color: CATEGORY_COLORS[n.category] ?? "#888",
          size: scale(sizeOf(n)),
          artistCount: n.artistCount,
          playCount: n.playCount,
        },
      })),
      ...graph.edges.map<ElementDefinition>((e) => ({
        data: {
          id: `${e.source}__${e.target}`,
          source: e.source,
          target: e.target,
          weight: e.weight,
        },
      })),
    ];

    const eMin = Math.min(...graph.edges.map((e) => e.weight), 1);
    const eMax = Math.max(...graph.edges.map((e) => e.weight), eMin + 1);
    const eScale = (v: number) => 0.4 + ((v - eMin) / (eMax - eMin)) * 2.8;

    const cy = cytoscape({
      container: host,
      elements,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: "#e8eaf2",
            "font-size": 11,
            "text-outline-color": "#0f1115",
            "text-outline-width": 2,
            "text-valign": "center",
            "text-halign": "center",
            width: "data(size)",
            height: "data(size)",
            "border-color": "#0f1115",
            "border-width": 2,
            "transition-property": "background-color, border-color, border-width",
            "transition-duration": 150,
          },
        },
        {
          selector: "node:selected",
          style: {
            "border-color": "#fff",
            "border-width": 4,
          },
        },
        {
          selector: "edge",
          style: {
            width: (ele: cytoscape.EdgeSingular) => eScale(ele.data("weight")),
            "line-color": "#2a3144",
            "curve-style": "straight",
            opacity: 0.55,
          },
        },
        {
          selector: "edge.highlight",
          style: {
            "line-color": "#7c5cff",
            opacity: 1,
            "z-index": 999,
          },
        },
        {
          selector: ".faded",
          style: { opacity: 0.12 },
        },
      ],
      layout: {
        name: "fcose",
        animate: false,
        randomize: true,
        nodeRepulsion: 6500,
        idealEdgeLength: 90,
        edgeElasticity: 0.45,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
      } as cytoscape.LayoutOptions,
    });

    cy.on("tap", "node", (ev) => onSelectTag(ev.target.id() as string));
    cy.on("tap", (ev) => {
      if (ev.target === cy) onSelectTag(undefined);
    });

    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [graph, weightByPlays, onSelectTag]);

  // Apply selection highlighting without rebuilding the layout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("faded highlight");
      cy.nodes().unselect();
      if (!selectedTagId) return;
      const node = cy.getElementById(selectedTagId);
      if (node.empty()) return;
      const neighborhood = node.closedNeighborhood();
      cy.elements().difference(neighborhood).addClass("faded");
      neighborhood.edges().addClass("highlight");
      node.select();
    });
  }, [selectedTagId]);

  return <div className="cy" ref={hostRef} />;
}
