import "server-only";
import { prisma } from "@/lib/db/prisma";

// Statuses that count as realised revenue — mirrors the set used across the admin orders/refunds modules.
const REVENUE_STATUSES = ["PAID", "CONFIRMED", "SOURCING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] as const;

// The storefront lives in a separate repository (see /AGENTS.md) and owns the event-name taxonomy.
// These aliases cover the common naming conventions; adjust if the storefront's tracker uses different names.
const PRODUCT_VIEW_EVENTS = ["product_view", "view_item", "view_product", "product_viewed"];
const ADD_TO_CART_EVENTS = ["add_to_cart", "cart_add", "added_to_cart"];

const CHANNEL_KEYS = ["direct", "organic_search", "social", "referral", "other"] as const;
export type ChannelKey = (typeof CHANNEL_KEYS)[number];
const CHANNEL_LABELS: Record<ChannelKey, string> = {
  direct: "Direct",
  organic_search: "Organic Search",
  social: "Social Media",
  referral: "Referral",
  other: "Others",
};

export type RangeDays = 7 | 30 | 90;

export type TrendStat = {
  current: number;
  previous: number;
  changePct: number | null;
  sparkline: number[];
};

export type DailyPoint = { date: string; label: string; revenuePaise: number; orders: number; sessions: number };
export type ChannelSlice = { key: ChannelKey; label: string; sessions: number; pct: number };
export type FunnelStage = { label: string; value: number; pct: number };
export type TopPage = { path: string; count: number };
export type TopProduct = { id: string; name: string; slug: string; imageUrl: string | null; views: number };
export type Insight = { icon: "revenue" | "channel" | "funnel" | "cart"; text: string };

export type AnalyticsOverview = {
  rangeDays: RangeDays;
  periodLabel: string;
  previousPeriodLabel: string;
  stats: {
    revenuePaise: TrendStat;
    orders: TrendStat;
    conversionRate: TrendStat;
    sessions: TrendStat;
  };
  revenueSeries: { daily: DailyPoint[]; weekly: DailyPoint[] };
  channels: ChannelSlice[];
  topPages: TopPage[];
  funnel: FunnelStage[];
  topProducts: TopProduct[];
  insights: Insight[];
};

function classifyChannel(source?: string | null, medium?: string | null): ChannelKey {
  const s = (source ?? "").toLowerCase();
  const m = (medium ?? "").toLowerCase();
  if (!s && !m) return "direct";
  if (m.includes("social") || ["facebook", "instagram", "twitter", "pinterest", "tiktok", "x.com"].some((p) => s.includes(p)))
    return "social";
  if (m.includes("organic") || m.includes("search") || ["google", "bing", "yahoo", "duckduckgo"].some((p) => s.includes(p)))
    return "organic_search";
  if (m.includes("referral")) return "referral";
  return "other";
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    keys.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function formatDayLabel(key: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${key}T00:00:00Z`));
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function isoWeekStart(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return dayKey(d);
}

function bucketWeekly(daily: DailyPoint[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const point of daily) {
    const weekKey = isoWeekStart(point.date);
    const existing = map.get(weekKey);
    if (existing) {
      existing.revenuePaise += point.revenuePaise;
      existing.orders += point.orders;
      existing.sessions += point.sessions;
    } else {
      map.set(weekKey, { date: weekKey, label: formatDayLabel(weekKey), revenuePaise: point.revenuePaise, orders: point.orders, sessions: point.sessions });
    }
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAnalyticsOverview(rangeDays: RangeDays = 7): Promise<AnalyticsOverview> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - rangeDays * 86_400_000);
  const prevEnd = periodStart;
  const prevStart = new Date(prevEnd.getTime() - rangeDays * 86_400_000);

  const [
    sessionsCurrent,
    sessionsPreviousCount,
    ordersCurrent,
    ordersPreviousAgg,
    attributions,
    pageGroups,
    productGroups,
    productViewCount,
    addToCartCount,
  ] = await Promise.all([
    prisma.analyticsSession.findMany({
      where: { firstSeenAt: { gte: periodStart, lt: periodEnd } },
      select: { id: true, firstSeenAt: true },
    }),
    prisma.analyticsSession.count({ where: { firstSeenAt: { gte: prevStart, lt: prevEnd } } }),
    prisma.order.findMany({
      where: { createdAt: { gte: periodStart, lt: periodEnd } },
      select: { id: true, createdAt: true, totalPaise: true, status: true },
    }),
    prisma.order.aggregate({
      _sum: { totalPaise: true },
      _count: true,
      where: { createdAt: { gte: prevStart, lt: prevEnd }, status: { in: [...REVENUE_STATUSES] } },
    }),
    prisma.campaignAttribution.findMany({
      where: { createdAt: { gte: periodStart, lt: periodEnd }, sessionId: { not: null } },
      select: { sessionId: true, source: true, medium: true },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["pagePath"],
      where: { occurredAt: { gte: periodStart, lt: periodEnd } },
      _count: true,
      orderBy: { _count: { pagePath: "desc" } },
      take: 5,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["productId"],
      where: { occurredAt: { gte: periodStart, lt: periodEnd }, productId: { not: null } },
      _count: true,
      orderBy: { _count: { productId: "desc" } },
      take: 5,
    }),
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: periodStart, lt: periodEnd }, name: { in: PRODUCT_VIEW_EVENTS } } }),
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: periodStart, lt: periodEnd }, name: { in: ADD_TO_CART_EVENTS } } }),
  ]);

  // Previous-period revenue/orders only need aggregate totals, current period needs per-day buckets too.
  const revenuePreviousPaise = ordersPreviousAgg._sum.totalPaise ?? 0;
  const ordersPreviousCount = ordersPreviousAgg._count;

  const dayKeys = buildDayKeys(periodStart, periodEnd);
  const revenueByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const ordersByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));
  const sessionsByDay = new Map<string, number>(dayKeys.map((k) => [k, 0]));

  let revenueCurrentPaise = 0;
  for (const order of ordersCurrent) {
    const key = dayKey(order.createdAt);
    ordersByDay.set(key, (ordersByDay.get(key) ?? 0) + 1);
    if ((REVENUE_STATUSES as readonly string[]).includes(order.status)) {
      revenueCurrentPaise += order.totalPaise;
      revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.totalPaise);
    }
  }
  for (const session of sessionsCurrent) {
    const key = dayKey(session.firstSeenAt);
    sessionsByDay.set(key, (sessionsByDay.get(key) ?? 0) + 1);
  }

  const daily: DailyPoint[] = dayKeys.map((key) => ({
    date: key,
    label: formatDayLabel(key),
    revenuePaise: revenueByDay.get(key) ?? 0,
    orders: ordersByDay.get(key) ?? 0,
    sessions: sessionsByDay.get(key) ?? 0,
  }));

  const sessionsTotal = sessionsCurrent.length;
  const ordersTotal = ordersCurrent.length;
  const conversionCurrent = sessionsTotal ? (ordersTotal / sessionsTotal) * 100 : 0;
  const conversionPrevious = sessionsPreviousCount ? (ordersPreviousCount / sessionsPreviousCount) * 100 : 0;

  const stats: AnalyticsOverview["stats"] = {
    revenuePaise: {
      current: revenueCurrentPaise,
      previous: revenuePreviousPaise,
      changePct: pctChange(revenueCurrentPaise, revenuePreviousPaise),
      sparkline: daily.map((d) => d.revenuePaise),
    },
    orders: {
      current: ordersTotal,
      previous: ordersPreviousCount,
      changePct: pctChange(ordersTotal, ordersPreviousCount),
      sparkline: daily.map((d) => d.orders),
    },
    conversionRate: {
      current: conversionCurrent,
      previous: conversionPrevious,
      changePct: pctChange(conversionCurrent, conversionPrevious),
      sparkline: daily.map((d) => (d.sessions ? (d.orders / d.sessions) * 100 : 0)),
    },
    sessions: {
      current: sessionsTotal,
      previous: sessionsPreviousCount,
      changePct: pctChange(sessionsTotal, sessionsPreviousCount),
      sparkline: daily.map((d) => d.sessions),
    },
  };

  // First attribution row wins when a session has more than one (shouldn't normally happen).
  const sessionChannel = new Map<string, ChannelKey>();
  for (const a of attributions) {
    if (!a.sessionId || sessionChannel.has(a.sessionId)) continue;
    sessionChannel.set(a.sessionId, classifyChannel(a.source, a.medium));
  }
  const channelCounts: Record<ChannelKey, number> = { direct: 0, organic_search: 0, social: 0, referral: 0, other: 0 };
  for (const session of sessionsCurrent) channelCounts[sessionChannel.get(session.id) ?? "direct"]++;
  const channels: ChannelSlice[] = CHANNEL_KEYS.map((key) => ({
    key,
    label: CHANNEL_LABELS[key],
    sessions: channelCounts[key],
    pct: sessionsTotal ? (channelCounts[key] / sessionsTotal) * 100 : 0,
  })).sort((a, b) => b.sessions - a.sessions);

  const topPages: TopPage[] = pageGroups.map((g) => ({ path: g.pagePath, count: g._count }));

  const productIds = productGroups.map((g) => g.productId).filter((id): id is string => Boolean(id));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, slug: true, media: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }], take: 1, select: { secureUrl: true } } },
      })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const topProducts: TopProduct[] = productGroups
    .filter((g) => g.productId && productById.has(g.productId))
    .map((g) => {
      const product = productById.get(g.productId as string)!;
      return { id: product.id, name: product.name, slug: product.slug, imageUrl: product.media[0]?.secureUrl ?? null, views: g._count };
    });

  const funnel: FunnelStage[] = [
    { label: "Sessions", value: sessionsTotal, pct: 100 },
    { label: "Product Views", value: productViewCount, pct: sessionsTotal ? (productViewCount / sessionsTotal) * 100 : 0 },
    { label: "Add to Cart", value: addToCartCount, pct: sessionsTotal ? (addToCartCount / sessionsTotal) * 100 : 0 },
    { label: "Purchase", value: ordersTotal, pct: sessionsTotal ? (ordersTotal / sessionsTotal) * 100 : 0 },
  ];

  const insights: Insight[] = [];
  if (stats.revenuePaise.changePct !== null) {
    const pct = stats.revenuePaise.changePct;
    insights.push({
      icon: "revenue",
      text: `Your revenue ${pct >= 0 ? "increased" : "decreased"} ${Math.abs(pct).toFixed(1)}% compared to last ${rangeDays} days.`,
    });
  }
  if (channels[0] && channels[0].sessions > 0) {
    insights.push({ icon: "channel", text: `Most traffic is coming from the ${channels[0].label} channel (${channels[0].pct.toFixed(1)}%).` });
  }
  if (productViewCount > 0) {
    const purchaseRate = (ordersTotal / productViewCount) * 100;
    insights.push({
      icon: "funnel",
      text: `Product views are ${purchaseRate >= 5 ? "good" : "steady"}, but conversion to purchase is ${purchaseRate.toFixed(1)}%.`,
    });
  }
  if (productViewCount > 0) {
    const cartRate = (addToCartCount / productViewCount) * 100;
    insights.push({
      icon: "cart",
      text: cartRate < 20 ? "Focus on improving the Add to Cart rate." : "Add to Cart rate is healthy — keep it up.",
    });
  }

  return {
    rangeDays,
    periodLabel: `${formatDate(periodStart)} – ${formatDate(periodEnd)}`,
    previousPeriodLabel: `${formatDate(prevStart)} – ${formatDate(prevEnd)}`,
    stats,
    revenueSeries: { daily, weekly: bucketWeekly(daily) },
    channels,
    topPages,
    funnel,
    topProducts,
    insights,
  };
}
