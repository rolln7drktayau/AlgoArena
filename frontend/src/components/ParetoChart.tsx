import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { GenerationSnapshot } from "../types";

interface Props {
  snapshot: GenerationSnapshot | null;
  objectives: number;
}

const projection = (point: number[], angle: number): { x: number; y: number } => {
  const [x, y, z] = [point[0], point[1], point[2] ?? 0];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = x * cos - z * sin;
  const rz = x * sin + z * cos;
  return {
    x: rx + rz * 0.35,
    y: y - rz * 0.25
  };
};

export const ParetoChart = ({ snapshot, objectives }: Props) => {
  const points2d = useMemo(
    () =>
      (snapshot?.population ?? []).map((member, index) => ({
        idx: index,
        x: member.f[0] ?? 0,
        y: member.f[1] ?? 0
      })),
    [snapshot]
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (!svgRef.current || objectives < 3) {
      return;
    }

    const width = 320;
    const height = 220;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const points = (snapshot?.population ?? []).map((member) => member.f.slice(0, 3));
    if (points.length === 0) {
      return;
    }

    const angle = ((snapshot?.generation ?? 0) * Math.PI) / 40;
    const projected = points.map((point) => projection(point, angle));
    const xExtent = d3.extent(projected, (d) => d.x) as [number, number];
    const yExtent = d3.extent(projected, (d) => d.y) as [number, number];

    const scaleX = d3.scaleLinear().domain(xExtent).range([25, width - 25]).nice();
    const scaleY = d3.scaleLinear().domain(yExtent).range([height - 20, 20]).nice();
    const radius = d3.scaleLinear().domain([0, points.length]).range([5, 2.5]);

    svg
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "rgba(8, 15, 22, 0.75)");

    svg
      .selectAll("circle")
      .data(projected)
      .enter()
      .append("circle")
      .attr("cx", (d) => scaleX(d.x))
      .attr("cy", (d) => scaleY(d.y))
      .attr("r", (_, idx) => radius(idx))
      .attr("fill", "#29dba6")
      .attr("opacity", 0.85);

    const xAxis = d3.axisBottom(scaleX).ticks(4);
    const yAxis = d3.axisLeft(scaleY).ticks(4);
    svg.append("g").attr("transform", `translate(0,${height - 20})`).call(xAxis as never).attr("color", "#7da2b8");
    svg.append("g").attr("transform", "translate(25,0)").call(yAxis as never).attr("color", "#7da2b8");
  }, [objectives, snapshot]);

  if (!snapshot || snapshot.population.length === 0) {
    return <div className="h-56 rounded-lg border border-stroke bg-ink/60 p-3 text-xs text-slate">No population yet.</div>;
  }

  if (objectives >= 3) {
    return (
      <div className="rounded-lg border border-stroke bg-ink/60 p-2">
        <svg ref={svgRef} width="100%" height="220" viewBox="0 0 320 220" preserveAspectRatio="xMidYMid meet" />
      </div>
    );
  }

  return (
    <div className="h-56 rounded-lg border border-stroke bg-ink/60 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#214059" />
          <XAxis type="number" dataKey="x" stroke="#7da2b8" tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="y" stroke="#7da2b8" tick={{ fontSize: 10 }} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={points2d} fill="#29dba6" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};

