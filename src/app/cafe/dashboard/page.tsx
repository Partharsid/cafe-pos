"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Package,
  AlertTriangle,
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
import toast from "react-hot-toast";

export default function CafeAdminDashboard() {
  const { profile } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const cafeId = profile?.cafe_id;

  useEffect(() => {
    if (!cafeId) return;
    const fetchData = async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, royalty_amount, status, created_at")
        .eq("cafe_id", cafeId);

      const { data: items } = await supabase
        .from("menu_items")
        .select("id, name, stock_quantity, low_stock_threshold")
        .eq("cafe_id", cafeId);

      if (orders) {
        const completed = orders.filter((o) => o.status !== "cancelled");
        const totalRevenue = completed.reduce((s, o) => s + Number(o.total), 0);
        const totalRoyalty = completed.reduce(
          (s, o) => s + Number(o.royalty_amount),
          0
        );

        const days: Record<string, number> = {};
        completed.forEach((o) => {
          const d = o.created_at.split("T")[0];
          days[d] = (days[d] || 0) + Number(o.total);
        });
        const revenueByDay = Object.entries(days)
          .map(([date, revenue]) => ({ date, revenue: Math.round(revenue) }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-7);

        setStats({
          totalOrders: completed.length,
          totalRevenue: Math.round(totalRevenue),
          netEarnings: Math.round(totalRevenue - totalRoyalty),
          totalRoyalty: Math.round(totalRoyalty),
          pendingOrders: orders.filter((o) => o.status === "pending").length,
          revenueByDay,
        });
      }

      if (items) {
        const low = items.filter(
          (i) =>
            i.stock_quantity !== null &&
            i.stock_quantity <= i.low_stock_threshold
        );
        setLowStock(low);
      }

      setLoading(false);
    };
    fetchData();
  }, [cafeId, supabase]);

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
        <h1 className="text-3xl font-bold tracking-tight">
          Cafe Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Overview of your cafe performance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15">
              <ShoppingBag className="w-5 h-5 text-primary" />
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
              <DollarSign className="w-5 h-5 text-chart-4" />
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
            <div className="p-2 rounded-lg bg-destructive/15">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending Orders</p>
              <p className="text-2xl font-bold">{stats?.pendingOrders || 0}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {lowStock.length > 0 && (
        <GlassCard className="border-destructive/30">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Low Stock Alerts</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((item) => (
              <Badge key={item.id} variant="destructive">
                {item.name} ({item.stock_quantity} left)
              </Badge>
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <h3 className="text-lg font-semibold mb-4">Revenue (Last 7 Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.revenueByDay || []}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
              />
              <XAxis dataKey="date" stroke="#9e9e9e" fontSize={12} />
              <YAxis stroke="#9e9e9e" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "rgba(5,5,10,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "0.75rem",
                  color: "#f8f8f8",
                }}
              />
              <Bar
                dataKey="revenue"
                fill="oklch(0.58 0.12 195)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}
