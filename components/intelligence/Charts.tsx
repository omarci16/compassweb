"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  LineChart,
} from "recharts";

/* Recharts renders to SVG and cannot read Tailwind classes, so the theme has
   to be repeated here as literals. These track the tokens in globals.css and
   tailwind.config.ts — change them together. */
const AXIS = "#5C5A57"; // --color-text-tertiary
const GRID = "#1E1E1E"; // --color-divider
const LABEL = "#A09E99"; // --color-text-secondary

// Categorical series. Ordered so neighbouring slices stay distinguishable.
const COLORS = ["#A06AF0", "#4ADE80", "#E8B75A", "#F87171", "#6BA5E7", "#F0EDE8"];

const TICK = { fontSize: 11, fill: LABEL, fontFamily: "Space Mono, monospace" };

const TOOLTIP = {
  contentStyle: {
    background: "#161616",
    border: "1px solid #2E2E2E",
    borderRadius: 8,
    fontSize: 12,
    color: "#F0EDE8",
  },
  itemStyle: { color: "#F0EDE8" },
  labelStyle: { color: "#A09E99", fontFamily: "Space Mono, monospace" },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

export function WinRateChart({ data }: { data: { niche: string; rate: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="niche" tick={TICK} stroke={AXIS} />
        <YAxis tick={TICK} stroke={AXIS} unit="%" />
        <Tooltip {...TOOLTIP} />
        <Bar dataKey="rate" fill="#A06AF0" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LossReasonPie({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          stroke="#111111"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} />
        <Legend wrapperStyle={{ fontSize: 11, color: LABEL }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CycleTrendChart({ data }: { data: { month: string; days: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={TICK} stroke={AXIS} />
        <YAxis tick={TICK} stroke={AXIS} unit="d" />
        <Tooltip {...TOOLTIP} />
        <Line
          type="monotone"
          dataKey="days"
          stroke="#4ADE80"
          strokeWidth={2}
          dot={{ r: 3, fill: "#4ADE80", stroke: "#111111" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
