"use client";

import Link from "next/link";
import { Gamepad2, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
          <Gamepad2 className="w-10 h-10 text-primary" />
          <span className="text-2xl font-extrabold tracking-tight">
            RR Cafe POS
          </span>
        </Link>
      </div>

      <div className="glass-card rounded-2xl p-8 sm:p-12 max-w-md w-full">
        <h1 className="text-7xl font-extrabold tracking-tighter text-primary mb-3">404</h1>
        <h2 className="text-xl font-semibold mb-2">Page not found</h2>
        <p className="text-muted-foreground text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="neon-glow inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity min-h-[48px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
