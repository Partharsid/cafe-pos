import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { CreditCard, Banknote, Smartphone, Split, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react";

const paymentVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        cash: "bg-chart-4/20 text-chart-4 border border-chart-4/30",
        upi_qr: "bg-chart-3/20 text-chart-3 border border-chart-3/30",
        razorpay: "bg-primary/20 text-primary border border-primary/30",
        split: "bg-secondary/20 text-secondary border border-secondary/30",
      },
      status: {
        pending: "bg-chart-5/20 text-chart-5 border border-chart-5/30",
        completed: "bg-chart-4/20 text-chart-4 border border-chart-4/30",
        failed: "bg-destructive/20 text-destructive border border-destructive/30",
        refunded: "bg-muted text-muted-foreground border border-border",
      },
    },
    defaultVariants: {
      variant: "cash",
      status: "pending",
    },
  }
);

const methodIcons: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-3.5 h-3.5" />,
  upi_qr: <Smartphone className="w-3.5 h-3.5" />,
  razorpay: <CreditCard className="w-3.5 h-3.5" />,
  split: <Split className="w-3.5 h-3.5" />,
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5" />,
  failed: <AlertCircle className="w-3.5 h-3.5" />,
  refunded: <RefreshCw className="w-3.5 h-3.5" />,
};

const methodLabels: Record<string, string> = {
  cash: "Cash",
  upi_qr: "UPI QR",
  razorpay: "Online",
  split: "Split",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  completed: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export interface PaymentBadgeProps {
  method: string;
  status: string;
  className?: string;
}

export function PaymentBadge({ method, status, className }: PaymentBadgeProps) {
  const isStatusBadge = ["pending", "completed", "failed", "refunded"].includes(method);

  if (isStatusBadge) {
    return (
      <span className={cn(paymentVariants({ status: method as any }), className)}>
        {statusIcons[method]}
        {statusLabels[method] || method}
      </span>
    );
  }

  return (
    <span className={cn(paymentVariants({ variant: method as any, status: status as any }), className)}>
      {methodIcons[method]}
      {methodLabels[method] || method}
    </span>
  );
}