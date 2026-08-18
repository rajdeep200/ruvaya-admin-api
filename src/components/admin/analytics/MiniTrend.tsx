"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

export function MiniTrend({ data, positive }: { data: number[]; positive: boolean }) {
  const points = data.map((value, i) => ({ i, value }));
  const color = positive ? "var(--success)" : "var(--danger)";
  const gradientId = `spark-${positive ? "up" : "down"}`;

  return (
    <div className="mini-trend">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
