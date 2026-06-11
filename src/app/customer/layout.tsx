"use client";

export const dynamic = "force-dynamic";

import { useAuthStore } from "@/lib/store/auth-store";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Store, ClipboardList, LogOut, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isLoading, setUser, setProfile, setLoading, signOut } =
    useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

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
        if (p && p.role === "customer") {
          setProfile(p);
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    };
    loadSession();
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    signOut();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCustomer = user && profile?.role === "customer";

  const navItems = [
    {
      href: "/menu",
      label: "Browse Cafes",
      icon: Store,
    },
    {
      href: "/customer/orders",
      label: "My Orders",
      icon: ClipboardList,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-t border-border/50">
        <div className="max-w-2xl mx-auto flex items-center justify-around py-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}

          {isCustomer ? (
            <button
              onClick={handleSignOut}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px] font-medium">Sign Out</span>
            </button>
          ) : (
            <Link
              href="/auth/signup"
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-colors text-muted-foreground hover:text-foreground"
            >
              <User className="w-5 h-5" />
              <span className="text-[10px] font-medium">Sign In</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
