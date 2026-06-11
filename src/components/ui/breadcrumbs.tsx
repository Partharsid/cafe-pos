"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const segmentLabels: Record<string, string> = {
  cafe: "Cafe",
  admin: "Admin",
  dashboard: "Dashboard",
  pos: "POS",
  menu: "Menu",
  orders: "Orders",
  tables: "Tables",
  analytics: "Analytics",
  inventory: "Inventory",
  counter: "Counter",
  kds: "KDS",
  cafes: "Cafes",
  royalty: "Royalty",
};

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const isLast = idx === segments.length - 1;
    const label = segmentLabels[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return { href, label, isLast };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground/60", className)}
    >
      <Link
        href="/"
        className="hover:text-foreground transition-colors p-1 -ml-1 rounded"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30" />
          {crumb.isLast ? (
            <span className="text-foreground/80 font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors truncate"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
