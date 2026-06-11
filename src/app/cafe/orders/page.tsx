"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/types/database";
import {
  Loader2,
  Clock,
  CheckCircle,
  ChefHat,
  Printer,
  Search,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  Filter,
  UtensilsCrossed,
  ShoppingBag,
  QrCode,
  Sparkles,
  PackageOpen,
  ArrowDown,
  Calendar,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, isYesterday, startOfWeek, startOfDay, endOfDay } from "date-fns";
import toast from "react-hot-toast";

const ORDER_STATUSES = ["all", "pending", "preparing", "ready", "completed", "cancelled"] as const;
const ORDER_TYPES = ["all", "dine_in", "takeaway", "qr"] as const;
const DATE_FILTERS = ["today", "yesterday", "this_week", "custom"] as const;
const PAGE_SIZE = 20;

const statusColors: Record<string, "default" | "secondary" | "accent" | "success" | "destructive"> = {
  pending: "default",
  preparing: "secondary",
  ready: "accent",
  completed: "success",
  cancelled: "destructive",
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  preparing: <ChefHat className="w-3.5 h-3.5" />,
  ready: <CheckCircle className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  cancelled: <X className="w-3.5 h-3.5" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  dine_in: <UtensilsCrossed className="w-3 h-3" />,
  takeaway: <ShoppingBag className="w-3 h-3" />,
  qr: <QrCode className="w-3 h-3" />,
};

