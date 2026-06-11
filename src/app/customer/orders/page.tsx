"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Loader2, Clock, ShoppingBag, ArrowLeft, CheckCircle2, ChefHat, X, MapPin, Phone, Save } from "lucide-react";
import Link from "next/link";
import type { Order, OrderItem, MenuItem } from "@/types/database";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface OrderWithItems extends Order {
  order_items: (OrderItem & { menu_item?: MenuItem })[];
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  preparing: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  ready: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/20 text-destructive border-destructive/30",
};

const statusDots: Record<string, string> = {
  pending: "bg-yellow-400",
  preparing: "bg-blue-400",
  ready: "bg-green-400",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
};

const progressSteps = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "ready", label: "Ready", icon: CheckCircle2 },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function CustomerOrdersPage() {
  const { user, profile, isLoading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [pulsingOrders, setPulsingOrders] = useState<Set<string>>(new Set());
  const [trackingOrder, setTrackingOrder] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [savedPhone, setSavedPhone] = useState<string | null>(null);
  const [savingPhone, setSavingPhone] = useState(false);
  const supabase = createClient();
  const prevStatusesRef = useRef<Record<string, string>>({});

  const handleSavePhone = async () => {
    if (!phoneInput.trim()) {
      toast.error("Please enter your phone number");
      return;
    }
    setSavingPhone(true);
    setSavedPhone(phoneInput.trim());
    setSavingPhone(false);
  };

  const fetchOrders = useCallback(async () => {
    if (!user || profile?.role !== "customer") return;

    const phone = profile.phone || savedPhone;
    if (!phone) {
      setLoading(false);
      return;
    }

    const query = supabase
      .from("orders")
      .select(
        "*, order_items(*, menu_item:menu_items(*)), cafe:cafes(name)"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    query.eq("customer_phone", phone);

    if (profile.full_name) {
      query.ilike("customer_name", `%${profile.full_name}%`);
    }

    const { data } = await query;
    if (data) {
      setOrders(data as unknown as OrderWithItems[]);
    }
    setLoading(false);
  }, [authLoading, user, profile, supabase, savedPhone]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "customer") {
      setLoading(false);
      return;
    }

    fetchOrders();

    // Auto-refresh fallback every 30 seconds
    const interval = setInterval(fetchOrders, 30000);

    return () => clearInterval(interval);
  }, [authLoading, user, profile, fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    if (!user || profile?.role !== "customer") return;

    const phone = profile.phone || savedPhone;
    if (!phone) return;

    const filter = `customer_phone=eq.${phone}`;

    const channel = supabase
      .channel("customer-orders-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter,
        },
        (payload) => {
          const updated = payload.new as any;
          const old = payload.old as any;
          const prevStatus = prevStatusesRef.current[updated.id];

          if (prevStatus && prevStatus !== updated.status && updated.status === "ready") {
            toast(`Order #${updated.id.slice(-8)} is now READY!`, {
              icon: "✅",
              duration: 5000,
              style: {
                background: "rgba(5,5,10,0.95)",
                color: "#fff",
                border: "1px solid var(--primary)",
              },
            });
          }

          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id ? { ...o, ...updated } : o
            )
          );

          if (old?.status && old.status !== updated.status) {
            setPulsingOrders((prev) => new Set(prev).add(updated.id));
            setTimeout(() => {
              setPulsingOrders((prev) => {
                const next = new Set(prev);
                next.delete(updated.id);
                return next;
              });
            }, 2000);
          }

          prevStatusesRef.current[updated.id] = updated.status;
        }
      )
      .subscribe();

    // Initialize prevStatuses
    orders.forEach((o) => {
      prevStatusesRef.current[o.id] = o.status;
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, supabase, savedPhone, orders.length]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || profile?.role !== "customer") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <Gamepad2 className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Sign in to view your orders</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          Create an account to track your orders and earn rewards.
        </p>
        <div className="flex gap-3">
          <Link
            href="/auth/signup"
            className="neon-glow px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
          >
            Sign Up
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-2.5 rounded-lg bg-muted text-muted-foreground font-semibold text-sm border border-border"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!profile.phone && !savedPhone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <Phone className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">Enter your phone number</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">
          We need your phone number to find your orders.
        </p>
        <div className="flex gap-2 w-full max-w-xs">
          <input
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Phone number"
            className="flex-1 px-4 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
            onKeyDown={(e) => e.key === "Enter" && handleSavePhone()}
          />
          <button
            onClick={handleSavePhone}
            disabled={savingPhone}
            className="neon-glow flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px] disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <Link
          href="/menu"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Menu
        </Link>
        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              My Orders
            </h1>
            <p className="text-xs text-muted-foreground">
              {profile.full_name} &middot; {profile.phone}
            </p>
          </div>
        </div>

        {orders.length === 0 ? (
          <GlassCard className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start browsing cafes to place your first order.
            </p>
            <Link
              href="/menu"
              className="inline-block neon-glow px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
            >
              Browse Cafes
            </Link>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const stepIdx = ["pending", "preparing", "ready", "completed"].indexOf(order.status);
              const isPulsing = pulsingOrders.has(order.id);

              return (
                <GlassCard key={order.id} className={`p-4 space-y-3 ${isPulsing ? "ring-2 ring-primary/40" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                          statusDots[order.status] || "bg-muted-foreground"
                        } ${isPulsing ? "animate-pulse" : ""}`}
                      />
                      <div>
                        <p className="font-semibold text-sm">
                          {order.cafe?.name ?? "Cafe"}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {format(
                            new Date(order.created_at),
                            "MMM d, yyyy · h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColors[order.status] ?? "bg-muted text-muted-foreground border-border"}`}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    {order.order_items?.map((oi) => (
                      <div
                        key={oi.id}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {oi.quantity}x {oi.menu_item?.name ?? "Item"}
                        </span>
                        <span className="font-medium">
                          ₹
                          {Number(
                            oi.unit_price * oi.quantity
                          ).toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-border">
                    <span>Total</span>
                    <span className="text-primary">
                      ₹{Number(order.total).toFixed(0)}
                    </span>
                  </div>

                  {/* Track button */}
                  {order.status !== "cancelled" && (
                    <div className="pt-2">
                      {trackingOrder === order.id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted-foreground">Progress</span>
                            <button
                              onClick={() => setTrackingOrder(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Hide
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            {progressSteps.map((step, idx) => {
                              const StepIcon = step.icon;
                              const isDone = idx <= stepIdx;
                              const isCurrent = idx === stepIdx;
                              return (
                                <div key={step.key} className="flex flex-col items-center gap-1">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                      isDone
                                        ? "bg-primary/20 text-primary border border-primary/30"
                                        : "bg-muted text-muted-foreground border border-border"
                                    } ${isCurrent ? "ring-2 ring-primary/30 animate-pulse" : ""}`}
                                  >
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                                  </div>
                                  <span className={`text-[10px] ${isDone ? "text-foreground" : "text-muted-foreground"}`}>
                                    {step.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setTrackingOrder(order.id)}
                          className="w-full py-2 rounded-lg bg-muted/60 border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MapPin className="w-3.5 h-3.5 inline mr-1" />
                          Track Order
                        </button>
                      )}
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}