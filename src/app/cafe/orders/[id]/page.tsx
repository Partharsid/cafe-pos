"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Clock,
  CheckCircle,
  ChefHat,
  Printer,
  ArrowLeft,
  MapPin,
  User,
  Phone,
  Calendar,
  Hash,
  ShoppingBag,
  UtensilsCrossed,
  QrCode,
  ChevronDown,
  Receipt,
  MessageSquare,
  RotateCcw,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useRouter, useParams } from "next/navigation";
import toast from "react-hot-toast";

const statusColors: Record<string, "default" | "secondary" | "accent" | "success" | "destructive"> = {
  pending: "default",
  preparing: "secondary",
  ready: "accent",
  completed: "success",
  cancelled: "destructive",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  preparing: <ChefHat className="w-4 h-4" />,
  ready: <CheckCircle className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  cancelled: <CheckCircle className="w-4 h-4" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  dine_in: <UtensilsCrossed className="w-3.5 h-3.5" />,
  takeaway: <ShoppingBag className="w-3.5 h-3.5" />,
  qr: <QrCode className="w-3.5 h-3.5" />,
};

const pipelineSteps = [
  { key: "pending", label: "Pending", icon: <Clock className="w-4 h-4" /> },
  { key: "preparing", label: "Preparing", icon: <ChefHat className="w-4 h-4" /> },
  { key: "ready", label: "Ready", icon: <CheckCircle className="w-4 h-4" /> },
  { key: "completed", label: "Completed", icon: <CheckCircle className="w-4 h-4" /> },
];

const stepIndexMap: Record<string, number> = {
  pending: 0,
  preparing: 1,
  ready: 2,
  completed: 3,
};

