import { getAnalyticsOverview, type RangeDays } from "@/modules/analytics/dashboard";
import { formatPaise } from "@/lib/money";
import { RangeControl } from "@/components/admin/analytics/RangeControl";
import { StatCard } from "@/components/admin/analytics/StatCard";
import { RevenueChart } from "@/components/admin/analytics/RevenueChart";
import { ChannelDonut } from "@/components/admin/analytics/ChannelDonut";
import { FunnelChart } from "@/components/admin/analytics/FunnelChart";
import { WalletIcon, CartIcon, TargetIcon, UsersIcon, TrendUpIcon, InsightRevenueIcon } from "@/components/admin/analytics/Icons";

export const dynamic = "force-dynamic";

const VALID_RANGES: RangeDays[] = [7, 30, 90];

function parseRangeDays(value: string | undefined): RangeDays {
  const n = Number(value);
  return VALID_RANGES.includes(n as RangeDays) ? (n as RangeDays) : 7;
}

const INSIGHT_ICONS = {
  revenue: InsightRevenueIcon,
  channel: UsersIcon,
  funnel: TrendUpIcon,
  cart: CartIcon,
};

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const params = await searchParams;
  const rangeDays = parseRangeDays(params.range);
  const data = await getAnalyticsOverview(rangeDays);

  return (
    <>
      <div className="analytics-header">
        <div>
          <h1>Analytics Overview</h1>
          <p className="muted">Track your store performance and make data-driven decisions</p>
        </div>
        <RangeControl rangeDays={data.rangeDays} previousPeriodLabel={data.previousPeriodLabel} />
      </div>

      <div className="grid">
        <StatCard icon={<WalletIcon />} label="Total Revenue" value={formatPaise(data.stats.revenuePaise.current)} stat={data.stats.revenuePaise} rangeDays={rangeDays} />
        <StatCard icon={<CartIcon />} label="Orders" value={data.stats.orders.current.toLocaleString("en-IN")} stat={data.stats.orders} rangeDays={rangeDays} />
        <StatCard icon={<TargetIcon />} label="Conversion Rate" value={`${data.stats.conversionRate.current.toFixed(2)}%`} stat={data.stats.conversionRate} rangeDays={rangeDays} />
        <StatCard icon={<UsersIcon />} label="Total Sessions" value={data.stats.sessions.current.toLocaleString("en-IN")} stat={data.stats.sessions} rangeDays={rangeDays} />
      </div>

      <div className="dashboard-row">
        <RevenueChart daily={data.revenueSeries.daily} weekly={data.revenueSeries.weekly} />
        <ChannelDonut channels={data.channels} totalSessions={data.stats.sessions.current} />
      </div>

      <div className="dashboard-row-3">
        <div className="card list-card">
          <h2>
            Top Pages by Views <span className="info-dot" title="Events recorded in the selected period, grouped by page path." aria-hidden>ⓘ</span>
          </h2>
          <div className="list-body">
            {data.topPages.length ? (
              data.topPages.map((page) => {
                const max = data.topPages[0].count || 1;
                return (
                  <div className="bar-row" key={page.path}>
                    <span className="muted" title={page.path} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {page.path}
                    </span>
                    <span className="bar-track">
                      <span className="bar-fill" style={{ width: `${(page.count / max) * 100}%` }} />
                    </span>
                    <span className="bar-count">{page.count}</span>
                  </div>
                );
              })
            ) : (
              <p className="muted">No page views recorded yet.</p>
            )}
          </div>
        </div>

        <FunnelChart stages={data.funnel} />

        <div className="card list-card">
          <h2>
            Top Products by Views <span className="info-dot" title="Product-linked events in the selected period, grouped by product." aria-hidden>ⓘ</span>
          </h2>
          <div className="list-body">
            {data.topProducts.length ? (
              data.topProducts.map((product) => (
                <div className="product-row" key={product.id}>
                  {product.imageUrl ? (
                    <img className="product-thumb" src={product.imageUrl} alt="" />
                  ) : (
                    <div className="product-thumb" />
                  )}
                  <span className="product-name">{product.name}</span>
                  <span className="product-views">{product.views}</span>
                </div>
              ))
            ) : (
              <p className="muted">No product views recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Key Insights</h2>
        <div className="insights-row" style={{ marginTop: 0 }}>
          {data.insights.length ? (
            data.insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[insight.icon];
              return (
                <div className="insight-card" key={i}>
                  <div className="insight-icon">
                    <Icon />
                  </div>
                  <p>{insight.text}</p>
                </div>
              );
            })
          ) : (
            <p className="muted">Insights will appear once there is enough traffic in this period.</p>
          )}
        </div>
      </div>
    </>
  );
}
