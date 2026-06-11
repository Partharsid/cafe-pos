"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { UserPlus, User, Phone, Mail, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/store/auth-store";

function getPasswordStrength(pw: string) {
  if (pw.length === 0) return { score: 0, label: "", color: "" };
  if (pw.length < 6) return { score: 1, label: "Weak", color: "bg-red-500" };
  if (pw.length < 10) return { score: 2, label: "Medium", color: "bg-yellow-500" };
  return { score: 3, label: "Strong", color: "bg-green-500" };
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, setProfile } = useAuthStore();
  const supabase = createClient();

  const strength = getPasswordStrength(password);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please accept the terms of service");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        if (authData.session) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({
              id: authData.user.id,
              role: "customer",
              full_name: name.trim(),
              phone: phone.trim() || null,
              is_active: true,
            });

          if (profileError) throw profileError;

          setUser(authData.user);
          setProfile({
            id: authData.user.id,
            cafe_id: null,
            role: "customer",
            full_name: name.trim(),
            phone: phone.trim() || null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          toast.success("Account created! Browse cafes to start ordering.");
          router.push("/menu");
        } else {
          toast.success(
            "Check your email for a confirmation link, then sign in.",
            { duration: 6000 }
          );
          router.push("/auth/login");
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <UserPlus className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Create Account
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Create your customer account to track orders
          </p>
        </div>

        <div className="glass-card rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="Enter your name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="Enter phone number"
                />
              </div>
            </div>

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
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="••••••••"
                />
              </div>
              {password.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  <div className={`h-1 flex-1 rounded-full ${strength.score >= 1 ? strength.color : "bg-muted"}`} />
                  <div className={`h-1 flex-1 rounded-full ${strength.score >= 2 ? strength.color : "bg-muted"}`} />
                  <div className={`h-1 flex-1 rounded-full ${strength.score >= 3 ? strength.color : "bg-muted"}`} />
                  <span className="text-xs text-muted-foreground ml-2">{strength.label}</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors text-sm min-h-[48px]"
                  placeholder="••••••••"
                />
              </div>
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border bg-muted accent-primary"
              />
              <span className="text-xs text-muted-foreground">
                I agree to the terms of service
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="neon-glow w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 min-h-[48px]"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground mt-2">
            <Link href="/auth/login" className="text-muted-foreground hover:text-primary transition-colors">
              Staff? Login here →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
