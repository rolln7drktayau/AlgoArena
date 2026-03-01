import { useEffect, useRef } from "react";
import * as d3 from "d3";

export const DiversityHeatmap = ({ matrix }: { matrix: number[][] }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) {
      return;
    }

    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const width = 300;
    const height = 180;
    const cellW = cols > 0 ? width / cols : width;
    const cellH = rows > 0 ? height / rows : height;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "rgba(8, 15, 22, 0.7)");

    const color = d3.scaleSequential(d3.interpolateYlGnBu).domain([0, 1]);

    matrix.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        svg
          .append("rect")
          .attr("x", colIndex * cellW)
          .attr("y", rowIndex * cellH)
          .attr("width", cellW + 0.4)
          .attr("height", cellH + 0.4)
          .attr("fill", color(value));
      });
    });
  }, [matrix]);

  return (
    <div className="rounded-lg border border-stroke bg-ink/60 p-2">
      <svg ref={svgRef} width="100%" height="180" viewBox="0 0 300 180" preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};

