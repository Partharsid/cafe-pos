"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingBag,
  Store,
  TrendingUp,
  Percent,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CafeStats {
  cafe_id: string;
  cafe_name: string;
  total_orders: number;
  total_revenue: number;
  total_royalty: number;
}

interface RevenueDay {
  date: string;
  revenue: number;
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<{
    totalCafes: number;
    totalOrders: number;
    totalRevenue: number;
    totalRoyalty: number;
    cafeStats: CafeStats[];
    revenueByDay: RevenueDay[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      const { data: cafes } = await supabase
        .from("cafes")
        .select("id, name");

      const { data: orders } = await supabase
        .from("orders")
        .select("id, cafe_id, total, royalty_amount, created_at")
        .neq("status", "cancelled");

      const { data: royalty } = await supabase
        .from("royalty_logs")
        .select("cafe_id, royalty_amount");

      if (cafes && orders) {
        const cafeMap = new Map<
          string,
          { name: string; orders: number; revenue: number; royalty: number }
        >();
        cafes.forEach((c) =>
          cafeMap.set(c.id, {
            name: c.name,
            orders: 0,
            revenue: 0,
            royalty: 0,
          })
        );

        orders.forEach((o) => {
          const c = cafeMap.get(o.cafe_id);
          if (c) {
            c.orders++;
            c.revenue += Number(o.total);
            c.royalty += Number(o.royalty_amount);
          }
        });

        const days: Record<string, number> = {};
        orders.forEach((o) => {
          const d = o.created_at.split("T")[0];
          days[d] = (days[d] || 0) + Number(o.total);
        });
        const revenueByDay = Object.entries(days)
          .map(([date, revenue]) => ({
            date,
            revenue: Math.round(revenue),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-7);

        setStats({
          totalCafes: cafes.length,
          totalOrders: orders.length,
          totalRevenue: orders.reduce(
            (s, o) => s + Number(o.total),
            0
          ),
          totalRoyalty: orders.reduce(
            (s, o) => s + Number(o.royalty_amount),
            0
          ),
          cafeStats: Array.from(cafeMap.entries()).map(([id, s]) => ({
            cafe_id: id,
            cafe_name: s.name,
            total_orders: s.orders,
            total_revenue: Math.round(s.revenue),
            total_royalty: Math.round(s.royalty),
          })),
          revenueByDay,
        });
      }
      setLoading(false);
    };
    fetchStats();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Super Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Global overview of all cafes and revenue
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-primary/15">
              <Store className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cafes</p>
              <p className="text-xl sm:text-2xl font-bold">
                {stats?.totalCafes}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-accent/15">
              <ShoppingBag className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold">
                {stats?.totalOrders}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-chart-4/15">
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{stats?.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-secondary/15">
              <Percent className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Royalty Earned
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{stats?.totalRoyalty.toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Revenue (Last 7 Days)
        </h3>
        <div className="min-h-[200px] sm:min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.revenueByDay}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis
                dataKey="date"
                stroke="#9e9e9e"
                fontSize={10}
                tickFormatter={(d) => {
                  const parts = d.split("-");
                  return `${parts[2] || ""}/${parts[1] || ""}`;
                }}
              />
              <YAxis stroke="#9e9e9e" fontSize={10} width={50} />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,5,10,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "0.75rem",
                  color: "#f8f8f8",
                  fontSize: "12px",
                }}
              />
              <Bar
                dataKey="revenue"
                fill="oklch(0.66 0.19 258.5)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Cafe-wise Breakdown
        </h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[500px] sm:min-w-0 px-4 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Cafe
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Orders
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Revenue
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Royalty
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats?.cafeStats.map((cs) => (
                  <tr
                    key={cs.cafe_id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium">
                      {cs.cafe_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {cs.total_orders}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ₹{cs.total_revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-secondary">
                      ₹{cs.total_royalty.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!stats?.cafeStats || stats.cafeStats.length === 0) && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
