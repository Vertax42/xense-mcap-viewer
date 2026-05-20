import React, { useEffect, useRef } from 'react';
import cytoscape from "cytoscape";
import CytoscapeDagre from "cytoscape-dagre";

cytoscape['use'](CytoscapeDagre);

export interface GraphMutation {
  fit: () => void;
}

interface GraphProps {
  elements: cytoscape.ElementDefinition[];
  rankDir: "TB" | "LR";
  graphRef?: React.RefObject<GraphMutation | null>;
}

const DAG_LAYOUT = {
  name: "dagre",
  fit: true,
  nodeSep: 50,
  rankSep: 100,
};

const STYLESHEET: NonNullable<cytoscape.CytoscapeOptions["style"]> = [
  {
    selector: "edge",
    style: {
      "target-arrow-shape": "triangle",
      "line-color": "#666",
      "target-arrow-color": "#666",
      "curve-style": "bezier",
      "width": 1.5,
    },
  },
  {
    selector: 'node[type="node"]',
    style: {
      content: "data(label)",
      shape: "round-rectangle",
      "background-color": "#1e293b",
      "border-color": "#3b82f6",
      "border-width": 1.5,
      padding: "8px",
      "font-size": "12px",
      "color": "#3b82f6",
      "text-valign": "center",
      "text-halign": "center",
    },
  },
  {
    selector: 'node[type="topic"]',
    style: {
      content: "data(label)",
      shape: "diamond",
      "background-color": "#4c1d95",
      "border-color": "#8b5cf6",
      "border-width": 1,
      "font-size": "11px",
      "color": "#fff",
      "text-valign": "center",
      "text-halign": "center",
      padding: "10px",
    },
  },
];

export const Graph: React.FC<GraphProps> = ({ elements, rankDir, graphRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const layout = { ...DAG_LAYOUT, rankDir } as cytoscape.LayoutOptions;
    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: STYLESHEET,
      layout,
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    cyRef.current = cy;

    if (graphRef) {
      graphRef.current = {
        fit: () => cy.fit(),
      };
    }

    return () => {
      cy.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only init; elements/rankDir updates use the effect below
  }, []);

  useEffect(() => {
    if (!cyRef.current) return;
    
    cyRef.current.batch(() => {
      cyRef.current?.elements().remove();
      cyRef.current?.add(elements);
      const layout = { ...DAG_LAYOUT, rankDir } as cytoscape.LayoutOptions;
      cyRef.current?.layout(layout).run();
    });
  }, [elements, rankDir]);

  return <div ref={containerRef} className="w-full h-full bg-background" />;
};
