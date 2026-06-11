import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  neon?: boolean;
}

export function GlassCard({
  className,
  children,
  neon = false,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card rounded-xl p-6 transition-all duration-300",
        neon &&
          "hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