const validNextStatuses: Record<string, string[]> = {
  pending: ["preparing", "ready", "completed", "cancelled"],
  preparing: ["ready", "completed", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export default function OrderDetailPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id as string;

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
    if (!order || !orderId) return;
    const channel = supabase
      .channel("order-detail-" + orderId)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${orderId}` },
        (payload) => {
          setOrder((prev: any) => ({ ...prev, ...(payload.new as any) }));
          const newStatus = (payload.new as any).status;
          if (newStatus) {
            toast.success(`Order status updated to: ${newStatus}`, {
              icon: "✅",
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, order]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateStatus = async (newStatus: string) => {
    setUpdatingStatus(true);
    setStatusDropdownOpen(false);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
    } else {
      setOrder((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Order ${newStatus}`);
    }
    setUpdatingStatus(false);
  };

  const handlePrintThermal = () => {
    if (!order) return;
    const tableLabel = order.table?.table_number
      ? `Table: ${order.table.table_number}`
      : order.order_type === "takeaway"
        ? "Takeaway"
        : "QR Order";

    const itemLines = order.order_items
      ?.map(
        (oi: any) =>
          `${oi.quantity.toString().padStart(2)}  ${(oi.menu_item?.name || "Item").padEnd(20).substring(0, 20)} ${Number(oi.subtotal).toFixed(0).padStart(6)}`
      )
      .join("\n");

    const thermalHTML = `<!DOCTYPE html><html><head><title>Receipt #${order.id.slice(-8)}</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    line-height: 1.35;
    width: 72mm;
    margin: 0 auto;
    padding: 6mm 4mm;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .title { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
  .subtitle { font-size: 10px; margin-bottom: 2px; color: #444; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  .divider-dot { border-top: 1px dotted #ccc; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; }
  .bold { font-weight: bold; }
  .large { font-size: 16px; }
  .small { font-size: 10px; color: #555; }
  .right { text-align: right; }
  .item-name { max-width: 45mm; word-wrap: break-word; }
  .totals { margin-top: 2px; }
  .footer { margin-top: 8px; font-size: 10px; color: #888; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div class="center">
  <div class="title">RR DOWNTOWN ARCADE</div>
  <div class="subtitle">Premium Gaming & Cafe</div>
  <div class="small">Order #${order.id.slice(-8).toUpperCase()}</div>
  <div class="small">${format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}</div>
</div>
<div class="divider"></div>
<div class="row small">
  <span>${tableLabel}</span>
  <span>Type: ${order.order_type === "qr" ? "QR" : order.order_type === "takeaway" ? "Takeaway" : "Dine-in"}</span>
</div>
${order.customer_name ? `<div class="row small"><span>Customer:</span><span>${order.customer_name}${order.customer_phone ? " · " + order.customer_phone : ""}</span></div>` : ""}
<div class="divider-dot"></div>
<pre style="font-family:inherit;margin:0;">ITEM                  QTY    AMT
------------------------------------------</pre>
${order.order_items?.map((oi: any) =>
  `<div class="row" style="font-size:11px;">
    <span class="item-name">${oi.menu_item?.name || "Item"}</span>
    <span>${oi.quantity}x  ₹${Number(oi.subtotal).toFixed(0)}</span>
  </div>`
).join("\n") || ""}
<div class="divider-dot"></div>
<div class="totals">
  <div class="row small"><span>Subtotal</span><span>₹${Number(order.subtotal).toFixed(2)}</span></div>
  <div class="row small"><span>Tax (5%)</span><span>₹${Number(order.tax).toFixed(2)}</span></div>
  <div class="row small"><span>Platform Fee</span><span>₹${Number(order.royalty_amount).toFixed(2)}</span></div>
</div>
<div class="divider"></div>
<div class="row">
  <span class="bold large">TOTAL</span>
  <span class="bold large">₹${Number(order.total).toFixed(2)}</span>
</div>
<div class="divider"></div>
<div class="center footer">
  Thank you for your visit!<br>
  RR Downtown Arcade<br>
  🎮 Play More, Pay Less
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(thermalHTML);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const handlePrintBrowser = () => {
    if (!order) return;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    const tableLabel = order.table?.table_number
      ? `Table: ${order.table.table_number}`
      : order.order_type === "takeaway"
        ? "Takeaway"
        : "QR Order";
    const itemList = order.order_items
      ?.map(
        (oi: any) =>
          `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${oi.quantity}x</td><td style="padding:6px 8px;border-bottom:1px solid #eee">${oi.menu_item?.name || "Item"}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">₹${Number(oi.subtotal).toFixed(2)}</td></tr>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Order #${order.id.slice(-8)} - RR Downtown Arcade</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',system-ui,sans-serif;padding:40px;color:#1a1a2e;background:#fff;max-width:600px;margin:0 auto}
  .header{text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #1a1a2e}
  .header h1{font-size:22px;margin-bottom:2px;letter-spacing:1px}
  .header .sub{font-size:12px;color:#666}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;font-size:13px}
  .info-item{}
  .info-item .label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px}
  .info-item .value{font-weight:600;font-size:14px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  thead th{font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;padding:8px;border-bottom:1px solid #ddd;text-align:left}
  thead th:last-child{text-align:right}
  tfoot td{padding:8px}
  .totals-row td{font-size:14px;padding:4px 8px}
  .totals-row.total td{font-size:18px;font-weight:bold;border-top:2px solid #1a1a2e;padding-top:8px}
  .footer{text-align:center;margin-top:30px;padding-top:20px;border-top:2px solid #1a1a2e;font-size:12px;color:#666}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <h1>RR DOWNTOWN ARCADE</h1>
  <div class="sub">Premium Gaming & Cafe · Invoice</div>
</div>
<div class="info">
  <div class="info-item"><div class="label">Order ID</div><div class="value">#${order.id.slice(-8).toUpperCase()}</div></div>
  <div class="info-item"><div class="label">Date</div><div class="value">${format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}</div></div>
  <div class="info-item"><div class="label">Table / Type</div><div class="value">${tableLabel} · ${order.order_type === "qr" ? "QR" : order.order_type === "takeaway" ? "Takeaway" : "Dine-in"}</div></div>
  <div class="info-item"><div class="label">Status</div><div class="value" style="text-transform:capitalize">${order.status}</div></div>
  ${order.customer_name ? `<div class="info-item"><div class="label">Customer</div><div class="value">${order.customer_name}${order.customer_phone ? " · " + order.customer_phone : ""}</div></div>` : ""}
</div>
<table>
  <thead><tr><th>Qty</th><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>${itemList}</tbody>
  <tfoot>
    <tr class="totals-row"><td colspan="2" style="text-align:right">Subtotal</td><td style="text-align:right">₹${Number(order.subtotal).toFixed(2)}</td></tr>
    <tr class="totals-row"><td colspan="2" style="text-align:right">Tax (5%)</td><td style="text-align:right">₹${Number(order.tax).toFixed(2)}</td></tr>
    <tr class="totals-row"><td colspan="2" style="text-align:right">Platform Fee</td><td style="text-align:right">₹${Number(order.royalty_amount).toFixed(2)}</td></tr>
    <tr class="totals-row total"><td colspan="2" style="text-align:right">TOTAL</td><td style="text-align:right">₹${Number(order.total).toFixed(2)}</td></tr>
  </tfoot>
</table>
<div class="footer">
  Thank you for your visit!<br>
  RR Downtown Arcade · Play More, Pay Less 🎮
</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        <GlassCard>
          <div className="space-y-4">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-5 w-28 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!order) return null;

  const currentStepIdx = stepIndexMap[order.status] ?? 0;
  const isCancelled = order.status === "cancelled";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back + Cafe Selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button
          onClick={() => router.push("/cafe/orders")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Orders
        </button>
        {isSuperAdmin && (
          <select
            value={selectedCafeId || ""}
            onChange={(e) => setSelectedCafeId(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm bg-muted border border-border outline-none"
          >
            {cafes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Invoice Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Column - Items Table */}
        <div className="lg:col-span-2">
          <GlassCard className="overflow-hidden">
            {/* Brand Header */}
            <div className="text-center pb-4 mb-4 border-b border-border">
              <h1 className="text-xl font-bold tracking-wider neon-text">RR DOWNTOWN ARCADE</h1>
              <p className="text-xs text-muted-foreground mt-1">Premium Gaming & Cafe · Order Invoice</p>
            </div>

            {/* Items Table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 font-medium w-16">Qty</th>
                  <th className="text-left py-2 font-medium">Item</th>
                  <th className="text-right py-2 font-medium">Price</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.order_items?.map((oi: any, i: number) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-3 font-mono text-muted-foreground">x{oi.quantity}</td>
                    <td className="py-3">
                      <p className="font-medium">{oi.menu_item?.name || "Unknown Item"}</p>
                      {oi.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{oi.notes}</p>
                      )}
                    </td>
                    <td className="py-3 text-right text-muted-foreground font-mono">
                      ₹{Number(oi.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-semibold font-mono">
                      ₹{Number(oi.subtotal).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(!order.order_items || order.order_items.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">No items in this order</p>
            )}
          </GlassCard>
        </div>

        {/* Right Column - Order Info + Totals */}
        <div className="space-y-4">
          {/* Order Info Card */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                {order.id.slice(-8).toUpperCase()}
              </h2>
              <Badge variant={statusColors[order.status] || "default"} className="gap-1.5 px-3 py-1">
                {statusIcons[order.status]}
                <span className="capitalize">{order.status}</span>
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Date & Time</p>
                  <p className="font-medium">{format(new Date(order.created_at), "dd MMM yyyy, hh:mm a")}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline" className="gap-1.5 shrink-0">
                  {typeIcons[order.order_type]}
                  {order.order_type === "qr" ? "QR" : order.order_type === "takeaway" ? "Takeaway" : "Dine-in"}
                </Badge>
                {order.table?.table_number && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="font-medium text-foreground">Table {order.table.table_number}</span>
                  </div>
                )}
              </div>

              {order.customer_name && (
                <div className="flex items-center gap-3 text-sm">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="font-medium">{order.customer_name}</p>
                    {order.customer_phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {order.customer_phone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {order.notes && (
                <div className="text-xs text-muted-foreground italic mt-2 pt-2 border-t border-border/50 flex items-start gap-1.5">
                  <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{order.notes}</span>
                </div>
              )}
              {order.cancellation_reason && (
                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  <span className="text-destructive font-medium">Cancelled:</span> {order.cancellation_reason}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Totals Card */}
          <GlassCard>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              <Receipt className="w-3.5 h-3.5 inline mr-1.5" />
              Bill Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">₹{Number(order.subtotal).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (5%)</span>
                <span className="font-mono">₹{Number(order.tax).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="font-mono">₹{Number(order.royalty_amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-3 mt-2 border-t-2 border-primary/30">
                <span>TOTAL</span>
                <span className="text-primary font-mono text-xl">₹{Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </GlassCard>

          {/* Print Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrintThermal}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-all"
            >
              <Printer className="w-4 h-4" />
              Thermal
            </button>
            <button
              onClick={handlePrintBrowser}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-background border border-border text-sm font-medium hover:bg-muted transition-all"
            >
              <Printer className="w-4 h-4" />
              Browser
            </button>
          </div>

          {/* Status Update */}
          {!isCancelled && order.status !== "completed" && (
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                disabled={updatingStatus}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/15 transition-all font-medium text-sm disabled:opacity-50"
              >
                {updatingStatus ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <span>Update Status</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`} />
                  </>
                )}
              </button>

              {statusDropdownOpen && !updatingStatus && (
                <div className="absolute bottom-full mb-1 left-0 right-0 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2">
                  {validNextStatuses[order.status]?.map((ns) => (
                    <button
                      key={ns}
                      onClick={() => updateStatus(ns)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium capitalize hover:bg-muted transition-colors"
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          ns === "completed"
                            ? "bg-chart-4/15 text-chart-4"
                            : ns === "cancelled"
                            ? "bg-destructive/15 text-destructive"
                            : ns === "preparing"
                            ? "bg-secondary/15 text-secondary"
                            : ns === "ready"
                            ? "bg-accent/15 text-accent"
                            : "bg-primary/15 text-primary"
                        }`}
                      >
                        {statusIcons[ns]}
                      </span>
                      Mark as {ns}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {order.status === "completed" && (
            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-chart-4/10 border border-chart-4/20">
              <CheckCircle className="w-5 h-5 text-chart-4" />
              <span className="font-semibold text-chart-4 text-sm">Order Completed</span>
            </div>
          )}

          {isCancelled && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <X className="w-5 h-5 text-destructive" />
                <span className="font-semibold text-destructive text-sm">Order Cancelled</span>
              </div>
              {order.cancellation_reason && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted border border-border text-xs text-muted-foreground">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Reason: {order.cancellation_reason}
                </div>
              )}
              {order.payment_status === "refunded" && (
                <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-chart-4/10 border border-chart-4/20">
                  <RotateCcw className="w-4 h-4 text-chart-4" />
                  <span className="font-semibold text-chart-4 text-xs">Payment Refunded</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Order Timeline */}
      {!isCancelled && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-muted-foreground mb-5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 inline mr-1.5" />
            Order Timeline
          </h3>

          <div className="relative">
            {/* Connecting Line */}
            <div className="absolute top-5 left-5 right-5 h-0.5 bg-border hidden sm:block">
              <div
                className="h-full bg-primary transition-all duration-700 ease-out"
                style={{
                  width: `${
                    currentStepIdx >= 3
                      ? 100
                      : currentStepIdx >= 0
                      ? ((currentStepIdx + 0.5) / (pipelineSteps.length - 1)) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
              {pipelineSteps.map((step, idx) => {
                const isCompleted = idx <= currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                const isUpcoming = idx > currentStepIdx;

                return (
                  <div key={step.key} className="flex sm:flex-col items-center gap-2 sm:gap-1.5 text-center relative">
                    {/* Step Circle */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-500 ${
                        isCompleted
                          ? "bg-primary/20 border-2 border-primary text-primary"
                          : "bg-muted border-2 border-border text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/20 scale-110" : ""}`}
                    >
                      {isCompleted ? <CheckCircle className="w-4 h-4" /> : step.icon}
                    </div>

                    <div className="sm:text-center text-left">
                      <p
                        className={`text-xs font-semibold capitalize ${
                          isCompleted ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-[10px] text-primary mt-0.5 animate-pulse">In progress</p>
                      )}
                      {isCompleted && !isCurrent && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Done</p>
                      )}
                      {isUpcoming && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Waiting</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timestamps */}
          <div className="mt-5 pt-4 border-t border-border/50 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Order placed:</span>{" "}
              {format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}
            </div>
            <div>
              <span className="font-medium text-foreground">Last updated:</span>{" "}
              {format(new Date(order.updated_at), "dd/MM/yyyy hh:mm a")}
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
