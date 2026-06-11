"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Percent,
  DollarSign,
  Loader2,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { format, subDays } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RoyaltySummary {
  cafe_name: string;
  royalty_pct: number;
  total_orders: number;
  total_revenue: number;
  total_royalty: number;
}

export default function RoyaltyReports() {
  const [summary, setSummary] = useState<RoyaltySummary[]>([]);
  const [royaltyChart, setRoyaltyChart] = useState<
    { date: string; royalty: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: logs } = await supabase
        .from("royalty_logs")
        .select(
          "id, cafe_id, order_total, royalty_amount, royalty_percentage, created_at, cafes!inner(name, royalty_percentage)"
        )
        .order("created_at", { ascending: false });

      if (logs) {
        const cafeMap = new Map<string, RoyaltySummary>();
        const daysMap: Record<string, number> = {};

        logs.forEach((log: any) => {
          const name = log.cafes?.name || "Unknown";
          const existing = cafeMap.get(log.cafe_id);
          if (existing) {
            existing.total_orders++;
            existing.total_revenue += Number(log.order_total);
            existing.total_royalty += Number(log.royalty_amount);
          } else {
            cafeMap.set(log.cafe_id, {
              cafe_name: name,
              royalty_pct: Number(
                log.cafes?.royalty_percentage ||
                  log.royalty_percentage
              ),
              total_orders: 1,
              total_revenue: Number(log.order_total),
              total_royalty: Number(log.royalty_amount),
            });
          }

          const d = log.created_at.split("T")[0];
          daysMap[d] =
            (daysMap[d] || 0) + Number(log.royalty_amount);
        });

        const chart = Object.entries(daysMap)
          .map(([date, royalty]) => ({
            date,
            royalty: Math.round(royalty),
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14);

        setSummary(Array.from(cafeMap.values()));
        setRoyaltyChart(chart);
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  const totalRoyalty = summary.reduce((s, c) => s + c.total_royalty, 0);

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
          Royalty Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track commissions earned from each cafe
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-secondary/15">
              <Percent className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Total Royalty Earned
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{Math.round(totalRoyalty).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-accent/15">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Active Cafes
              </p>
              <p className="text-xl sm:text-2xl font-bold">
                {summary.length}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Royalty Trend (Last 14 Days)
        </h3>
        <div className="h-52 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={royaltyChart}>
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
              <Line
                type="monotone"
                dataKey="royalty"
                stroke="oklch(0.63 0.18 290)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Cafe-wise Royalty
        </h3>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">
                    Cafe
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Rate
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
                {summary.map((s, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium">
                      {s.cafe_name}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Badge variant="secondary">{s.royalty_pct}%</Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {s.total_orders}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ₹{s.total_revenue.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-secondary font-semibold">
                      ₹{Math.round(s.total_royalty).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {summary.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No royalty data yet
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
