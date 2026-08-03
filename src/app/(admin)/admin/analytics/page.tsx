import { prisma } from "@/lib/db/prisma";
import { formatPaise } from "@/lib/money";

const windowStart = new Date(Date.now() - 30 * 86_400_000);

export default async function Analytics() {
  const [events, orders, revenue, top] = await Promise.all([
    prisma.analyticsEvent.count({ where: { occurredAt: { gte: windowStart } } }),
    prisma.order.count({ where: { createdAt: { gte: windowStart } } }),
    prisma.order.aggregate({
      _sum: { totalPaise: true },
      where: {
        createdAt: { gte: windowStart },
        status: { in: ["PAID", "CONFIRMED", "SOURCING", "READY_TO_SHIP", "SHIPPED", "DELIVERED"] },
      },
    }),
    prisma.analyticsEvent.groupBy({
      by: ["name"], where: { occurredAt: { gte: windowStart } },
      _count: { name: true }, orderBy: { _count: { name: "desc" } }, take: 10,
    }),
  ]);
  return <><h1>Analytics</h1><p className="muted">Last 30 days · stored first-party events</p>
    <div className="grid"><div className="card metric">Events<strong>{events}</strong></div><div className="card metric">Orders<strong>{orders}</strong></div><div className="card metric">Revenue<strong>{formatPaise(revenue._sum.totalPaise ?? 0)}</strong></div><div className="card metric">Conversion<strong>{events ? ((orders / events) * 100).toFixed(2) : "0"}%</strong></div></div>
    <div className="card" style={{ marginTop: 16 }}><h2>Event volume</h2><table><thead><tr><th>Event</th><th>Count</th></tr></thead><tbody>{top.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x._count.name}</td></tr>)}</tbody></table></div></>;
}
