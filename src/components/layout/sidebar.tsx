"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["super_admin"] },
  { href: "/admin/cafes", label: "Manage Cafes", icon: <Store className="w-5 h-5" />, roles: ["super_admin"] },
  { href: "/admin/royalty", label: "Royalty Reports", icon: <Percent className="w-5 h-5" />, roles: ["super_admin"] },
  { href: "/cafe/dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, roles: ["cafe_admin"] },
  { href: "/cafe/pos", label: "POS Counter", icon: <ShoppingCart className="w-5 h-5" />, roles: ["cafe_admin", "cashier"] },
  { href: "/cafe/menu", label: "Menu & Items", icon: <UtensilsCrossed className="w-5 h-5" />, roles: ["cafe_admin"] },
  { href: "/cafe/orders", label: "Orders", icon: <ClipboardList className="w-5 h-5" />, roles: ["cafe_admin", "cashier"] },
  { href: "/cafe/tables", label: "Tables & QR", icon: <QrCode className="w-5 h-5" />, roles: ["cafe_admin"] },
  { href: "/cafe/analytics", label: "Analytics", icon: <BarChart3 className="w-5 h-5" />, roles: ["cafe_admin"] },
  { href: "/cafe/inventory", label: "Inventory", icon: <Package className="w-5 h-5" />, roles: ["cafe_admin"] },
  { href: "/counter", label: "POS Counter", icon: <ShoppingCart className="w-5 h-5" />, roles: ["cashier"] },
  { href: "/kds", label: "Kitchen Display", icon: <ChefHat className="w-5 h-5" />, roles: ["super_admin", "cafe_admin", "cashier"] },
];

export function Sidebar() {
  const { profile } = useAuthStore();
  const pathname = usePathname();

  if (!profile) return null;

  const filtered = navItems.filter((item) => item.roles.includes(profile.role));

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] border-r border-border bg-card/50 backdrop-blur hidden lg:block">
      <nav className="p-4 space-y-1">
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
  );
}
