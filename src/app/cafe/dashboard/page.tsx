"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import {
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  ChefHat,
  CheckCircle2,
  UtensilsCrossed,
  ClipboardList,
  LayoutGrid,
  RefreshCw,
  ArrowRight,
  Coffee,
} from "lucide-react";
import {
  AreaChart,
  Area,
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

/* ---------- Types ---------- */

interface OrderRecord {
  id: string;
  total: number;
  royalty_amount?: number;
  status: string;
  created_at: string;
  table_id?: string | number;
}

interface MenuItemRecord {
  id: string;
  name: string;
  stock_quantity: number | null;
  low_stock_threshold: number | null;
}

interface OrderItemRecord {
  menu_item_id: string;
  quantity: number;
  menu_items?: { name: string } | null;
}

/* ---------- Constants ---------- */

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: { label: "Pending", color: "#f59e0b", icon: Clock },
  preparing: { label: "Preparing", color: "#6366f1", icon: ChefHat },
  ready: { label: "Ready", color: "#a855f7", icon: UtensilsCrossed },
  completed: { label: "Completed", color: "#10b981", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "#ef4444", icon: AlertTriangle },
};

const STATUS_VARIANT: Record<string, "warning" | "secondary" | "accent" | "success" | "destructive" | "default"> = {
  pending: "warning",
  preparing: "secondary",
  ready: "accent",
  completed: "success",
  cancelled: "destructive",
};

function startOfLocalDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ---------- Skeleton components ---------- */

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-white/[0.04]", className)} />;
}

function StatCardSkeleton() {
  return (
    <GlassCard className="p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-7 w-24" />
    </GlassCard>
  );
}

function RevenueChartSkeleton() {
  return (
    <GlassCard className="p-5">
      <Skeleton className="h-4 w-36 mb-4" />
      <Skeleton className="h-52 w-full" />
    </GlassCard>
  );
}

function OrdersListSkeleton() {
  return (
    <GlassCard className="p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between py-3 border-b border-white/[0.04] last:border-0"
        >
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
      ))}
    </GlassCard>
  );
}

function PieSkeleton() {
  return (
    <GlassCard className="p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="flex justify-center">
        <Skeleton className="h-36 w-36 rounded-full" />
      </div>
    </GlassCard>
  );
}

function TopItemsSkeleton() {
  return (
    <GlassCard className="p-5">
      <Skeleton className="h-4 w-24 mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-3">
          <Skeleton className="h-3.5 w-4" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-10" />
        </div>
      ))}
    </GlassCard>
  );
}

function QuickActionsSkeleton() {
  return (
    <GlassCard className="p-5">
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </GlassCard>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="p-3 rounded-full bg-white/[0.03] ring-1 ring-white/[0.06] mb-4">
        <Icon className="w-6 h-6 text-muted-foreground/50" />
      </div>
      <h4 className="text-sm font-medium mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-[220px]">{description}</p>
    </div>
  );
}

/* ---------- Main Component ---------- */

