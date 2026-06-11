"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
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
  ChefHat,
  X,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
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
  },
  {
    href: "/cafe/tables",
    label: "Tables & QR",
    icon: <QrCode className="w-5 h-5" />,
    roles: ["cafe_admin"],
  },
  {
    href: "/cafe/analytics",
    label: "Analytics",
    icon: <BarChart3 className="w-5 h-5" />,
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
    { href: "/admin/royalty", label: "Royalty", icon: <Percent className="w-5 h-5" /> },
    { href: "/kds", label: "KDS", icon: <ChefHat className="w-5 h-5" /> },
  ],
  cafe_admin: [
    { href: "/cafe/dashboard", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
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

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  if (!profile) return null;

  const filtered = navItems.filter((item) => item.roles.includes(profile.role));
  const bottomTabs = bottomTabMap[profile.role] || [];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 min-h-[calc(100vh-4rem)] border-r border-border bg-card/50 backdrop-blur hidden lg:flex flex-col shrink-0">
        <nav className="p-4 space-y-1 flex-1">
          {filtered.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                pathname === item.href
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
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
              {filtered.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all duration-200 min-h-[44px]",
                    pathname === item.href
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1 rounded-lg transition-colors min-h-[44px]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.icon}
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
