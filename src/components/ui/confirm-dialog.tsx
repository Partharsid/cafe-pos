"use client";

import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !loading && onOpenChange(false)}
      />
      <GlassCard className="relative z-50 w-full max-w-sm p-6 text-center animate-scale-in">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4",
            variant === "danger"
              ? "bg-destructive/20"
              : "bg-primary/20"
          )}
        >
          {variant === "danger" ? (
            <Trash2 className="w-6 h-6 text-destructive" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-primary" />
          )}
        </div>

        <h3 className="text-lg font-bold mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm mb-5">{message}</p>

        <div className="flex gap-2 justify-center">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-sm min-h-[44px] hover:bg-muted transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] disabled:opacity-50 transition-colors flex items-center gap-2",
              variant === "danger"
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Processing..." : confirmText}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