export default function CafeAdminDashboard() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const supabaseRef = useRef(createClient());
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  // Dashboard data
  const [stats, setStats] = useState<{
    todayRevenue: number;
    totalOrdersToday: number;
    pendingOrders: number;
    netEarnings: number;
    revenueChange: number;
  } | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<{ date: string; revenue: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderRecord[]>([]);
  const [lowStock, setLowStock] = useState<MenuItemRecord[]>([]);
  const [topItems, setTopItems] = useState<{ name: string; quantity: number }[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<
    { name: string; value: number; color: string }[]
  >([]);

  // UI
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tickTimerRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------- Data fetching ---------- */

  const fetchData = useCallback(async (silent = false) => {
    if (!cafeId) return;
    if (!silent) setLoading(true);
    try {
      const now = new Date();
      const todayISO = startOfLocalDay(now);
      const yesterdayISO = startOfLocalDay(new Date(now.getTime() - 86400000));
      const sevenDaysAgo = startOfLocalDay(new Date(now.getTime() - 7 * 86400000));

      const [ordersRes, menuRes] = await Promise.all([
        supabaseRef.current
          .from("orders")
          .select("*")
          .eq("cafe_id", cafeId)
          .order("created_at", { ascending: false }),
        supabaseRef.current
          .from("menu_items")
          .select("*")
          .eq("cafe_id", cafeId),
      ]);

      const allOrders = ordersRes.data || [];
      const menuItems = menuRes.data || [];

      // Order items for top-items analysis
      let orderItemsAll: OrderItemRecord[] = [];
      if (allOrders.length > 0) {
        const orderIds = allOrders.slice(0, 300).map((o) => o.id);
        const { data: oi } = await supabaseRef.current
          .from("order_items")
          .select("menu_item_id, quantity, menu_items(name)")
          .in("order_id", orderIds);
        orderItemsAll = (oi as unknown as OrderItemRecord[]) || [];
      }

      // --- Stats ---
      const completed = allOrders.filter((o) => o.status !== "cancelled");

      const todayOrders = completed.filter((o) => o.created_at >= todayISO);
      const yesterdayOrders = completed.filter(
        (o) => o.created_at >= yesterdayISO && o.created_at < todayISO
      );
      const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total), 0);
      const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + Number(o.total), 0);

      const revenueChange =
        yesterdayRevenue > 0
          ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
          : todayRevenue > 0
            ? 100
            : 0;

      const totalRoyalty = completed.reduce((s, o) => s + Number(o.royalty_amount || 0), 0);

      setStats({
        todayRevenue: Math.round(todayRevenue),
        totalOrdersToday: todayOrders.length,
        pendingOrders: allOrders.filter((o) => o.status === "pending").length,
        netEarnings: Math.round(todayRevenue - totalRoyalty),
        revenueChange,
      });

      // --- Revenue by day (last 7) ---
      const daysMap: Record<string, number> = {};
      completed.forEach((o) => {
        const day = o.created_at.split("T")[0];
        if (new Date(day) >= new Date(sevenDaysAgo.split("T")[0])) {
          daysMap[day] = (daysMap[day] || 0) + Number(o.total);
        }
      });
      const daysArr: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400000);
        const dateStr = d.toISOString().split("T")[0];
        daysArr.push({ date: dateStr, revenue: Math.round(daysMap[dateStr] || 0) });
      }
      setRevenueByDay(daysArr);

      // --- Recent orders ---
      setRecentOrders(allOrders.slice(0, 8));

      // --- Low stock ---
      const low = (menuItems as MenuItemRecord[]).filter(
        (i) =>
          i.stock_quantity !== null &&
          i.low_stock_threshold !== null &&
          i.stock_quantity <= i.low_stock_threshold
      );
      setLowStock(low);

      // --- Top items ---
      const itemMap: Record<string, { name: string; quantity: number }> = {};
      orderItemsAll.forEach((oi) => {
        const id = oi.menu_item_id;
        if (!id) return;
        if (!itemMap[id]) {
          itemMap[id] = {
            name: oi.menu_items?.name || `Item ${String(id).slice(0, 6)}`,
            quantity: 0,
          };
        }
        itemMap[id].quantity += oi.quantity || 1;
      });
      const sortedItems = Object.values(itemMap)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);
      setTopItems(sortedItems);

      // --- Status breakdown ---
      const statusCounts: Record<string, number> = { pending: 0, preparing: 0, ready: 0, completed: 0 };
      allOrders.forEach((o) => {
        if (statusCounts[o.status] !== undefined) {
          statusCounts[o.status]++;
        }
      });
      setStatusBreakdown(
        Object.entries(statusCounts)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({
            name: STATUS_CONFIG[k]?.label || k,
            value: v,
            color: STATUS_CONFIG[k]?.color || "#6b7280",
          }))
      );

      setLastUpdated(new Date());
      setSecondsAgo(0);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      toast.error("Could not refresh dashboard");
    } finally {
      setLoading(false);
    }
  }, [cafeId]);

  /* ---------- Effects ---------- */

  // Load cafe list for super admin
  useEffect(() => {
    if (isSuperAdmin) {
      supabaseRef.current
        .from("cafes")
        .select("id, name")
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) {
            setCafes(data);
            if (data.length > 0 && !selectedCafeId) {
              setSelectedCafeId(data[0].id);
            }
          }
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  // Fetch on cafe change
  useEffect(() => {
    if (!cafeId) return;
    const t = setTimeout(() => fetchData(false), 0);
    return () => clearTimeout(t);
  }, [cafeId, fetchData]);

  // Auto-refresh every 30s (silent)
  useEffect(() => {
    if (!cafeId) return;
    refreshTimerRef.current = setInterval(() => fetchData(true), 30000);
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [cafeId, fetchData]);

  // "seconds ago" tick
  useEffect(() => {
    if (!lastUpdated) return;
    tickTimerRef.current = setInterval(() => {
      setSecondsAgo((p) => p + 1);
    }, 1000);
    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [lastUpdated]);

  /* ---------- Loading skeleton ---------- */

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 pb-8">
        <div>
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <RevenueChartSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="lg:col-span-2">
            <OrdersListSkeleton />
          </div>
          <PieSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <TopItemsSkeleton />
          <QuickActionsSkeleton />
        </div>
      </div>
    );
  }

  /* ---------- Dashboard ---------- */

  return (
    <div className="space-y-4 sm:space-y-6 pb-8">
      {/* ===== Header ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Real-time overview of your cafe
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <select
              value={selectedCafeId || ""}
              onChange={(e) => setSelectedCafeId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.08] text-sm outline-none focus:border-primary/40 transition-colors"
            >
              {cafes.map((c) => (
                <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
              <RefreshCw className="w-3 h-3" />
              <span>Updated {secondsAgo}s ago</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== Stat Cards ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Revenue */}
        <GlassCard className="p-5 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/[0.12] ring-1 ring-emerald-500/[0.18]">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              {stats && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    stats.revenueChange >= 0
                      ? "bg-emerald-500/[0.12] text-emerald-400"
                      : "bg-red-500/[0.12] text-red-400"
                  )}
                >
                  {stats.revenueChange >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(stats.revenueChange)}%
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">
              Today&apos;s Revenue
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums tracking-tight">
              ₹{stats?.todayRevenue?.toLocaleString() || "0"}
            </p>
          </div>
        </GlassCard>

        {/* Total Orders Today */}
        <GlassCard className="p-5 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-blue-500/[0.12] ring-1 ring-blue-500/[0.18]">
                <ClipboardList className="w-5 h-5 text-blue-400" />
              </div>
              {stats && (
                <div className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/[0.12] text-blue-400">
                  <ShoppingBag className="w-3 h-3" />
                  Today
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">
              Total Orders
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums tracking-tight">
              {stats?.totalOrdersToday || 0}
            </p>
          </div>
        </GlassCard>

        {/* Pending Orders */}
        <GlassCard
          className={cn(
            "p-5 group overflow-hidden relative",
            stats && stats.pendingOrders > 0 && "ring-1 ring-amber-500/[0.25]"
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-amber-500/[0.12] ring-1 ring-amber-500/[0.18]">
                <Clock
                  className={cn(
                    "w-5 h-5 text-amber-400",
                    stats && stats.pendingOrders > 0 && "animate-pulse"
                  )}
                />
              </div>
              {stats && stats.pendingOrders > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">
              Pending Orders
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums tracking-tight">
              {stats?.pendingOrders || 0}
            </p>
          </div>
        </GlassCard>

        {/* Net Earnings */}
        <GlassCard className="p-5 group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-purple-500/[0.12] ring-1 ring-purple-500/[0.18]">
                <TrendingUp className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground/70 uppercase tracking-wider font-medium">
              Net Earnings
            </p>
            <p className="text-2xl font-bold mt-1 tabular-nums tracking-tight">
              ₹{stats?.netEarnings?.toLocaleString() || "0"}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* ===== Low Stock Banner ===== */}
      {lowStock.length > 0 && (
        <GlassCard className="border-amber-500/[0.2] bg-amber-500/[0.03]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-1">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-500/[0.12] shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-200 text-sm">Low Stock Alert</h3>
                <p className="text-xs text-amber-300/60 mt-0.5 leading-relaxed">
                  {lowStock.slice(0, 5).map((item, i) => (
                    <span key={item.id}>
                      <span className="text-amber-100 font-medium">{item.name}</span>
                      <span className="text-amber-400/40"> ({item.stock_quantity} left)</span>
                      {i < Math.min(lowStock.length, 5) - 1 && ", "}
                    </span>
                  ))}
                  {lowStock.length > 5 && (
                    <span className="text-amber-300/60"> +{lowStock.length - 5} more</span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href="/cafe/inventory"
              className="shrink-0 px-4 py-2 rounded-lg bg-amber-500/[0.14] hover:bg-amber-500/[0.22] text-amber-300 text-sm font-medium transition-colors inline-flex items-center gap-1.5 self-start sm:self-center"
            >
              Update Stock
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </GlassCard>
      )}

      {/* ===== Revenue Chart ===== */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
            Revenue (Last 7 Days)
          </h3>
          <Badge variant="success" className="text-[10px] py-0 px-2">
            <TrendingUp className="w-3 h-3 mr-1" />
            Weekly
          </Badge>
        </div>
        {revenueByDay.every((d) => d.revenue === 0) ? (
          <EmptyState
            icon={DollarSign}
            title="No revenue data"
            description="Revenue will appear here after you start processing orders"
          />
        ) : (
          <div className="h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueByDay} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => {
                    const parts = d.split("-");
                    return `${parts[2]}/${parts[1]}`;
                  }}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) =>
                    v > 0 ? `₹${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : "0"
                  }
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(8,8,16,0.98)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "0.75rem",
                    color: "#f8f8f8",
                    fontSize: "12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                  formatter={(value) =>
                    `₹${Number(value).toLocaleString()}` as ReactNode
                  }
                  labelFormatter={(label) => {
                    try {
                      return format(new Date(label), "MMM dd, yyyy");
                    } catch {
                      return label;
                    }
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  dot={{ fill: "#10b981", strokeWidth: 0, r: 3 }}
                  activeDot={{
                    fill: "#10b981",
                    strokeWidth: 2,
                    stroke: "#064e3b",
                    r: 5,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </GlassCard>

      {/* ===== Recent Orders + Order Status Pie ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Recent Orders */}
        <GlassCard className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70">
              Recent Orders
            </h3>
            <Link
              href="/cafe/orders"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No orders yet"
              description="Take orders from the POS to see them listed here"
            />
          ) : (
            <div className="space-y-0.5 -mx-2">
              {recentOrders.map((order) => {
                const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                let timeAgo = "";
                try {
                  timeAgo = formatDistanceToNow(new Date(order.created_at), {
                    addSuffix: true,
                  });
                } catch {
                  // ignore parse errors on invalid dates
                }
                return (
                  <Link
                    key={order.id}
                    href={`/cafe/orders/${order.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-mono text-muted-foreground/50 shrink-0 w-14">
                        #{String(order.id).slice(-6)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {order.table_id ? `Table ${order.table_id}` : "Walk-in"}
                        </p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">{timeAgo}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">
                        ₹{Number(order.total).toLocaleString()}
                      </span>
                      <Badge
                        variant={STATUS_VARIANT[order.status] || "default"}
                        className="text-[10px] px-2 py-0.5"
                      >
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Order Status Pie */}
        <GlassCard className="p-5">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70 mb-4">
            Order Status
          </h3>
          {statusBreakdown.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="No data"
              description="Order breakdown will appear once orders come in"
            />
          ) : (
            <div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,8,16,0.98)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "0.75rem",
                        color: "#f8f8f8",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
                {statusBreakdown.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-muted-foreground/60">{s.name}</span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ===== Top Items + Quick Actions ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Top Items */}
        <GlassCard className="p-5">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70 mb-4">
            Top Items
          </h3>
          {topItems.length === 0 ? (
            <EmptyState
              icon={Coffee}
              title="No items data"
              description="Popular items will be ranked here after orders come through"
            />
          ) : (
            <div className="space-y-3.5">
              {topItems.map((item, i) => {
                const maxQty = topItems[0]?.quantity || 1;
                const pct = Math.round((item.quantity / maxQty) * 100);
                const gradients = [
                  "from-emerald-400 to-emerald-500",
                  "from-blue-400 to-blue-500",
                  "from-purple-400 to-purple-500",
                  "from-amber-400 to-amber-500",
                  "from-rose-400 to-rose-500",
                ];
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-medium text-muted-foreground/40 w-4 tabular-nums">
                          {i + 1}
                        </span>
                        <span className="truncate text-[13px]">{item.name}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50 tabular-nums ml-2 shrink-0">
                        {item.quantity} sold
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out",
                          gradients[i] || gradients[0]
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Quick Actions */}
        <GlassCard className="p-5">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground/70 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: "POS",
                desc: "Take orders",
                href: "/cafe/pos",
                icon: Coffee,
                gradient: "from-emerald-500/[0.12] to-emerald-600/[0.06]",
                ring: "ring-emerald-500/[0.15]",
                ic: "text-emerald-400",
              },
              {
                label: "Menu",
                desc: "Manage items",
                href: "/cafe/menu",
                icon: UtensilsCrossed,
                gradient: "from-blue-500/[0.12] to-blue-600/[0.06]",
                ring: "ring-blue-500/[0.15]",
                ic: "text-blue-400",
              },
              {
                label: "Orders",
                desc: "View all orders",
                href: "/cafe/orders",
                icon: ClipboardList,
                gradient: "from-purple-500/[0.12] to-purple-600/[0.06]",
                ring: "ring-purple-500/[0.15]",
                ic: "text-purple-400",
              },
              {
                label: "Tables",
                desc: "Floor plan",
                href: "/cafe/tables",
                icon: LayoutGrid,
                gradient: "from-amber-500/[0.12] to-amber-600/[0.06]",
                ring: "ring-amber-500/[0.15]",
                ic: "text-amber-400",
              },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className={cn(
                  "p-4 rounded-xl border border-white/[0.04] bg-gradient-to-br transition-all duration-300",
                  "hover:scale-[1.02] hover:border-white/[0.08]",
                  a.gradient
                )}
              >
                <div className={cn("p-2 rounded-lg w-fit mb-3", a.ring, "ring-1")}>
                  <a.icon className={cn("w-4 h-4", a.ic)} />
                </div>
                <h4 className="text-sm font-semibold">{a.label}</h4>
                <p className="text-[11px] text-muted-foreground/50 mt-0.5">{a.desc}</p>
              </Link>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
