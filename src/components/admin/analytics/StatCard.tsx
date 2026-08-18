import { MiniTrend } from "./MiniTrend";
import type { TrendStat } from "@/modules/analytics/dashboard";

export function StatCard({
  icon,
  label,
  value,
  stat,
  rangeDays,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  stat: TrendStat;
  rangeDays: number;
}) {
  const positive = stat.changePct === null || stat.changePct >= 0;
  const changeClass = stat.changePct === null ? "neutral" : positive ? "positive" : "negative";
  const changeLabel = stat.changePct === null ? "New this period" : `${positive ? "▲" : "▼"} ${Math.abs(stat.changePct).toFixed(1)}% vs last ${rangeDays} days`;

  return (
    <div className="card stat-card">
      <div className="stat-card-top">
        <div className="stat-icon">{icon}</div>
        <div className="stat-body" style={{ flex: 1 }}>
          <span className="muted">{label}</span>
          <strong>{value}</strong>
        </div>
        <MiniTrend data={stat.sparkline} positive={positive} />
      </div>
      <span className={`stat-change ${changeClass}`}>{changeLabel}</span>
    </div>
  );
}
