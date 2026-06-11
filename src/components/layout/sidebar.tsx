"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  ClipboardList,
  QrCode,
  BarChart3,
  Package,
  Store,
  Percent,
  Users,
  ChefHat,
  X,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Calendar,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: boolean;
}

const navItems: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["super_admin"],
  },
  {
    href: "/admin/cafes",
    label: "Manage Cafes",
    icon: <Store className="w-5 h-5" />,
    roles: ["super_admin"],
  },
  {
    href: "/admin/users",
    label: "Staff Management",
    icon: <Users className="w-5 h-5" />,
    roles: ["super_admin"],
  },
  {
    href: "/admin/royalty",
    label: "Royalty Reports",
    icon: <Percent className="w-5 h-5" />,
    roles: ["super_admin"],
  },
  {
    href: "/cafe/dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/pos",
    label: "POS Counter",
    icon: <ShoppingCart className="w-5 h-5" />,
    roles: ["cafe_admin", "cashier"],
  },
  {
    href: "/cafe/menu",
    label: "Menu & Items",
    icon: <UtensilsCrossed className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/orders",
    label: "Orders",
    icon: <ClipboardList className="w-5 h-5" />,
    roles: ["cafe_admin", "cashier"],
    badge: true,
  },
  {
    href: "/cafe/tables",
    label: "Tables & QR",
    icon: <QrCode className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/table-map",
    label: "Table Map",
    icon: <LayoutGrid className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/customers",
    label: "Customers",
    icon: <Users className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/analytics",
    label: "Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/day-end",
    label: "Day End",
    icon: <Calendar className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/inventory",
    label: "Inventory",
    icon: <Package className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/counter",
    label: "POS Counter",
    icon: <ShoppingCart className="w-5 h-5" />,
    roles: ["cashier"],
  },
  {
    href: "/kds",
    label: "Kitchen Display",
    icon: <ChefHat className="w-5 h-5" />,
    roles: ["super_admin", "cafe_admin", "cashier"],
  },
];

const bottomTabMap: Record<string, { href: string; label: string; icon: React.ReactNode }[]> = {
  super_admin: [
    { href: "/admin/dashboard", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/admin/cafes", label: "Cafes", icon: <Store className="w-5 h-5" /> },
    { href: "/admin/users", label: "Staff", icon: <Users className="w-5 h-5" /> },
    { href: "/admin/royalty", label: "Royalty", icon: <Percent className="w-5 h-5" /> },
    { href: "/kds", label: "KDS", icon: <ChefHat className="w-5 h-5" /> },
  ],
  cafe_admin: [
    { href: "/cafe/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: "/cafe/pos", label: "POS", icon: <ShoppingCart className="w-5 h-5" /> },
    { href: "/cafe/orders", label: "Orders", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/cafe/menu", label: "Menu", icon: <UtensilsCrossed className="w-5 h-5" /> },
    { href: "/kds", label: "KDS", icon: <ChefHat className="w-5 h-5" /> },
  ],
  cashier: [
    { href: "/counter", label: "POS", icon: <ShoppingCart className="w-5 h-5" /> },
    { href: "/cafe/orders", label: "Orders", icon: <ClipboardList className="w-5 h-5" /> },
    { href: "/kds", label: "KDS", icon: <ChefHat className="w-5 h-5" /> },
  ],
};

export function Sidebar() {
  const { profile } = useAuthStore();
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUIStore();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const [activeRect, setActiveRect] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  useEffect(() => {
    if (!profile?.cafe_id || profile.role === "customer") return;

    const supabase = createClient();

    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("cafe_id", profile.cafe_id)
      .eq("status", "pending")
      .then(({ count }) => setPendingCount(count || 0));

    const channel = supabase
      .channel("sidebar-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${profile.cafe_id}`,
        },
        () => {
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("cafe_id", profile.cafe_id)
            .eq("status", "pending")
            .then(({ count }) => setPendingCount(count || 0));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.cafe_id, profile?.role]);

  useEffect(() => {
    if (!navRef.current || collapsed) {
      setActiveRect(null);
      return;
    }

    const activeLink = navRef.current.querySelector('[data-active="true"]');
    if (activeLink) {
      const navTop = navRef.current.getBoundingClientRect().top;
      const linkRect = activeLink.getBoundingClientRect();
      setActiveRect({
        top: linkRect.top - navTop,
        height: linkRect.height,
      });
    } else {
      setActiveRect(null);
    }
  }, [pathname, collapsed]);

  const filtered = navItems.filter((item) => item.roles.includes(profile!.role));
  const bottomTabs = bottomTabMap[profile!.role] || [];

  if (!profile) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "min-h-[calc(100vh-4rem)] border-r border-border bg-card/50 backdrop-blur hidden lg:flex flex-col shrink-0 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <nav ref={navRef} className="p-3 space-y-1 flex-1 relative">
          {activeRect && !collapsed && (
            <div
              className="absolute left-3 right-3 rounded-lg bg-primary/15 transition-all duration-300 ease-out"
              style={{
                top: activeRect.top,
                height: activeRect.height,
              }}
            />
          )}

          {filtered.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const hasPending = item.badge && pendingCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive || undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg text-sm transition-all duration-200 group",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5 z-10",
                  isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="relative shrink-0">
                  {item.icon}
                  {hasPending && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card animate-pulse-glow" />
                  )}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 rounded-lg bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg border border-border">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="mx-3 mb-3 p-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs ml-2">Collapse</span>
            </>
          )}
        </button>
      </aside>

      {/* Mobile Slideover */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 glass-card z-50 lg:hidden flex flex-col animate-slide-in-left">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-lg font-bold">Navigation</span>
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
              {filtered.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const hasPending = item.badge && pendingCount > 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-200 min-h-[44px]",
                      isActive
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className="relative shrink-0">
                      {item.icon}
                      {hasPending && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card animate-pulse-glow" />
                      )}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Mobile Bottom Tab Bar */}
      {bottomTabs.length > 0 && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass-card border-t border-border safe-bottom">
          <div className="flex items-center justify-around h-16 px-1">
            {bottomTabs.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const hasPending =
                (item.href === "/cafe/orders" || item.href.includes("/orders")) &&
                pendingCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg transition-colors min-h-[44px] relative",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="relative">
                    {item.icon}
                    {hasPending && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card animate-pulse-glow" />
                    )}
                  </span>
                  <span className="text-[10px] font-medium truncate max-w-full">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
