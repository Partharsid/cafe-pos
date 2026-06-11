"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, CheckCircle, ChefHat, Printer, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";

const statusColors: Record<string, "default" | "secondary" | "accent" | "success" | "destructive"> = {
  pending: "default",
  preparing: "secondary",
  ready: "accent",
  completed: "success",
  cancelled: "destructive" as const,
};

export default function OrderDetailPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{id:string, name:string}[]>([]);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("cafes").select("id, name").eq("is_active", true).then(({data}) => {
        if (data) { setCafes(data); if (data.length > 0) setSelectedCafeId(data[0].id); }
      });
    }
  }, [isSuperAdmin]);

  const fetchOrder = async () => {
    if (!orderId) return;
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*, menu_item:menu_items(name)), table:tables(table_number)")
      .eq("id", orderId)
      .single();

    if (error) {
      toast.error("Order not found");
      router.push("/cafe/orders");
      return;
    }
    setOrder(data);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchOrder();
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    const channel = supabase
      .channel("order-detail-" + orderId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...payload.new }));
          toast.success(`Order status: ${(payload.new as any).status}`);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, order]);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) toast.error(error.message);
    else {
      setOrder((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Order ${newStatus}`);
    }
  };

  const handlePrint = () => {
    if (!order) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const tableLabel = order.table?.table_number
      ? `Table: ${order.table.table_number}`
      : order.order_type === "takeaway"
        ? "Takeaway"
        : "QR Order";
    const itemList = order.order_items
      ?.map(
        (oi: any) =>
          `<p>${oi.quantity}x ${oi.menu_item?.name || "Item"} - ₹${Number(oi.subtotal).toFixed(0)}</p>`
      )
      .join("");
    w.document.write(`<html><head><title>Order #${order.id.slice(-8)}</title>
<style>body{font-family:monospace;padding:20px;font-size:14px;line-height:1.5}
h3{margin:0 0 8px}hr{margin:16px 0;border:0;border-top:1px dashed #ccc}
.total{font-size:18px;font-weight:bold}</style></head><body>
<h3>Order #${order.id.slice(-8)}</h3>
<p>${tableLabel} | ${new Date(order.created_at).toLocaleString()}</p>
${order.customer_name ? `<p>Customer: ${order.customer_name}${order.customer_phone ? " · " + order.customer_phone : ""}</p>` : ""}
<hr>${itemList}
<hr><p class="total">Subtotal: ₹${Number(order.subtotal).toFixed(2)}</p>
<p>Tax (5%): ₹${Number(order.tax).toFixed(2)}</p>
<p class="total" style="margin-top:8px">Total: ₹${Number(order.total).toFixed(2)}</p>
</body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <button
        onClick={() => router.push("/cafe/orders")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Orders
      </button>

      <GlassCard>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={statusColors[order.status] || "default"}>
                {order.status}
              </Badge>
              <Badge variant="default">
                {order.order_type === "qr" ? "QR" : order.order_type === "takeaway" ? "Takeaway" : "Dine In"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">
              Order #{order.id.slice(-8)}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              {" · "}
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {order.table && (
            <div>
              <p className="text-xs text-muted-foreground">Table</p>
              <p className="text-sm font-semibold">{order.table.table_number}</p>
            </div>
          )}
          {order.customer_name && (
            <div>
              <p className="text-xs text-muted-foreground">Customer</p>
              <p className="text-sm font-semibold">{order.customer_name}</p>
            </div>
          )}
          {order.customer_phone && (
            <div>
              <p className="text-xs text-muted-foreground">Phone</p>
              <p className="text-sm font-semibold">{order.customer_phone}</p>
            </div>
          )}
        </div>

        <div className="border-t border-border pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Order Items</h3>
          {order.order_items?.map((oi: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div>
                <p className="text-sm font-medium">
                  {oi.quantity}x {oi.menu_item?.name || "Item"}
                </p>
                {oi.notes && (
                  <p className="text-xs text-muted-foreground">{oi.notes}</p>
                )}
              </div>
              <p className="text-sm font-semibold">
                ₹{Number(oi.subtotal).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 mt-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>₹{Number(order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (5%)</span>
            <span>₹{Number(order.tax).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Royalty</span>
            <span>₹{Number(order.royalty_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-border pt-2 mt-2">
            <span>Total</span>
            <span className="text-primary">₹{Number(order.total).toFixed(2)}</span>
          </div>
        </div>

        {order.status !== "completed" && order.status !== "cancelled" && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-border">
            {order.status === "pending" && (
              <button
                onClick={() => updateStatus("preparing")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-colors"
              >
                <ChefHat className="w-4 h-4" /> Mark Preparing
              </button>
            )}
            {(order.status === "pending" || order.status === "preparing") && (
              <button
                onClick={() => updateStatus("ready")}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
              >
                <CheckCircle className="w-4 h-4" /> Mark Ready
              </button>
            )}
            <button
              onClick={() => updateStatus("completed")}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-colors"
            >
              <CheckCircle className="w-4 h-4" /> Mark Complete
            </button>
          </div>
        )}

        {order.status === "completed" && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border text-chart-4">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Order Completed</span>
          </div>
        )}

        {order.status === "cancelled" && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border text-destructive">
            <span className="font-semibold">Order Cancelled</span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
