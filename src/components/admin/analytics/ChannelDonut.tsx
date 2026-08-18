"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import type { ChannelSlice } from "@/modules/analytics/dashboard";

const COLORS = ["#5e4032", "#8a6a52", "#c28b65", "#e0c3a3", "#c9c2b8"];

export function ChannelDonut({ channels, totalSessions }: { channels: ChannelSlice[]; totalSessions: number }) {
  const hasData = totalSessions > 0;
  const data = hasData ? channels : [{ key: "other" as const, label: "No sessions yet", sessions: 1, pct: 100 }];

  return (
    <div className="card chart-card">
      <div className="chart-card-header">
        <h2>
          Top Channels <span className="info-dot" title="Sessions grouped by acquisition channel." aria-hidden>ⓘ</span>
        </h2>
      </div>
      <div className="channel-body">
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey={hasData ? "sessions" : "sessions"} innerRadius="70%" outerRadius="100%" paddingAngle={hasData ? 2 : 0} stroke="none">
                {data.map((entry, i) => (
                  <Cell key={entry.key} fill={hasData ? COLORS[i % COLORS.length] : "var(--border)"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <strong>{totalSessions.toLocaleString("en-IN")}</strong>
            <span className="muted">Sessions</span>
          </div>
        </div>
        <ul className="channel-legend">
          {channels.map((c, i) => (
            <li key={c.key}>
              <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="channel-label">{c.label}</span>
              <span className="channel-value">
                {c.pct.toFixed(1)}% ({c.sessions})
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
