"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/types/database";
import { Loader2, Clock, ChefHat, CheckCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const statusSteps: { status: string; label: string; color: string; icon: React.ReactNode }[] = [
  { status: "pending", label: "New", color: "oklch(0.66 0.19 258.5)", icon: <AlertTriangle className="w-4 h-4" /> },
  { status: "preparing", label: "Preparing", color: "oklch(0.63 0.18 290)", icon: <ChefHat className="w-4 h-4" /> },
  { status: "ready", label: "Ready", color: "oklch(0.58 0.12 195)", icon: <CheckCircle className="w-4 h-4" /> },
];

export default function KitchenDisplay() {
  const { profile } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const supabase = createClient();
  const cafeId = profile?.cafe_id;
  const isSuperAdmin = profile?.role === "super_admin";

  const effectiveCafeId = isSuperAdmin ? selectedCafeId : cafeId;

  const fetchOrders = async () => {
    if (!effectiveCafeId) { setLoading(false); return; }
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*, menu_item:menu_items(name)), table:tables(table_number)")
      .eq("cafe_id", effectiveCafeId)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin && !cafes.length) {
      supabase.from("cafes").select("id, name").then(({ data }) => {
        if (data) {
          setCafes(data);
          if (data.length > 0) setSelectedCafeId(data[0].id);
        }
      });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (effectiveCafeId) fetchOrders();
  }, [effectiveCafeId]);

  useEffect(() => {
    if (!effectiveCafeId) return;
    const channel = supabase
      .channel("kds-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${effectiveCafeId}`,
        },
        () => fetchOrders()
      )
      .subscribe();

    const interval = setInterval(fetchOrders, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [effectiveCafeId]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) toast.error(error.message);
    fetchOrders();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const activeOrders = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");
  const pending = activeOrders.filter((o) => o.status === "pending");
  const preparing = activeOrders.filter((o) => o.status === "preparing");
  const ready = activeOrders.filter((o) => o.status === "ready");

  return (
    <div className="min-h-screen p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="w-8 h-8 text-accent" />
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Kitchen Display
          </h1>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-6rem)]">
        {/* Pending Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            <h2 className="font-bold text-primary">New Orders</h2>
            <Badge variant="default">{pending.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {pending.map((order: any) => (
              <KdsCard
                key={order.id}
                order={order}
                onUpdateStatus={updateStatus}
                nextStatus="preparing"
                accentColor="oklch(0.66 0.19 258.5)"
                urgency="high"
              />
            ))}
          </div>
        </div>

        {/* Preparing Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 rounded-full bg-secondary" />
            <h2 className="font-bold text-secondary">Preparing</h2>
            <Badge variant="secondary">{preparing.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {preparing.map((order: any) => (
              <KdsCard
                key={order.id}
                order={order}
                onUpdateStatus={updateStatus}
                nextStatus="ready"
                accentColor="oklch(0.63 0.18 290)"
                urgency="medium"
              />
            ))}
          </div>
        </div>

        {/* Ready Column */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <h2 className="font-bold text-accent">Ready</h2>
            <Badge variant="accent">{ready.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {ready.map((order: any) => (
              <KdsCard
                key={order.id}
                order={order}
                onUpdateStatus={updateStatus}
                nextStatus="completed"
                accentColor="oklch(0.58 0.12 195)"
                urgency="low"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KdsCard({
  order,
  onUpdateStatus,
  nextStatus,
  accentColor,
  urgency,
}: {
  order: any;
  onUpdateStatus: (id: string, status: string) => void;
  nextStatus: string;
  accentColor: string;
  urgency: "high" | "medium" | "low";
}) {
  const elapsed = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
  });

  const isUrgent = urgency === "high" &&
    new Date().getTime() - new Date(order.created_at).getTime() > 5 * 60 * 1000;

  return (
    <GlassCard
      className="p-4"
      style={{ borderColor: isUrgent ? "rgba(255, 93, 90, 0.5)" : undefined }}
      neon={urgency === "high"}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            {order.table && (
              <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full">
                {order.table.table_number}
              </span>
            )}
            <span className="text-xs text-muted-foreground capitalize">
              {order.order_type}
            </span>
          </div>
          {order.customer_name && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {order.customer_name}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {elapsed}
          </p>
          {isUrgent && (
            <span className="text-xs text-destructive font-bold animate-pulse mt-0.5 block">
              URGENT
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-1">
        {order.order_items?.map((oi: any, i: number) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="font-medium">
              {oi.quantity}x {oi.menu_item?.name || "Item"}
            </span>
            {oi.notes && (
              <span className="text-xs text-muted-foreground ml-2">
                Note: {oi.notes}
              </span>
            )}
          </div>
        ))}
      </div>

      {order.notes && (
        <p className="text-xs text-chart-5 mt-2 p-2 rounded bg-chart-5/10">
          {order.notes}
        </p>
      )}

      {nextStatus !== "completed" && (
        <button
          onClick={() => onUpdateStatus(order.id, nextStatus)}
          className="w-full mt-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:opacity-90"
          style={{ background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}40` }}
        >
          {nextStatus === "preparing" ? "Start Preparing" : nextStatus === "ready" ? "Mark Ready" : nextStatus}
        </button>
      )}

      {nextStatus === "completed" && (
        <button
          onClick={() => onUpdateStatus(order.id, "completed")}
          className="w-full mt-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-chart-4/15 text-chart-4 border border-chart-4/30 hover:bg-chart-4/25 transition-colors"
        >
          Complete Order
        </button>
      )}
    </GlassCard>
  );
}