export default function OrdersPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [animatingOrderId, setAnimatingOrderId] = useState<string | null>(null);
  const pageLoadTimeRef = useRef<string>(new Date().toISOString());
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

  const fetchOrders = useCallback(async () => {
    if (!cafeId) return;
    let query = supabase
      .from("orders")
      .select("*, order_items(*, menu_item:menu_items(name)), table:tables(table_number)")
      .eq("cafe_id", cafeId)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data } = await query;
    if (data) setOrders(data);
    setLoading(false);
    setVisibleCount(PAGE_SIZE);
    setSelectedOrderIds(new Set());
    setExpandedOrders(new Set());
  }, [cafeId, statusFilter, supabase]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase
      .channel("orders-list-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
        () => fetchOrders()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId, fetchOrders, supabase]);

  const updateStatus = async (orderId: string, newStatus: string) => {
    setAnimatingOrderId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);
    if (error) {
      toast.error(error.message);
      setAnimatingOrderId(null);
    } else {
      toast.success(`Order ${newStatus}`);
      setTimeout(() => setAnimatingOrderId(null), 400);
      fetchOrders();
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedOrderIds.size === 0) return;
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .in("id", Array.from(selectedOrderIds));
    if (error) toast.error(error.message);
    else {
      toast.success(`${selectedOrderIds.size} orders -> ${newStatus}`);
      setSelectedOrderIds(new Set());
      fetchOrders();
    }
  };

  const handlePrintOrder = (order: any) => {
    const w = window.open("", "_blank", "width=380,height=600");
    if (!w) return;
    const tableLabel = order.table?.table_number
      ? `Table: ${order.table.table_number}`
      : order.order_type === "takeaway"
        ? "Takeaway"
        : "QR Order";
    const itemList = order.order_items
      ?.map(
        (oi: any) =>
          `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:13px"><span>${oi.quantity}x ${oi.menu_item?.name || "Item"}</span><span>₹${Number(oi.subtotal).toFixed(0)}</span></div>`
      )
      .join("");
    w.document.write(`<html><head><title>Order #${order.id.slice(-8)}</title>
<style>body{font-family:'Courier New',monospace;padding:16px;font-size:13px;line-height:1.4;max-width:380px;margin:0 auto;background:#fff;color:#111}
h2{margin:0 0 4px;font-size:18px;text-align:center}.sub{text-align:center;font-size:11px;color:#666;margin:0 0 8px}
hr{border:0;border-top:1px dashed #ccc;margin:10px 0}
.total-row{display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:4px}
.footer{text-align:center;font-size:10px;color:#999;margin-top:12px}</style></head><body>
<h2>RR Downtown Arcade</h2><p class="sub">Order #${order.id.slice(-8)}</p>
<p style="font-size:12px;text-align:center;margin:0 0 8px">${tableLabel} | ${format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}</p>
${order.customer_name ? `<p style="font-size:12px;text-align:center;margin:0">${order.customer_name}</p>` : ""}
<hr>${itemList}<hr>
<div class="total-row"><span>TOTAL</span><span>₹${Number(order.total).toFixed(2)}</span></div>
<p class="footer">Thank you! Visit again 🎮</p>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleBulkPrint = () => {
    const selectedOrders = orders.filter((o) => selectedOrderIds.has(o.id));
    selectedOrders.forEach((o) => handlePrintOrder(o));
  };

  const exportCSV = () => {
    const filtered = filteredOrders;
    if (filtered.length === 0) {
      toast.error("No orders to export");
      return;
    }
    const headers = ["Order ID", "Date", "Status", "Type", "Table", "Customer", "Items", "Subtotal", "Tax", "Royalty", "Total"];
    const rows = filtered.map((o: any) => [
      o.id.slice(-8),
      format(new Date(o.created_at), "yyyy-MM-dd HH:mm"),
      o.status,
      o.order_type,
      o.table?.table_number || "-",
      o.customer_name || "-",
      o.order_items?.map((oi: any) => `${oi.quantity}x ${oi.menu_item?.name || "?"}`).join("; ") || "-",
      o.subtotal,
      o.tax,
      o.royalty_amount,
      o.total,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const toggleSelect = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    const now = new Date();
    if (dateFilter === "today") {
      result = result.filter((o) => isToday(new Date(o.created_at)));
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      result = result.filter((o) => isYesterday(new Date(o.created_at)));
    } else if (dateFilter === "this_week") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      result = result.filter((o) => new Date(o.created_at) >= weekStart);
    } else if (dateFilter === "custom" && customDateStart && customDateEnd) {
      const start = startOfDay(new Date(customDateStart));
      const end = endOfDay(new Date(customDateEnd));
      result = result.filter((o) => {
        const d = new Date(o.created_at);
        return d >= start && d <= end;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter((o) => o.order_type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.table?.table_number && o.table.table_number.toString().includes(q))
      );
    }

    return result;
  }, [orders, dateFilter, typeFilter, searchQuery, customDateStart, customDateEnd]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    ORDER_STATUSES.slice(1).forEach((s) => {
      counts[s] = orders.filter((o) => o.status === s).length;
    });
    return counts;
  }, [orders]);

  const newOrdersCount = useMemo(() => {
    return orders.filter((o) => o.created_at > pageLoadTimeRef.current).length;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    return filteredOrders.slice(0, visibleCount);
  }, [filteredOrders, visibleCount]);

  const hasMore = visibleCount < filteredOrders.length;

  const todayOrdersCount = useMemo(() => {
    return orders.filter((o) => isToday(new Date(o.created_at))).length;
  }, [orders]);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-24 bg-muted rounded-full animate-pulse shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <GlassCard key={i} className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-5 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-28 bg-muted rounded animate-pulse" />
                </div>
                <div className="space-y-1 text-right">
                  <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5 pt-3 border-t border-border">
                <div className="h-3 w-full bg-muted rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Total: <span className="font-semibold text-foreground">{todayOrdersCount} orders</span> today
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <select
              value={selectedCafeId || ""}
              onChange={(e) => {
                setSelectedCafeId(e.target.value);
                setLoading(true);
              }}
              className="px-3 py-2 rounded-lg text-sm bg-muted border border-border outline-none focus:border-primary/50 transition-colors"
            >
              {cafes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* New orders live counter */}
      {newOrdersCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm animate-in fade-in slide-in-from-top-2">
          <Zap className="w-4 h-4" />
          <span className="font-semibold">{newOrdersCount} new order{newOrdersCount !== 1 ? "s" : ""}</span>
          <span className="text-primary/70">since you opened this page</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="space-y-3">
        {/* Status Filter Pills */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1">
          {ORDER_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3.5 py-2 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all flex items-center gap-1.5 min-h-[38px] ${
                statusFilter === s
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10"
                  : "bg-muted text-muted-foreground border border-border hover:border-white/20"
              }`}
            >
              {s === "all" ? <Filter className="w-3 h-3" /> : statusIcons[s]}
              {s}
              {s !== "all" && statusCounts[s] > 0 && (
                <span
                  className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    statusFilter === s
                      ? "bg-primary/30 text-primary"
                      : "bg-white/10 text-muted-foreground"
                  }`}
                >
                  {statusCounts[s]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Secondary Filters Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border">
            {DATE_FILTERS.map((d) => (
              <button
                key={d}
                onClick={() => {
                  setDateFilter(d);
                  if (d !== "custom") {
                    setCustomDateStart("");
                    setCustomDateEnd("");
                  }
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                  dateFilter === d
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d === "this_week" ? "This Week" : d}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {dateFilter === "custom" && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={customDateStart}
                onChange={(e) => setCustomDateStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-muted border border-border outline-none focus:border-primary/50 transition-colors"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="date"
                value={customDateEnd}
                onChange={(e) => setCustomDateEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-muted border border-border outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          )}

          {/* Order Type Filter */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1 border border-border ml-auto sm:ml-0">
            {ORDER_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium capitalize transition-colors flex items-center gap-1 ${
                  typeFilter === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t !== "all" && typeIcons[t]}
                {t === "dine_in" ? "Dine-in" : t === "qr" ? "QR" : t === "all" ? "All Types" : "Takeaway"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-muted border border-border outline-none focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/20 text-sm">
          <span className="font-semibold text-accent">{selectedOrderIds.size} selected</span>
          <button
            onClick={handleBulkPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 transition-colors text-xs font-medium"
          >
            <Printer className="w-3.5 h-3.5" />
            Print All
          </button>
          <button
            onClick={() => bulkUpdateStatus("completed")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-colors text-xs font-medium"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Mark Completed
          </button>
          <button
            onClick={() => setSelectedOrderIds(new Set())}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Order Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {visibleOrders.map((order: any) => (
          <GlassCard
            key={order.id}
            className={`p-3 sm:p-4 transition-all duration-300 group ${
              selectedOrderIds.has(order.id)
                ? "ring-2 ring-primary/50 border-primary/30"
                : "hover:border-white/20"
            } ${
              animatingOrderId === order.id
                ? "animate-slide-in-left scale-[1.02]"
                : ""
            }`}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-2 min-w-0">
                {/* Select Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(order.id);
                  }}
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    selectedOrderIds.has(order.id)
                      ? "bg-primary border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {selectedOrderIds.has(order.id) && (
                    <CheckCircle className="w-3 h-3 text-primary-foreground" />
                  )}
                </button>

                <div className="min-w-0">
                  <a
                    href={`/cafe/orders/${order.id}`}
                    className="text-sm font-bold text-primary hover:underline truncate block"
                  >
                    #{order.id.slice(-8)}
                  </a>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant={statusColors[order.status] || "default"} className="gap-1">
                      {statusIcons[order.status]}
                      {order.status}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      {typeIcons[order.order_type]}
                      {order.order_type === "qr" ? "QR" : order.order_type === "takeaway" ? "Takeaway" : "Dine-in"}
                    </Badge>
                  </div>
                  {(order.table?.table_number || order.customer_name) && (
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
                      {order.table?.table_number && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          Table {order.table.table_number}
                        </span>
                      )}
                      {order.customer_name && (
                        <span className="text-xs text-muted-foreground truncate">
                          {order.customer_name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right shrink-0 ml-3">
                <p className="font-bold text-primary text-lg">
                  ₹{Number(order.total).toFixed(0)}
                </p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            {/* Expandable Items */}
            <div className="border-t border-border pt-2.5">
              <button
                onClick={() => toggleExpand(order.id)}
                className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <span>
                  {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? "s" : ""}
                </span>
                {expandedOrders.has(order.id) ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Always show first 2 items, expand for rest */}
              {order.order_items?.length > 0 && (
                <div className="space-y-1 mt-1">
                  {(expandedOrders.has(order.id)
                    ? order.order_items
                    : order.order_items.slice(0, 2)
                  ).map((oi: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">
                        {oi.quantity}x {oi.menu_item?.name || "Item"}
                      </span>
                      <span className="shrink-0">₹{Number(oi.subtotal).toFixed(0)}</span>
                    </div>
                  ))}
                  {!expandedOrders.has(order.id) && order.order_items.length > 2 && (
                    <p className="text-[11px] text-muted-foreground italic">
                      +{order.order_items.length - 2} more...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
              {order.status !== "completed" && order.status !== "cancelled" && (
                <>
                  {order.status === "pending" && (
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-secondary/15 text-secondary hover:bg-secondary/25 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[36px]"
                    >
                      <ChefHat className="w-3.5 h-3.5" /> Preparing
                    </button>
                  )}
                  {(order.status === "pending" || order.status === "preparing") && (
                    <button
                      onClick={() => updateStatus(order.id, "ready")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-accent/15 text-accent hover:bg-accent/25 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[36px]"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Ready
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus(order.id, "completed")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-all hover:scale-[1.02] active:scale-[0.98] min-h-[36px]"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Complete
                  </button>
                </>
              )}
              <button
                onClick={() => handlePrintOrder(order)}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all min-h-[36px] ml-auto shrink-0"
                title="Print receipt"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Empty States */}
      {visibleOrders.length === 0 && !loading && (
        <GlassCard className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            {statusFilter === "completed" ? (
              <CheckCircle className="w-10 h-10 text-chart-4" />
            ) : statusFilter === "cancelled" ? (
              <X className="w-10 h-10 text-destructive" />
            ) : statusFilter === "pending" ? (
              <Clock className="w-10 h-10 text-primary" />
            ) : statusFilter === "preparing" ? (
              <ChefHat className="w-10 h-10 text-secondary" />
            ) : statusFilter === "ready" ? (
              <Sparkles className="w-10 h-10 text-accent" />
            ) : (
              <PackageOpen className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {statusFilter === "all"
              ? "No orders yet"
              : `No ${statusFilter} orders`}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {statusFilter === "all"
              ? "Orders will appear here when customers place them."
              : statusFilter === "pending"
              ? "All pending orders have been processed. Great job!"
              : statusFilter === "preparing"
              ? "No orders are currently being prepared."
              : statusFilter === "ready"
              ? "No orders are ready for pickup. Keep cooking!"
              : statusFilter === "completed"
              ? "No completed orders match your current filters."
              : "No cancelled orders to display."}
          </p>
        </GlassCard>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-all hover:border-white/20 group"
          >
            <ArrowDown className="w-4 h-4 group-hover:animate-bounce" />
            Load More ({filteredOrders.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
