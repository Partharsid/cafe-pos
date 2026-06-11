"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Phone,
  ShoppingBag,
  IndianRupee,
  Calendar,
  X,
  Loader2,
} from "lucide-react";

interface CustomerSummary {
  name: string;
  phone: string;
  totalOrders: number;
  totalSpend: number;
  lastOrderDate: string;
}

interface CustomerOrder {
  id: string;
  total: number;
  created_at: string;
  status: string;
  order_type: string;
  order_items?: {
    quantity: number;
    subtotal: number;
    menu_item?: { name: string };
  }[];
}

export default function CustomersPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Record<string, CustomerOrder[]>>({});
  const [loadingOrders, setLoadingOrders] = useState<string | null>(null);

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
    const fetchCustomers = async () => {
      setLoading(true);
      const { data: orders } = await supabase
        .from("orders")
        .select("customer_name, customer_phone, total, created_at")
        .eq("cafe_id", cafeId)
        .not("customer_phone", "is", null)
        .neq("customer_phone", "")
        .order("created_at", { ascending: false });

      if (!orders) {
        setLoading(false);
        return;
      }

      const grouped: Record<string, CustomerSummary> = {};
      for (const o of orders) {
        const phone = o.customer_phone;
        if (!phone) continue;
        if (!grouped[phone]) {
          grouped[phone] = {
            name: o.customer_name || "Unknown",
            phone,
            totalOrders: 0,
            totalSpend: 0,
            lastOrderDate: o.created_at,
          };
        }
        grouped[phone].totalOrders++;
        grouped[phone].totalSpend += Number(o.total);
        if (o.created_at > grouped[phone].lastOrderDate) {
          grouped[phone].lastOrderDate = o.created_at;
        }
      }

      setCustomers(
        Object.values(grouped).sort((a, b) => b.totalSpend - a.totalSpend)
      );
      setLoading(false);
    };
    fetchCustomers();
  }, [cafeId]);

  const fetchCustomerOrders = async (phone: string) => {
    if (customerOrders[phone]) {
      setExpandedPhone(expandedPhone === phone ? null : phone);
      return;
    }
    setLoadingOrders(phone);
    const { data: orders } = await supabase
      .from("orders")
      .select("*, order_items(*, menu_item:menu_items(name))")
      .eq("cafe_id", cafeId)
      .eq("customer_phone", phone)
      .order("created_at", { ascending: false })
      .limit(10);

    if (orders) {
      setCustomerOrders((prev) => ({ ...prev, [phone]: orders as CustomerOrder[] }));
      setExpandedPhone(phone);
    }
    setLoadingOrders(null);
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Customers
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {customers.length} customer{customers.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <select
            value={selectedCafeId || ""}
            onChange={(e) => setSelectedCafeId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:border-primary transition-colors"
          >
            {cafes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-8 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Customer List */}
      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customer data yet"
          description="Customer data will appear once orders are placed with customer phone numbers"
        />
      ) : (
        <div className="space-y-2">
          {filteredCustomers.map((customer) => (
            <div key={customer.phone}>
              <GlassCard
                className="p-4 cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => fetchCustomerOrders(customer.phone)}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="p-2 rounded-full bg-primary/10 shrink-0">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{customer.name}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 sm:gap-6 text-right shrink-0">
                    <div>
                      <p className="text-xs text-muted-foreground">Orders</p>
                      <p className="font-bold text-sm">{customer.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spend</p>
                      <p className="font-bold text-sm text-primary">
                        ₹{customer.totalSpend.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Order</p>
                      <p className="text-xs font-medium">
                        {new Date(customer.lastOrderDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {loadingOrders === customer.phone ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : expandedPhone === customer.phone ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </GlassCard>

              {/* Expanded order history */}
              {expandedPhone === customer.phone && customerOrders[customer.phone] && (
                <div className="ml-4 sm:ml-12 mt-1 space-y-1 animate-slide-in-down">
                  {customerOrders[customer.phone].map((order) => (
                    <div
                      key={order.id}
                      className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            #{order.id.slice(-6)}
                          </Badge>
                          <Badge
                            variant={
                              order.status === "completed"
                                ? "success"
                                : order.status === "cancelled"
                                  ? "destructive"
                                  : "default"
                            }
                            className="text-[10px]"
                          >
                            {order.status}
                          </Badge>
                        </div>
                        {order.order_items && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {order.order_items
                              .map((oi) => `${oi.quantity}x ${oi.menu_item?.name || "Item"}`)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">₹{Number(order.total).toFixed(0)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}