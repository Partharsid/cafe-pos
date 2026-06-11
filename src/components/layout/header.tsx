"use client";

import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Gamepad2,
  LogOut,
  Menu,
  Shield,
  Store,
  User,
  PanelLeft,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function Header() {
  const { user, profile, signOut } = useAuthStore();
  const { toggleMobileSidebar } = useUIStore();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

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
