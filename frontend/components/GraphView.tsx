import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { api } from '../services/api';
import { GraphData } from '../types';

interface GraphViewProps {
  activeDB: string | null;
}

export const GraphView: React.FC<GraphViewProps> = ({ activeDB }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeDB) return;
    setLoading(true);
    api.getGraph(activeDB)
      .then(data => {
        setGraphData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [activeDB]);

  useEffect(() => {
    if (!graphData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Zoom Behavior
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Force Simulation
    const simulation = d3.forceSimulation(graphData.nodes as any)
      .force("link", d3.forceLink(graphData.links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(20));

    // Draw Links
    const link = g.append("g")
      .attr("stroke", "#444")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke-width", 1);

    // Draw Nodes
    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", 5)
      .attr("fill", (d: any) => d.type === 'file' ? '#007ACC' : '#A020F0')
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Labels
    const text = g.append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text((d: any) => d.label)
      .attr("font-size", 10)
      .attr("fill", "#aaa")
      .attr("dx", 8)
      .attr("dy", 3);

    // Simulation Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      text
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#101018] relative overflow-hidden">
      {!activeDB && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          Select a Knowledge Base to visualize the graph.
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-[#007ACC]">
          Loading Graph Topology...
        </div>
      )}
      <svg ref={svgRef} className="w-full h-full cursor-move" />
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-[#1e1e2f] border border-gray-700 p-2 rounded text-xs text-gray-300">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-[#007ACC]"></span>
          <span>File Node</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#A020F0]"></span>
          <span>Dependency / Concept</span>
        </div>
      </div>
    </div>
  );
};