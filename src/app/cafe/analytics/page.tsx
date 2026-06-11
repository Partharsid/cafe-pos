"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { DollarSign, TrendingUp, ShoppingBag, Star, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "oklch(0.66 0.19 258.5)",
  "oklch(0.63 0.18 290)",
  "oklch(0.58 0.12 195)",
  "oklch(0.68 0.15 145)",
  "oklch(0.72 0.12 85)",
];

export default function AnalyticsPage() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const cafeId = profile?.cafe_id;

  useEffect(() => {
    if (!cafeId) return;
    const fetchAnalytics = async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, royalty_amount, status, created_at")
        .eq("cafe_id", cafeId);

      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, subtotal, menu_item:menu_items(name)")
        .not("order_id", "is", null);

      if (!orders) { setLoading(false); return; }

      const completed = orders.filter((o) => o.status !== "cancelled");
      const totalRevenue = completed.reduce((s, o) => s + Number(o.total), 0);
      const totalRoyalty = completed.reduce((s, o) => s + Number(o.royalty_amount), 0);

      const days: Record<string, { revenue: number; orders: number }> = {};
      completed.forEach((o) => {
        const d = o.created_at.split("T")[0];
        if (!days[d]) days[d] = { revenue: 0, orders: 0 };
        days[d].revenue += Number(o.total);
        days[d].orders++;
      });
      const revenueByDay = Object.entries(days)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7);

      const itemSales: Record<string, { name: string; qty: number; revenue: number }> = {};
      items?.forEach((oi: any) => {
        const name = oi.menu_item?.name || "Unknown";
        if (!itemSales[name]) itemSales[name] = { name, qty: 0, revenue: 0 };
        itemSales[name].qty += oi.quantity;
        itemSales[name].revenue += Number(oi.subtotal);
      });
      const topItems = Object.values(itemSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const statusCounts = ["pending", "preparing", "ready", "completed"].map(
        (s) => ({
          name: s,
          value: orders.filter((o) => o.status === s).length,
        })
      );

      setStats({
        totalOrders: completed.length,
        totalRevenue: Math.round(totalRevenue),
        netEarnings: Math.round(totalRevenue - totalRoyalty),
        avgOrderValue: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
        revenueByDay,
        topItems,
        statusCounts,
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, [cafeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Performance insights and reports
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                ₹{(stats?.totalRevenue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/15">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Earnings</p>
              <p className="text-2xl font-bold">
                ₹{(stats?.netEarnings || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/15">
              <ShoppingBag className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{stats?.totalOrders || 0}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-4/15">
              <Star className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. Order Value</p>
              <p className="text-2xl font-bold">
                ₹{(stats?.avgOrderValue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Revenue (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="#9e9e9e" fontSize={12} />
                <YAxis stroke="#9e9e9e" fontSize={12} />
                <Tooltip contentStyle={{ background: "rgba(5,5,10,0.95)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "0.75rem", color: "#f8f8f8" }} />
                <Bar dataKey="revenue" fill="oklch(0.58 0.12 195)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <h3 className="text-lg font-semibold mb-4">Top Selling Items</h3>
          <div className="space-y-3">
            {stats?.topItems.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">
                    #{i + 1}
                  </span>
                  <span className="text-sm">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    ₹{item.revenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.qty} sold
                  </p>
                </div>
              </div>
            ))}
            {(!stats?.topItems || stats.topItems.length === 0) && (
              <p className="text-muted-foreground text-sm">No data yet</p>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Order Status Breakdown</h3>
        <div className="flex items-center gap-8">
          <div className="h-48 w-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.statusCounts.filter((s: any) => s.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats?.statusCounts
                    .filter((s: any) => s.value > 0)
                    .map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {stats?.statusCounts.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: COLORS[i] }}
                />
                <span className="text-sm capitalize">{s.name}:</span>
                <span className="text-sm font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
