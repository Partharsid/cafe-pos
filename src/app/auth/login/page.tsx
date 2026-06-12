"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/store/auth-store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, setProfile } = useAuthStore();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");
      if (!profile.is_active) throw new Error("Account is deactivated");
      if (profile.role === "customer")
        throw new Error("Customer accounts cannot access the dashboard");

      setUser(authData.user);
      setProfile(profile);

      const redirects: Record<string, string> = {
        super_admin: "/admin/dashboard",
        cafe_admin: "/cafe/dashboard",
        cashier: "/counter",
      };

      router.push(redirects[profile.role] || "/");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push("/auth/reset-password");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Staff Login
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Sign in to your dashboard
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 sm:gap-4 mb-4 flex-wrap">
          <Link
            href="/menu"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Customer? Order here →
          </Link>
          <Link
            href="/auth/signup"
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            Create an account
          </Link>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="neon-glow w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don&apos;t have an account? Contact your administrator
          </p>

          <div className="text-center mt-3">
            <Link
              href="/menu"
              className="text-xs text-primary hover:underline"
            >
              Are you a customer? Order food here &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
