"use client";

export const dynamic = "force-dynamic";

import { useAuthStore } from "@/lib/store/auth-store";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import {
  Gamepad2, ArrowRight, QrCode, Smartphone, ChefHat,
  BellRing, ShoppingCart, LogIn, Phone, Mail, Globe
} from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const { user, profile, setUser, setProfile, setLoading } = useAuthStore();

  const cardsRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const [cardsInView, setCardsInView] = useState(false);
  const [stepsInView, setStepsInView] = useState(false);

  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCardsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = stepsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStepsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
  }, [setUser, setProfile, setLoading]);

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

  const getDashboardLabel = () => {
    if (!profile) return "Staff Login";
    const labels: Record<string, string> = {
      super_admin: "Admin Dashboard",
      cafe_admin: "Cafe Dashboard",
      cashier: "POS Counter",
      customer: "My Orders",
    };
    return labels[profile.role] || "Dashboard";
  };

  return (
    <main className="min-h-screen arcade-bg relative overflow-hidden">
      {/* ── Animated gradient orbs (background) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px]" />
        <div className="absolute top-1/2 -left-56 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 right-1/3 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px]" />
      </div>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative pt-28 pb-10 md:pt-44 md:pb-16 px-4 text-center">
        <div className="animate-bounce-in">
          <Gamepad2 className="w-20 h-20 md:w-28 md:h-28 text-primary mx-auto mb-6 drop-shadow-[0_0_32px_rgba(54,163,255,0.35)]" />
        </div>

        <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 animate-fade-in">
          <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            RR Cafe POS
          </span>
        </h1>

        <p className="text-base md:text-xl text-zinc-300 max-w-xl mx-auto leading-relaxed animate-fade-in">
          Scan. Order. Enjoy.
        </p>
        <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-lg mx-auto animate-fade-in">
          The official food ordering system for RR Downtown Arcade
        </p>
      </section>

      {/* ══════════ LOGGED‑IN WELCOME ══════════ */}
      {user && (
        <section className="relative px-4 pb-8 animate-scale-in">
          <div className="glass-card max-w-lg mx-auto rounded-2xl p-6 text-center">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
              Welcome back
            </p>
            <p className="text-foreground font-semibold text-base mb-5 break-all">
              {user.email}
            </p>
            <Link
              href={getDashboardLink()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors neon-glow"
            >
              Go to {getDashboardLabel()}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ════════════ ENTRY CARDS ════════════ */}
      <section className="relative px-4 pb-16 md:pb-24">
        <div
          ref={cardsRef}
          className={`grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto transition-all duration-700 ease-out ${
            cardsInView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          {/* ── CUSTOMERS ── */}
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col items-center text-center group hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 hover:-translate-y-1">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <QrCode className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-lg font-bold mb-0.5">Customers</h3>
            <p className="text-sm text-muted-foreground mb-2">Order Food</p>
            <p className="text-xs text-muted-foreground/70 mb-6 max-w-[220px] leading-relaxed">
              Scan QR at your table &rarr; Browse menu &rarr; Order instantly
            </p>
            <Link
              href="/menu"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors neon-glow mb-3"
            >
              View Menu
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/signup"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Create Account
            </Link>
          </div>

          {/* ── STAFF LOGIN ── */}
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col items-center text-center group hover:border-secondary/40 hover:shadow-lg hover:shadow-secondary/10 transition-all duration-300 hover:-translate-y-1">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <ShoppingCart className="w-7 h-7 text-secondary" />
            </div>
            <h3 className="text-lg font-bold mb-0.5">Staff Login</h3>
            <p className="text-sm text-muted-foreground mb-2">Cafe Dashboard</p>
            <p className="text-xs text-muted-foreground/70 mb-6 max-w-[220px] leading-relaxed">
              Manage orders, POS counter &amp; kitchen display
            </p>
            <Link
              href="/auth/login"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/90 transition-colors mb-3"
              style={{ boxShadow: "0 0 12px rgba(178,126,255,0.35)" }}
            >
              Staff Login
              <LogIn className="w-4 h-4" />
            </Link>
            <span className="text-[11px] text-muted-foreground/60">
              For cafe owners, cashiers &amp; kitchen staff
            </span>
          </div>

          {/* ── KITCHEN ── */}
          <div className="glass-card rounded-2xl p-6 md:p-8 flex flex-col items-center text-center group hover:border-accent/40 hover:shadow-lg hover:shadow-accent/10 transition-all duration-300 hover:-translate-y-1">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <ChefHat className="w-7 h-7 text-accent" />
            </div>
            <h3 className="text-lg font-bold mb-0.5">Kitchen</h3>
            <p className="text-sm text-muted-foreground mb-2">Kitchen Display</p>
            <p className="text-xs text-muted-foreground/70 mb-6 max-w-[220px] leading-relaxed">
              View live orders &amp; update preparation status
            </p>
            <Link
              href="/kds"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/90 transition-colors mb-3"
              style={{ boxShadow: "0 0 12px rgba(0,181,189,0.35)" }}
            >
              Open KDS
              <ArrowRight className="w-4 h-4" />
            </Link>
            <span className="text-[11px] text-muted-foreground/60">
              Kitchen Display System
            </span>
          </div>
        </div>
      </section>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section className="relative px-4 pb-16 md:pb-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 md:mb-14">
          How It Works
        </h2>

        <div
          ref={stepsRef}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto transition-all duration-700 ease-out ${
            stepsInView
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-10"
          }`}
        >
          {[
            {
              step: "01",
              icon: QrCode,
              color: "primary",
              title: "Scan QR Code",
              desc: "Scan the QR code at your table to open the digital menu",
            },
            {
              step: "02",
              icon: Smartphone,
              color: "secondary",
              title: "Browse & Order",
              desc: "Browse the menu, customize items, and place your order",
            },
            {
              step: "03",
              icon: ChefHat,
              color: "accent",
              title: "Kitchen Prepares",
              desc: "Kitchen receives your order instantly and starts preparing",
            },
            {
              step: "04",
              icon: BellRing,
              color: "primary",
              title: "Food Delivered",
              desc: "Fresh food is delivered directly to your table",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="relative flex flex-col items-center text-center group"
            >
              {/* Connector line (desktop only) */}
              {s.step !== "04" && (
                <div className="hidden lg:block absolute top-9 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-gradient-to-r from-border to-transparent" />
              )}

              <div className="relative z-10">
                <div
                  className={`w-16 h-16 rounded-2xl bg-${s.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <s.icon className={`w-7 h-7 text-${s.color}`} />
                </div>
                <span className="text-xs font-mono text-muted-foreground/50 mb-2 block">
                  {s.step}
                </span>
              </div>

              <h4 className="font-semibold mb-1">{s.title}</h4>
              <p className="text-xs text-muted-foreground/70 max-w-[200px] leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="relative border-t border-border/40 px-4 py-8 md:py-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5 text-sm text-muted-foreground">
          <div className="flex flex-col items-center md:items-start gap-0.5">
            <p className="text-foreground/80 font-semibold">
              RR Downtown Arcade
            </p>
            <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <a
              href="tel:+919121966933"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              +91 9121966933
            </a>
            <a
              href="mailto:rrdowntown33@gmail.com"
              className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              rrdowntown33@gmail.com
            </a>
          </div>

          <a
            href="https://rrdowntownarcade.in"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            rrdowntownarcade.in
          </a>
        </div>
      </footer>
    </main>
  );
}
