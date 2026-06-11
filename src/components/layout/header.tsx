"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import { playNotificationSound } from "@/lib/notification";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Gamepad2,
  LogOut,
  Menu,
  Shield,
  Store,
  User,
  PanelLeft,
  Bell,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";


interface PendingOrder {
  id: string;
  total: number;
  order_type: string;
  created_at: string;
}

export function Header() {
  const { user, profile, signOut } = useAuthStore();
  const { toggleMobileSidebar } = useUIStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const cafeId = profile?.cafe_id;

  useEffect(() => {
    if (!cafeId || profile?.role === "customer") return;

    const supabase = createClient();

    const fetchPending = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, order_type, created_at")
        .eq("cafe_id", cafeId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setPendingOrders(data);
        setPendingCount(data.length);
      }
    };

    fetchPending();

    const channel = supabase
      .channel("header-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${cafeId}`,
        },
        (payload) => {
          const record = payload.new as Record<string, unknown> | undefined;
          if (payload.eventType === "INSERT" && record?.status === "pending") {
            const newOrder = record as unknown as PendingOrder;
            setPendingOrders((prev) => [newOrder, ...prev]);
            setPendingCount((c) => c + 1);
            playNotificationSound();
          } else if (payload.eventType === "UPDATE" && record) {
            if (record.status !== "pending") {
              setPendingOrders((prev) =>
                prev.filter((o) => o.id !== record.id)
              );
              setPendingCount((c) => Math.max(0, c - 1));
            } else {
              setPendingOrders((prev) =>
                prev.map((o) =>
                  o.id === record.id ? (record as unknown as PendingOrder) : o
                )
              );
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId, profile?.role]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    signOut();
    router.push("/auth/login");
  };

  const roleLabel = () => {
    switch (profile?.role) {
      case "super_admin":
        return "Super Admin";
      case "cafe_admin":
        return "Cafe Admin";
      case "cashier":
        return "Cashier";
      default:
        return "";
    }
  };

  const roleIcon = () => {
    switch (profile?.role) {
      case "super_admin":
        return <Shield className="w-4 h-4 text-primary" />;
      case "cafe_admin":
        return <Store className="w-4 h-4 text-secondary" />;
      case "cashier":
        return <User className="w-4 h-4 text-accent" />;
      default:
        return null;
    }
  };

  if (!user) return null;

  const showNotifs = profile?.role !== "customer";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMobileSidebar}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <Link href="/" className="flex items-center gap-2">
            <Gamepad2 className="w-7 h-7 text-primary" />
            <span className="text-lg font-bold text-foreground hidden sm:inline">
              RR Cafe POS
            </span>
          </Link>
          {profile && (
            <span className="hidden md:flex items-center gap-1.5 text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
              {roleIcon()}
              {roleLabel()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {profile && (
            <span className="md:hidden flex items-center gap-1 text-xs text-muted-foreground">
              {roleIcon()}
            </span>
          )}

          {showNotifs && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className={cn(
                  "p-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center relative",
                  notifOpen && "bg-muted"
                )}
              >
                <Bell className="w-5 h-5" />
                {pendingCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white animate-pulse-glow">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 glass-card rounded-xl shadow-2xl animate-slide-in-down">
                  <div className="p-3 border-b border-border">
                    <h3 className="text-sm font-semibold">Pending Orders</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pendingOrders.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8 px-4">
                        No pending orders
                      </p>
                    ) : (
                      pendingOrders.map((order) => (
                        <Link
                          key={order.id}
                          href={`/cafe/orders/${order.id}`}
                          onClick={() => setNotifOpen(false)}
                          className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {order.order_type === "qr"
                                ? "QR Order"
                                : order.order_type === "takeaway"
                                  ? "Takeaway"
                                  : "Dine In"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(
                                new Date(order.created_at),
                                { addSuffix: true }
                              )}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-primary">
                            ₹{Number(order.total).toFixed(0)}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Menu className="w-5 h-5" />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
                <div className="absolute right-0 top-12 z-50 w-56 glass-card rounded-xl p-2 shadow-2xl">
                  <div className="px-3 py-2 border-b border-border mb-1">
                    <p className="text-sm font-semibold">
                      {profile?.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {roleLabel()}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors min-h-[44px]"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}


