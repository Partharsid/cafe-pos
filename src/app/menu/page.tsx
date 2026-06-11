"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Gamepad2, Search, Store } from "lucide-react";
import Link from "next/link";
import type { Cafe } from "@/types/database";

export default function CustomerMenuLanding() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [search, setSearch] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("cafes")
      .select("*")
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) setCafes(data);
      });
  }, []);

  const filtered = cafes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 mt-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Gamepad2 className="w-8 h-8 text-primary" />
            <span className="text-xl font-extrabold tracking-tight">
              RR Downtown Arcade
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">
            Order Food
          </h1>
          <p className="text-muted-foreground">
            Select a cafe to view the menu
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cafes..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border focus:border-primary outline-none text-sm"
          />
        </div>

        <div className="space-y-3">
          {filtered.map((cafe) => (
            <Link key={cafe.id} href={`/menu/${cafe.slug}`}>
              <GlassCard className="p-5 hover:border-primary/50 transition-all duration-300 cursor-pointer flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/15">
                  <Store className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{cafe.name}</h3>
                  {cafe.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cafe.description}
                    </p>
                  )}
                </div>
              </GlassCard>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No cafes available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
