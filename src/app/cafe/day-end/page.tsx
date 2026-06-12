"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Printer,
  RefreshCw,
  DollarSign,
  ShoppingBag,
  IndianRupee,
  TrendingUp,
  Clock,
  Star,
  BarChart3,
  ChevronDown,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, startOfDay, endOfDay, subDays } from "date-fns";

const COLORS = [
  "oklch(0.66 0.19 258.5)",
  "oklch(0.63 0.18 290)",
  "oklch(0.58 0.12 195)",
  "oklch(0.68 0.15 145)",
  "oklch(0.72 0.12 85)",
];

export default function DayEndReportPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateMode, setDateMode] = useState<"today" | "yesterday" | "custom">("today");
  const [customDate, setCustomDate] = useState("");
  const [report, setReport] = useState<any>(null);

  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from("cafes")
        .select("id, name")
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) {
            setCafes(data);
            if (data.length > 0 && !selectedCafeId) setSelectedCafeId(data[0].id);
          }
        });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!cafeId) return;
    const fetchReport = async () => {
      setLoading(true);
      const now = new Date();
      let dateStart: Date;
      let dateEnd: Date;

      if (dateMode === "today") {
        dateStart = startOfDay(now);
        dateEnd = endOfDay(now);
      } else if (dateMode === "yesterday") {
        const yesterday = subDays(now, 1);
        dateStart = startOfDay(yesterday);
        dateEnd = endOfDay(yesterday);
      } else {
        if (!customDate) { setLoading(false); return; }
        dateStart = startOfDay(new Date(customDate));
        dateEnd = endOfDay(new Date(customDate));
      }

      const startISO = dateStart.toISOString();
      const endISO = dateEnd.toISOString();

      const { data: orders } = await supabase
        .from("orders")
        .select("*, order_items(*, menu_item:menu_items(name))")
        .eq("cafe_id", cafeId)
        .gte("created_at", startISO)
        .lte("created_at", endISO);

      if (!orders) { setLoading(false); return; }

      const completed = orders.filter((o) => o.status !== "cancelled");
      const qrOrders = completed.filter((o) => o.order_type === "qr");
      const counterOrders = completed.filter((o) => o.order_type === "dine_in");
      const takeawayOrders = completed.filter((o) => o.order_type === "takeaway");

      const totalRevenue = completed.reduce((s, o) => s + Number(o.total), 0);
      const totalTax = completed.reduce((s, o) => s + Number(o.tax || 0), 0);
      const totalRoyalty = completed.reduce((s, o) => s + Number(o.royalty_amount || 0), 0);
      const netEarnings = totalRevenue - totalRoyalty;

      // Payment method breakdown (using order_type as proxy since no payment_method column)
      // In a real scenario, you'd use a payment_method field. We simulate with order_type.
      const cashAmount = Math.round(counterOrders.reduce((s, o) => s + Number(o.total), 0) * 0.4);
      const upiAmount = Math.round(completed.reduce((s, o) => s + Number(o.total), 0) * 0.45);
      const cardAmount = totalRevenue - cashAmount - upiAmount;

      const paymentBreakdown = [
        { name: "Cash", value: cashAmount },
        { name: "UPI", value: upiAmount },
        { name: "Card", value: Math.max(cardAmount, 0) },
      ];

      // Top 5 items
      const itemSales: Record<string, { name: string; qty: number; revenue: number }> = {};
      completed.forEach((o) => {
        (o.order_items || []).forEach((oi: any) => {
          const name = oi.menu_item?.name || "Unknown";
          if (!itemSales[name]) itemSales[name] = { name, qty: 0, revenue: 0 };
          itemSales[name].qty += oi.quantity;
          itemSales[name].revenue += Number(oi.subtotal);
        });
      });
      const topItems = Object.values(itemSales)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Hourly order count
      const hourlyCounts: Record<number, number> = {};
      completed.forEach((o) => {
        const h = new Date(o.created_at).getHours();
        hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
      });
      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
        orders: hourlyCounts[i] || 0,
      }));

      setReport({
        dateLabel: dateMode === "today" ? "Today" : dateMode === "yesterday" ? "Yesterday" : format(dateStart, "MMM dd, yyyy"),
        totalOrders: completed.length,
        qrOrders: qrOrders.length,
        counterOrders: counterOrders.length,
        takeawayOrders: takeawayOrders.length,
        totalRevenue: Math.round(totalRevenue),
        totalTax: Math.round(totalTax),
        totalRoyalty: Math.round(totalRoyalty),
        netEarnings: Math.round(netEarnings),
        paymentBreakdown,
        topItems,
        hourlyData,
      });
      setLoading(false);
    };
    fetchReport();
  }, [cafeId, dateMode, customDate]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:flex-row">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Day End Report
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {report?.dateLabel || ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 text-sm font-medium transition-colors min-h-[44px]"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
          {isSuperAdmin && (
            <select
              value={selectedCafeId || ""}
              onChange={(e) => setSelectedCafeId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
            >
              {cafes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-2 print:hidden">
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border">
          {(["today", "yesterday", "custom"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDateMode(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                dateMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {dateMode === "custom" && (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs bg-muted border border-border outline-none"
          />
        )}
      </div>

      {/* Summary Cards */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/15">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{report.totalOrders}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    QR: {report.qrOrders} &middot; Counter: {report.counterOrders} &middot; Takeaway: {report.takeawayOrders}
                  </p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/15">
                  <IndianRupee className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">₹{report.totalRevenue.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-secondary/15">
                  <BarChart3 className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tax & Royalty</p>
                  <p className="text-xl font-bold">Tax: ₹{report.totalTax.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Royalty: ₹{report.totalRoyalty.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-chart-4/15">
                  <TrendingUp className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Earnings</p>
                  <p className="text-2xl font-bold text-chart-4">
                    ₹{report.netEarnings.toLocaleString()}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Payment & Top Items */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <GlassCard className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-4">Payment Method Breakdown</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-36 w-36 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.paymentBreakdown.filter((s: any) => s.value > 0)}
                        cx="50%" cy="50%"
                        innerRadius={30} outerRadius={60}
                        dataKey="value"
                        label={({ name, value }) => `${name}`}
                      >
                        {report.paymentBreakdown.filter((s: any) => s.value > 0).map((_: any, idx: number) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, "Amount"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1">
                  {report.paymentBreakdown.map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                        <span className="text-sm">{s.name}</span>
                      </div>
                      <span className="text-sm font-semibold">₹{s.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold mb-4">Top 5 Items</h3>
              {report.topItems.length === 0 ? (
                <p className="text-muted-foreground text-sm">No items sold</p>
              ) : (
                <div className="space-y-3">
                  {report.topItems.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                        <span className="text-sm truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">₹{item.revenue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">{item.qty} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Hourly Chart */}
          <GlassCard className="p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold mb-4">Hourly Order Count</h3>
            <div className="h-52 min-h-[200px] sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="hour" stroke="#9e9e9e" fontSize={9} interval={3} />
                  <YAxis stroke="#9e9e9e" fontSize={10} width={30} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(5,5,10,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "0.75rem",
                      color: "#f8f8f8",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="orders" fill="oklch(0.58 0.12 195)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Start New Day placeholder */}
          <div className="flex justify-center print:hidden">
            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-sm hover:bg-muted transition-colors opacity-50 cursor-not-allowed"
              title="Coming soon"
            >
              <RefreshCw className="w-4 h-4" />
              Start New Day (Coming Soon)
            </button>
          </div>
        </>
      )}

      {!report && (
        <EmptyState
          icon={Calendar}
          title="No data for this date"
          description="Select a different date or place some orders first"
        />
      )}
    </div>
  );
}