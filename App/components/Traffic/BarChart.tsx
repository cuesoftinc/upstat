import { useEffect, useRef } from "react";
// import {
//   axisBottom,
//   axisLeft,
//   ScaleBand,
//   scaleBand,
//   ScaleLinear,
//   scaleLinear,
//   select,
// } from "d3";
import * as d3 from "d3";
export interface IData {
  label: string;
  value: number;
}

interface BarChartProps {
  data: IData[];
}

interface AxisBottomProps {
  scale: d3.ScaleBand<string>;
  transform: string;
}

interface AxisLeftProps {
  scale: d3.ScaleLinear<number, number, never>;
}

interface BarsProps {
  data: BarChartProps["data"];
  height: number;
  scaleX: AxisBottomProps["scale"];
  scaleY: AxisLeftProps["scale"];
}

function AxisBottom({ scale, transform }: AxisBottomProps) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (ref.current) {
      d3.select(ref.current)
        .call(d3.axisBottom(scale))
        .selectAll("text")
        .attr("class", "axis-bottom-text");
    }
  }, [scale]);

  return <g ref={ref} transform={transform} />;
}

function AxisLeft({ scale }: AxisLeftProps) {
  const ref = useRef<SVGGElement>(null);

  useEffect(() => {
    if (ref.current) {
      d3.select(ref.current).call(d3.axisLeft(scale));
    }
  }, [scale]);

  return <g ref={ref} />;
}

function Bars({ data, height, scaleX, scaleY }: BarsProps) {
  return (
    <>
      {data.map(({ value, label }) => (
        <rect
          key={`bar-${label}`}
          x={scaleX(label)}
          y={scaleY(value)}
          width={scaleX.bandwidth()}
          height={height - scaleY(value)}
          fill="#fff"
        />
      ))}
    </>
  );
}

export function BarChart({ data }: BarChartProps) {
  const margin = { top: 10, right: 0, bottom: 20, left: 30 };
  const width = 750 - margin.left - margin.right;
  const height = 200 - margin.top - margin.bottom;

  const scaleX = d3
    .scaleBand()
    .domain(data.map(({ label }) => label))
    .range([0, width])
    .padding(0.5);
  const scaleY = d3
    .scaleLinear()
    .domain([0, Math.max(...data.map(({ value }) => value))])
    .range([height, 0]);

  return (
    <svg
      style={{
        width: `${width + margin.left + margin.right}px`, // Using pixel units for width
        height: `${height + margin.top + margin.bottom}px`, // Using pixel units for height
      }}
    >
      <g transform={`translate(${margin.left}px, ${margin.top}px)`}>
        <AxisLeft scale={scaleY} />
        <Bars data={data} height={height} scaleX={scaleX} scaleY={scaleY} />
        <AxisBottom scale={scaleX} transform={`translate(0, ${height})`} />
      </g>
    </svg>
  );
}
