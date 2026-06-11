"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2, Loader2, Clock, ShoppingBag, ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { Order, OrderItem, MenuItem } from "@/types/database";
import { format } from "date-fns";

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

export default function CustomerOrdersPage() {
  const { user, profile, isLoading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "customer") {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      const query = supabase
        .from("orders")
        .select(
          "*, order_items(*, menu_item:menu_items(*)), cafe:cafes(name)"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (profile.phone) {
        query.eq("customer_phone", profile.phone);
      } else {
        query.eq("staff_id", user.id);
      }

      const { data } = await query;

      if (data) {
        setOrders(data as unknown as OrderWithItems[]);
      }
      setLoading(false);
    };

    fetchOrders();
  }, [authLoading, user, profile]);

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
            {orders.map((order) => (
              <GlassCard key={order.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
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
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
