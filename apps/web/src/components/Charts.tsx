"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AnalysisResult } from "@/lib/analyzer";
import { categoryColor, categoryLabel } from "@/lib/format";

export function ActivityChart({ data }: { data: AnalysisResult["dailyActivity"] }) {
  if (!data.length) {
    return <p className="text-sm text-white/50">No daily activity data available.</p>;
  }
  const trimmed = data.slice(-60);
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trimmed} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey="txCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryPie({ data }: { data: AnalysisResult["categories"] }) {
  if (!data.length) {
    return <p className="text-sm text-white/50">Belum ada kategori.</p>;
  }
  const items = data.map((d) => ({
    name: categoryLabel(d.category),
    value: d.count,
    color: categoryColor(d.category),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={45}
            stroke="rgba(0,0,0,0.3)"
          >
            {items.map((it, i) => (
              <Cell key={i} fill={it.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
