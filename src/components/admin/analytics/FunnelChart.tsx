import type { FunnelStage } from "@/modules/analytics/dashboard";

const COLORS = ["#5e4032", "#8a6a52", "#c28b65", "#e0c3a3"];
const BAND_HEIGHT = 56;
const VIEW_WIDTH = 220;
const CENTER = VIEW_WIDTH / 2;

function halfWidth(pct: number): number {
  const clamped = Math.min(100, Math.max(0, pct));
  return 8 + (clamped / 100) * (CENTER - 8);
}

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const viewHeight = BAND_HEIGHT * stages.length;

  return (
    <div className="card chart-card">
      <div className="chart-card-header">
        <h2>
          Event Funnel <span className="info-dot" title="Session-to-purchase conversion funnel for the selected period." aria-hidden>ⓘ</span>
        </h2>
      </div>
      <div className="funnel-body">
        <svg viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`} className="funnel-svg" role="img" aria-label="Event funnel">
          {stages.map((stage, i) => {
            const top = halfWidth(stage.pct);
            const bottom = halfWidth(stages[i + 1]?.pct ?? stage.pct);
            const y0 = i * BAND_HEIGHT;
            const y1 = y0 + BAND_HEIGHT;
            const points = [
              [CENTER - top, y0],
              [CENTER + top, y0],
              [CENTER + bottom, y1],
              [CENTER - bottom, y1],
            ]
              .map((p) => p.join(","))
              .join(" ");
            return <polygon key={stage.label} points={points} fill={COLORS[i % COLORS.length]} />;
          })}
        </svg>
        <ul className="funnel-list">
          {stages.map((stage) => (
            <li key={stage.label}>
              <span className="funnel-label muted">{stage.label}</span>
              <span className="funnel-value">
                {stage.value.toLocaleString("en-IN")}
                {stage.label !== "Sessions" && <span className="muted"> ({stage.pct.toFixed(1)}%)</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
