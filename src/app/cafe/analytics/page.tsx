"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import {
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Star,
  Loader2,
  Users,
  Clock,
  Download,
  ArrowLeftRight,
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
import toast from "react-hot-toast";
import { format } from "date-fns";

const COLORS = [
  "oklch(0.66 0.19 258.5)",
  "oklch(0.63 0.18 290)",
  "oklch(0.58 0.12 195)",
  "oklch(0.68 0.15 145)",
  "oklch(0.72 0.12 85)",
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  label: i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
}));

export default function AnalyticsPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showWeekCompare, setShowWeekCompare] = useState(false);
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
            if (data.length > 0) setSelectedCafeId(data[0].id);
          }
        });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!cafeId) return;
    const fetchAnalytics = async () => {
      setLoading(true);

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 86400000);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, royalty_amount, status, created_at, customer_phone, subtotal, tax, order_type")
        .eq("cafe_id", cafeId);

      const { data: items } = await supabase
        .from("order_items")
        .select("quantity, subtotal, menu_item:menu_items(name)")
        .not("order_id", "is", null);

      const { data: allOrdersForPeak } = await supabase
        .from("orders")
        .select("created_at")
        .eq("cafe_id", cafeId);

      if (!orders) {
        setLoading(false);
        return;
      }

      const completed = orders.filter((o) => o.status !== "cancelled");
      const totalRevenue = completed.reduce(
        (s, o) => s + Number(o.total),
        0
      );
      const totalRoyalty = completed.reduce(
        (s, o) => s + Number(o.royalty_amount),
        0
      );
      const totalTax = completed.reduce((s, o) => s + Number(o.tax || 0), 0);
      const netEarnings = totalRevenue - totalRoyalty;

      // Revenue by day
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

      // Top items
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

      // Status breakdown
      const statusCounts = ["pending", "preparing", "ready", "completed"].map(
        (s) => ({
          name: s,
          value: orders.filter((o) => o.status === s).length,
        })
      );

      // Customer count
      const uniquePhones = new Set<string>();
      completed.forEach((o) => {
        if (o.customer_phone) uniquePhones.add(o.customer_phone);
      });
      const totalCustomers = uniquePhones.size;
      const newThisWeek = completed.filter(
        (o) => o.customer_phone && new Date(o.created_at) >= weekAgo
      );
      const newCustomerPhonesThisWeek = new Set<string>();
      newThisWeek.forEach((o) => {
        if (o.customer_phone) newCustomerPhonesThisWeek.add(o.customer_phone);
      });

      // Peak hours
      const hourCounts: Record<number, number> = {};
      (allOrdersForPeak || []).forEach((o) => {
        const h = new Date(o.created_at).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      const peakHours = HOURS.map((h) => ({
        hour: h.label,
        orders: hourCounts[h.hour] || 0,
      }));

      // Week-over-week comparison
      const currentWeekOrders = completed.filter(
        (o) => new Date(o.created_at) >= weekAgo
      );
      const prevWeekOrders = completed.filter(
        (o) =>
          new Date(o.created_at) >= twoWeeksAgo &&
          new Date(o.created_at) < weekAgo
      );
      const currentWeekRevenue = currentWeekOrders.reduce(
        (s, o) => s + Number(o.total),
        0
      );
      const prevWeekRevenue = prevWeekOrders.reduce(
        (s, o) => s + Number(o.total),
        0
      );

      // Payment method breakdown (if available from order_type or future payment field)
      // Using order_type as proxy for payment method analysis
      const paymentBreakdown = [
        { name: "QR Orders", value: orders.filter((o) => o.order_type === "qr").length },
        { name: "Dine-in", value: orders.filter((o) => o.order_type === "dine_in").length },
        { name: "Takeaway", value: orders.filter((o) => o.order_type === "takeaway").length },
      ].filter((p) => p.value > 0);

      setStats({
        totalOrders: completed.length,
        totalRevenue: Math.round(totalRevenue),
        netEarnings: Math.round(netEarnings),
        totalTax: Math.round(totalTax),
        totalRoyalty: Math.round(totalRoyalty),
        avgOrderValue:
          completed.length > 0
            ? Math.round(totalRevenue / completed.length)
            : 0,
        revenueByDay,
        topItems,
        statusCounts,
        totalCustomers,
        newCustomersThisWeek: newCustomerPhonesThisWeek.size,
        peakHours,
        currentWeekRevenue: Math.round(currentWeekRevenue),
        prevWeekRevenue: Math.round(prevWeekRevenue),
        currentWeekOrders: currentWeekOrders.length,
        prevWeekOrders: prevWeekOrders.length,
        paymentBreakdown,
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, [cafeId]);

  const downloadCSV = () => {
    if (!stats) return;
    const rows = [
      ["Metric", "Value"],
      ["Total Orders", stats.totalOrders],
      ["Total Revenue", stats.totalRevenue],
      ["Net Earnings", stats.netEarnings],
      ["Total Tax", stats.totalTax],
      ["Total Royalty", stats.totalRoyalty],
      ["Avg Order Value", stats.avgOrderValue],
      ["Total Customers", stats.totalCustomers],
      ["New Customers (This Week)", stats.newCustomersThisWeek],
      ["", ""],
      ["Revenue by Day", ""],
      ...stats.revenueByDay.map((d: any) => [d.date, d.revenue]),
      ["", ""],
      ["Top Items", ""],
      ...stats.topItems.map((i: any) => [i.name, `${i.qty} sold, ₹${i.revenue}`]),
      ["", ""],
      ["Peak Hours", ""],
      ...stats.peakHours.map((h: any) => [h.hour, `${h.orders} orders`]),
    ];
    const csv = rows.map((r: any[]) => r.map((c: any) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Performance insights and reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <select
              value={selectedCafeId || ""}
              onChange={(e) => setSelectedCafeId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
            >
              {cafes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Report
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-primary/15">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{(stats?.totalRevenue || 0).toLocaleString()}
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
              <p className="text-xs text-muted-foreground">Net Earnings</p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{(stats?.netEarnings || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-secondary/15">
              <ShoppingBag className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-xl sm:text-2xl font-bold">
                {stats?.totalOrders || 0}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-chart-4/15">
              <Star className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg. Order Value</p>
              <p className="text-xl sm:text-2xl font-bold">
                ₹{(stats?.avgOrderValue || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Customer Count and Peak Hours Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">Customer Count</h3>
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalCustomers || 0}</p>
                <p className="text-xs text-muted-foreground">Total Customers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/10">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.newCustomersThisWeek || 0}</p>
                <p className="text-xs text-muted-foreground">New This Week</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold">Peak Hours</h3>
          </div>
          <div className="h-40 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.peakHours}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="#9e9e9e" fontSize={9} interval={2} />
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
                <Bar dataKey="orders" fill="oklch(0.63 0.18 290)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      {/* Revenue + Top Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base sm:text-lg font-semibold">
              Revenue (Last 7 Days)
            </h3>
            <button
              onClick={() => setShowWeekCompare(!showWeekCompare)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted border border-border hover:bg-muted/80 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {showWeekCompare ? "Hide Comparison" : "Week-over-Week"}
            </button>
          </div>
          {showWeekCompare && (
            <div className="grid grid-cols-2 gap-3 mb-4 pb-4 border-b border-border">
              <div className="p-3 rounded-lg bg-accent/10">
                <p className="text-xs text-muted-foreground">This Week</p>
                <p className="text-lg font-bold text-accent">₹{(stats?.currentWeekRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats?.currentWeekOrders || 0} orders</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10">
                <p className="text-xs text-muted-foreground">Previous Week</p>
                <p className="text-lg font-bold text-secondary">₹{(stats?.prevWeekRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats?.prevWeekOrders || 0} orders</p>
              </div>
            </div>
          )}
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
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
                  fill="oklch(0.58 0.12 195)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            Top Selling Items
          </h3>
          <div className="space-y-3">
            {stats?.topItems.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                    #{i + 1}
                  </span>
                  <span className="text-sm truncate">{item.name}</span>
                </div>
                <div className="text-right shrink-0">
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

      {/* Payment Method Breakdown */}
      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Order Type Breakdown
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <div className="h-40 w-40 sm:h-48 sm:w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.paymentBreakdown?.filter((s: any) => s.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {stats?.paymentBreakdown
                    ?.filter((s: any) => s.value > 0)
                    .map((_: any, idx: number) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {stats?.paymentBreakdown?.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: COLORS[i] }}
                />
                <span className="text-sm">{s.name}:</span>
                <span className="text-sm font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold mb-4">
          Order Status Breakdown
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
          <div className="h-40 w-40 sm:h-48 sm:w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.statusCounts.filter((s: any) => s.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={70}
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
                  className="w-3 h-3 rounded-full shrink-0"
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