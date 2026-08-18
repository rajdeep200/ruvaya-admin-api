"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatPaise } from "@/lib/money";
import type { DailyPoint } from "@/modules/analytics/dashboard";

function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="muted">{label}</div>
      <strong>{formatPaise(payload[0].value)}</strong>
    </div>
  );
}

export function RevenueChart({ daily, weekly }: { daily: DailyPoint[]; weekly: DailyPoint[] }) {
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const series = granularity === "daily" ? daily : weekly;

  return (
    <div className="card chart-card revenue-card">
      <div className="chart-card-header">
        <h2>
          Revenue Over Time <span className="info-dot" title="Revenue from paid and fulfilled orders in the selected period." aria-hidden>ⓘ</span>
        </h2>
        <select className="range-select" value={granularity} onChange={(e) => setGranularity(e.target.value as "daily" | "weekly")}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
      </div>
      <div className="chart-card-body" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--cocoa)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--cocoa)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              tickFormatter={(v: number) => `₹${v / 100}`}
              width={56}
            />
            <Tooltip content={<TrendTooltip />} />
            <Area
              type="monotone"
              dataKey="revenuePaise"
              name="Revenue"
              stroke="var(--cocoa)"
              strokeWidth={2.5}
              fill="url(#revenueFill)"
              dot={{ r: 3, fill: "var(--cocoa)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="legend-row">
        <span className="legend-dot" style={{ background: "var(--cocoa)" }} />
        Revenue (₹)
      </div>
    </div>
  );
}
