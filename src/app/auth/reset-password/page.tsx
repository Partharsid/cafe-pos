"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Mail, Lock, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your email for the reset link");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Reset Password
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Enter your email to receive a password reset link
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-6 space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-chart-4" />
              </div>
              <h2 className="text-lg font-bold">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We&apos;ve sent a password reset link to <strong>{email}</strong>
              </p>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-4"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
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

              <button
                type="submit"
                disabled={loading}
                className="neon-glow w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Sending..." : "Send Reset Link"}
              </button>

              <div className="text-center">
                <Link
                  href="/auth/login"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}