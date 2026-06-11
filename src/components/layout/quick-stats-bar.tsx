"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { DollarSign, Clock, ShoppingBag } from "lucide-react";

function startOfLocalDay(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function QuickStatsBar() {
  const { profile } = useAuthStore();
  const cafeId = profile?.cafe_id;
  const [stats, setStats] = useState<{
    todayRevenue: number;
    ordersToday: number;
    pending: number;
  } | null>(null);

  useEffect(() => {
    if (!cafeId) return;
    const supabase = createClient();

    const fetchStats = async () => {
      const todayISO = startOfLocalDay(new Date());
      const { data: orders } = await supabase
        .from("orders")
        .select("status, total, created_at")
        .eq("cafe_id", cafeId);

      if (!orders) return;

      const todayOrders = orders.filter((o) => o.created_at >= todayISO);
      const todayCompleted = todayOrders.filter((o) => o.status !== "cancelled");
      const todayRevenue = todayCompleted.reduce((s, o) => s + Number(o.total), 0);
      const pending = orders.filter((o) => o.status === "pending").length;

      setStats({
        todayRevenue: Math.round(todayRevenue),
        ordersToday: todayOrders.length,
        pending,
      });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [cafeId]);

  if (!cafeId || !profile || profile.role === "customer") return null;

  return (
    <div className="border-b border-border bg-card/30 backdrop-blur">
      <div className="flex items-center gap-1 sm:gap-2 px-4 py-1.5 text-xs text-muted-foreground overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold text-foreground tabular-nums">
            ₹{stats?.todayRevenue?.toLocaleString() || "0"}
          </span>
          <span className="text-muted-foreground/50">today</span>
        </div>
        <span className="text-muted-foreground/20">|</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold text-foreground tabular-nums">
            {stats?.ordersToday || 0}
          </span>
          <span className="text-muted-foreground/50">orders</span>
        </div>
        <span className="text-muted-foreground/20">|</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Clock className={cn("w-3.5 h-3.5", stats && stats.pending > 0 ? "text-amber-400 animate-pulse" : "text-muted-foreground")} />
          <span className={cn("font-semibold tabular-nums", stats && stats.pending > 0 ? "text-amber-400" : "text-foreground")}>
            {stats?.pending || 0}
          </span>
          <span className="text-muted-foreground/50">pending</span>
        </div>
      </div>
    </div>
  );
}
