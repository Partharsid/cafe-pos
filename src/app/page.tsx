"use client";

export const dynamic = "force-dynamic";

import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { Gamepad2, ArrowRight, QrCode, ShoppingCart, ChefHat, UserPlus } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { user, profile, setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    const loadSession = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (p) setProfile(p);
      }
      setLoading(false);
    };
    loadSession();
  }, []);

  const getDashboardLink = () => {
    if (!profile) return "/auth/login";
    const links: Record<string, string> = {
      super_admin: "/admin/dashboard",
      cafe_admin: "/cafe/dashboard",
      cashier: "/counter",
      customer: "/menu",
    };
    return links[profile.role] || "/auth/login";
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-3 mb-4">
          <Gamepad2 className="w-14 h-14 text-primary" />
          <span className="text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
            RR Cafe POS
          </span>
        </div>
        <p className="text-zinc-300 text-lg max-w-md mx-auto">
          Cloud POS & QR Table Ordering for RR Downtown Arcade
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl w-full">
        <Link
          href="/menu"
          className="glass-card rounded-xl p-6 text-center hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group"
        >
          <QrCode className="w-8 h-8 text-primary mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Customer Menu</h3>
          <p className="text-xs text-muted-foreground">
            Scan QR to order
          </p>
        </Link>

        <Link
          href="/auth/signup"
          className="glass-card rounded-xl p-6 text-center hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 group"
        >
          <UserPlus className="w-8 h-8 text-accent mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Customer Sign Up</h3>
          <p className="text-xs text-muted-foreground">
            Create an account to order
          </p>
        </Link>

        <Link
          href="/kds"
          className="glass-card rounded-xl p-6 text-center hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 group"
        >
          <ChefHat className="w-8 h-8 text-accent mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Kitchen Display</h3>
          <p className="text-xs text-muted-foreground">
            Active orders view
          </p>
        </Link>

        <Link
          href={getDashboardLink()}
          className="glass-card rounded-xl p-6 text-center hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/10 transition-all duration-300 group"
        >
          <ShoppingCart className="w-8 h-8 text-secondary mx-auto mb-3 group-hover:scale-110 transition-transform" />
          <h3 className="font-semibold mb-1">Dashboard</h3>
          <p className="text-xs text-muted-foreground">
            {user ? "Go to dashboard" : "Staff sign in"}
          </p>
        </Link>
      </div>
    </main>
  );
}
