"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Gamepad2, Search, Store, Sparkles, LogIn } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Cafe } from "@/types/database";

function CafeCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-muted shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-5 bg-muted rounded-lg w-2/3" />
          <div className="h-3.5 bg-muted rounded-lg w-5/6" />
        </div>
        <div className="w-5 h-5 bg-muted rounded shrink-0" />
      </div>
    </div>
  );
}

function MenuLandingContent() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const supabase = createClient();

  const tableId = searchParams.get("table_id") || "";
  const table = searchParams.get("table") || "";

  useEffect(() => {
    supabase
      .from("cafes")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setCafes(data);
        setLoading(false);
      });
  }, []);

  const filtered = cafes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const buildCafeUrl = (slug: string) => {
    const params = new URLSearchParams();
    if (tableId) params.set("table_id", tableId);
    if (table) params.set("table", table);
    const qs = params.toString();
    return `/menu/${slug}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-10 mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity"
          >
            <Gamepad2 className="w-10 h-10 text-primary" />
            <span className="text-2xl font-extrabold tracking-tight">
              RR Downtown Arcade
            </span>
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
            Order Food
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Choose a cafe, browse the menu, and have your order delivered to
            your table
          </p>
        </div>

        {/* Sign In / Guest */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Continue as Guest
          </div>
          <Link
            href="/auth/login"
            className="flex items-center gap-1.5 text-xs text-foreground/70 hover:text-primary bg-muted/50 px-3 py-1.5 rounded-full border border-border hover:border-primary/40 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cafes..."
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-muted border border-border focus:border-primary outline-none text-sm transition-colors"
          />
        </div>

        {/* Cafe Grid */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <CafeCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <Store className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-semibold mb-2">No Cafes Available</h3>
            <p className="text-sm text-muted-foreground">
              {search
                ? "No cafes match your search. Try a different term."
                : "There are no active cafes right now. Please check back later."}
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((cafe) => (
              <Link key={cafe.id} href={buildCafeUrl(cafe.slug)}>
                <GlassCard
                  neon
                  className="p-5 hover:border-primary/40 transition-all duration-300 cursor-pointer group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300">
                      {cafe.logo_url ? (
                        <img
                          src={cafe.logo_url}
                          alt={cafe.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                        {cafe.name}
                      </h3>
                      {cafe.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {cafe.description}
                        </p>
                      )}
                    </div>
                    <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerMenuLanding() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen p-4">
          <div className="max-w-2xl mx-auto mt-20">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <CafeCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <MenuLandingContent />
    </Suspense>
  );
}
