"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/types/database";
import { Loader2, Clock, CheckCircle, ChefHat } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";

const statusColors: Record<
  string,
  "default" | "secondary" | "accent" | "success" | "destructive"
> = {
  pending: "default",
  preparing: "secondary",
  ready: "accent",
  completed: "success",
  cancelled: "destructive" as const,
};

export default function OrdersPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
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

  const fetchOrders = async () => {
    if (!cafeId) return;
    let query = supabase
      .from("orders")
      .select("*, order_items(*, menu_item:menu_items(name))")
      .eq("cafe_id", cafeId)
      .order("created_at", { ascending: false });

    if (filter !== "all" && filter !== "cancelled") {
      query = query.eq("status", filter);
    } else if (filter === "cancelled") {
      query = query.eq("status", "cancelled");
    }

    const { data } = await query;
    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [filter, cafeId]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => fetchOrders()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) toast.error(error.message);
    else toast.success(`Order ${newStatus}`);
    fetchOrders();
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
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Orders
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          View and manage orders
        </p>
      </div>

      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cafe:</span>
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
        </div>
      )}

      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {["all", "pending", "preparing", "ready", "completed", "cancelled"].map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors min-h-[36px] ${
                filter === s
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {s}
            </button>
          )
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {orders.map((order: any) => (
          <GlassCard key={order.id} className="p-3 sm:p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={
                      (statusColors[order.status] as any) || "default"
                    }
                  >
                    {order.status}
                  </Badge>
                  <Badge variant="default">
                    {order.order_type === "qr"
                      ? "QR"
                      : order.order_type === "takeaway"
                        ? "Takeaway"
                        : "Dine In"}
                  </Badge>
                </div>
                {order.table && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Table: {order.table.table_number}
                  </p>
                )}
                {order.customer_name && (
                  <p className="text-xs text-muted-foreground">
                    {order.customer_name}{" "}
                    {order.customer_phone
                      ? `· ${order.customer_phone}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-primary">
                  ₹{Number(order.total).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(order.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-1.5">
              {order.order_items?.map((oi: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>
                    {oi.quantity}x {oi.menu_item?.name || "Item"}
                  </span>
                  <span className="text-muted-foreground">
                    ₹{Number(oi.subtotal).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            {order.status !== "completed" &&
              order.status !== "cancelled" && (
                <div className="flex gap-1.5 mt-3 pt-3 border-t border-border flex-wrap">
                  {order.status === "pending" && (
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors min-h-[40px]"
                    >
                      <ChefHat className="w-3.5 h-3.5" /> Preparing
                    </button>
                  )}
                  {(order.status === "pending" ||
                    order.status === "preparing") && (
                    <button
                      onClick={() => updateStatus(order.id, "ready")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors min-h-[40px]"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Ready
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(order.id, "completed")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-colors min-h-[40px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Complete
                  </button>
                </div>
              )}
          </GlassCard>
        ))}
        {orders.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8 text-sm">
            No orders found
          </p>
        )}
      </div>
    </div>
  );
}
