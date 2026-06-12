"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Loader2,
  CheckCircle2,
  Banknote,
  Smartphone,
  CreditCard,
  Split,
  Printer,
  ArrowLeft,
  Clock,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";

type PaymentMode = "cash" | "upi_qr" | "split" | "razorpay";

interface PaymentModalProps {
  order: any;
  orderItems: any[];
  cafeName?: string;
  onClose: () => void;
  onPaymentComplete: (payment: any) => void;
}

export function PaymentModal({
  order,
  orderItems,
  cafeName,
  onClose,
  onPaymentComplete,
}: PaymentModalProps) {
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const supabase = createClient();

  if (!mode) {
    return (
      <ModeSelector
        order={order}
        orderItems={orderItems}
        cafeName={cafeName}
        onClose={onClose}
        onSelect={setMode}
      />
    );
  }

  if (paymentId) {
    return (
      <PaymentSuccess
        paymentId={paymentId}
        order={order}
        cafeName={cafeName}
        onClose={onClose}
        onPrint={() => printReceipt(order, orderItems, cafeName)}
      />
    );
  }

  return (
    <PaymentModeContent
      mode={mode}
      order={order}
      orderItems={orderItems}
      cafeName={cafeName}
      onBack={() => setMode(null)}
      onComplete={(pid) => setPaymentId(pid)}
      onClose={onClose}
      processing={processing}
      setProcessing={setProcessing}
    />
  );
}

function ModeSelector({
  order,
  orderItems,
  cafeName,
  onClose,
  onSelect,
}: {
  order: any;
  orderItems: any[];
  cafeName?: string;
  onClose: () => void;
  onSelect: (mode: PaymentMode) => void;
}) {
  const total = Number(order.total).toFixed(2);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/90 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-bold">Select Payment Method</h2>
            <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-sm text-muted-foreground">Total Amount</span>
            <span className="text-2xl font-black text-primary neon-text">₹{total}</span>
          </div>

          {orderItems.length > 0 && (
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {orderItems.map((oi: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{oi.quantity}x {oi.menu_item?.name || oi.menuItem?.name || "Item"}</span>
                  <span>₹{Number(oi.subtotal || oi.unit_price * oi.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>
          )}

          {order.table && (
            <p className="text-xs text-muted-foreground">Table: {order.table.table_number}</p>
          )}
        </div>

        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={() => onSelect("cash")}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:border-chart-4/50 hover:bg-chart-4/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-chart-4/20 flex items-center justify-center shrink-0">
              <Banknote className="w-5 h-5 text-chart-4" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold">Cash</p>
              <p className="text-xs text-muted-foreground">Pay with cash at counter</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("upi_qr")}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:border-chart-3/50 hover:bg-chart-3/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-chart-3/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-chart-3" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold">QR Code (UPI)</p>
              <p className="text-xs text-muted-foreground">Scan with GPay, PhonePe, Paytm</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("split")}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:border-secondary/50 hover:bg-secondary/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center shrink-0">
              <Split className="w-5 h-5 text-secondary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold">Split Payment</p>
              <p className="text-xs text-muted-foreground">Cash + UPI combined</p>
            </div>
          </button>

          <button
            onClick={() => onSelect("razorpay")}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold">Card / Net Banking / Wallet</p>
              <p className="text-xs text-muted-foreground">Credit/Debit cards, UPI, wallets</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentModeContent({
  mode,
  order,
  orderItems,
  cafeName,
  onBack,
  onComplete,
  onClose,
  processing,
  setProcessing,
}: {
  mode: PaymentMode;
  order: any;
  orderItems: any[];
  cafeName?: string;
  onBack: () => void;
  onComplete: (paymentId: string) => void;
  onClose: () => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
}) {
  const supabase = createClient();
  const total = Number(order.total);
  const [tendered, setTendered] = useState("");
  const [change, setChange] = useState(0);
  const [cashAmount, setCashAmount] = useState("");
  const [upiAmount, setUpiAmount] = useState("");
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(null);
  const [razorpayOrderId, setRazorpayOrderId] = useState<string | null>(null);
  const [razorpayPaymentLinkId, setRazorpayPaymentLinkId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [qrConfirmed, setQrConfirmed] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const createPayment = useCallback(
    async (method: string, extra: Record<string, any> = {}) => {
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          cafe_id: order.cafe_id,
          amount: total,
          method,
          status: "completed",
          ...extra,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id);

      return payment;
    },
    [order.id, order.cafe_id, total, supabase]
  );

  // Cash payment
  const handleCashPayment = useCallback(async () => {
    const cashVal = Number(tendered);
    if (cashVal < total) {
      toast.error("Amount tendered is less than total");
      return;
    }
    setProcessing(true);
    try {
      const payment = await createPayment("cash", { cash_amount: total });
      onComplete(payment.id);
      toast.success("Cash payment completed");
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  }, [tendered, total, createPayment, onComplete]);

  // UPI QR payment
  const generateQR = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/razorpay/create-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          name: "Cafe POS",
          description: `Order #${order.id.slice(0, 8)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPaymentLinkUrl(data.payment_link_url);
      setRazorpayOrderId(data.razorpay_order_id);
      setRazorpayPaymentLinkId(data.payment_link_id);
      setPolling(true);

      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          order_id: order.id,
          cafe_id: order.cafe_id,
          amount: total,
          method: "upi_qr",
          status: "pending",
          payment_link_url: data.payment_link_url,
          razorpay_order_id: data.razorpay_order_id,
        })
        .select()
        .single();

      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QR");
    } finally {
      setProcessing(false);
    }
  }, [total, order.id, order.cafe_id, supabase]);

  // Poll for UPI payment
  useEffect(() => {
    if (!polling || !razorpayOrderId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/razorpay/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpay_order_id: razorpayOrderId }),
        });
        const data = await res.json();

        if (data.paid) {
          setQrConfirmed(true);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);

          const { data: payments } = await supabase
            .from("payments")
            .update({ status: "completed" })
            .eq("razorpay_order_id", razorpayOrderId)
            .select()
            .single();

          await supabase
            .from("orders")
            .update({ status: "completed" })
            .eq("id", order.id);

          setTimeout(() => {
            onComplete(payments?.id || "qr_paid");
            toast.success("UPI payment received!");
          }, 1000);
        }
      } catch {
        // Polling error, retry
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling, razorpayOrderId, supabase, order.id, onComplete]);

  // Split payment
  const handleSplitPayment = useCallback(async () => {
    const cashVal = Number(cashAmount) || 0;
    const upiVal = Number(upiAmount) || 0;
    if (Math.abs(cashVal + upiVal - total) > 0.01) {
      toast.error(`Total must equal ₹${total.toFixed(2)}`);
      return;
    }

    setProcessing(true);
    try {
      if (upiVal > 0) {
        const res = await fetch("/api/razorpay/create-qr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount: upiVal, name: "Split UPI", description: `Split #${order.id.slice(0, 8)}` }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPaymentLinkUrl(data.payment_link_url);
        setRazorpayOrderId(data.razorpay_order_id);
        setRazorpayPaymentLinkId(data.payment_link_id);

        const { error } = await supabase.from("payments").insert({
          order_id: order.id,
          cafe_id: order.cafe_id,
          amount: total,
          method: "split",
          status: "pending",
          cash_amount: cashVal,
          upi_amount: upiVal,
          payment_link_url: data.payment_link_url,
          razorpay_order_id: data.razorpay_order_id,
          split_details: { cash: cashVal, upi: upiVal },
        });
        if (error) throw error;

        setPolling(true);
      } else {
        const payment = await createPayment("split", {
          cash_amount: cashVal,
          upi_amount: 0,
          split_details: { cash: cashVal, upi: 0 },
        });
        onComplete(payment.id);
        toast.success("Payment completed");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  }, [cashAmount, upiAmount, total, order.id, order.cafe_id, supabase, createPayment, onComplete]);

  // Poll for split UPI portion
  useEffect(() => {
    if (!polling || !razorpayOrderId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/razorpay/check-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpay_order_id: razorpayOrderId }),
        });
        const data = await res.json();

        if (data.paid) {
          setQrConfirmed(true);
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);

          const { data: payments } = await supabase
            .from("payments")
            .update({ status: "completed" })
            .eq("razorpay_order_id", razorpayOrderId)
            .select()
            .single();

          await supabase.from("orders").update({ status: "completed" }).eq("id", order.id);

          setTimeout(() => {
            onComplete(payments?.id || "split_paid");
            toast.success("Split payment completed!");
          }, 1000);
        }
      } catch {
        // retry
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling, razorpayOrderId, supabase, order.id, onComplete]);

  // Razorpay checkout
  const handleRazorpayCheckout = useCallback(async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total, receipt: order.id.slice(0, 12) }),
      });
      const orderData = await res.json();
      if (!res.ok) throw new Error(orderData.error);

      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          document.body.appendChild(script);
        });
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: cafeName || "Cafe POS",
        description: `Order #${order.id.slice(0, 8)}`,
        order_id: orderData.order_id,
        prefill: { contact: "", name: "" },
        theme: { color: "#36a3ff" },
        handler: async function (response: any) {
          const verifyRes = await fetch("/api/razorpay/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();

          if (verifyData.success) {
            const payment = await createPayment("razorpay", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            onComplete(payment.id);
            toast.success("Payment successful!");
          } else {
            toast.error("Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast("Payment cancelled", { icon: "ℹ️" });
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        toast.error(response.error?.description || "Payment failed");
        setProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
      setProcessing(false);
    }
  }, [total, order.id, cafeName, createPayment, onComplete]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const tenderedNum = Number(tendered) || 0;
  const changeAmt = Math.max(0, tenderedNum - total);

  const cashVal = Number(cashAmount) || 0;
  const upiVal = Number(upiAmount) || 0;
  const splitRemaining = total - cashVal;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-card/90 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg hover:bg-muted min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-bold capitalize">{mode.replace("_", " ")} Payment</h2>
              <p className="text-xs text-muted-foreground">Order #{order.id.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50">
            <span className="text-sm text-muted-foreground">Amount Due</span>
            <span className="text-xl font-black text-primary neon-text">₹{total.toFixed(2)}</span>
          </div>

          {mode === "cash" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Amount Tendered
                </label>
                <input
                  type="number"
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  placeholder="Enter amount received"
                  className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-lg font-bold text-center outline-none focus:border-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  min={0}
                  step={1}
                  autoFocus
                />
              </div>
              {tenderedNum >= total && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-chart-4/10 border border-chart-4/20">
                  <span className="text-sm text-chart-4 font-semibold">Change to give back</span>
                  <span className="text-lg font-black text-chart-4">₹{changeAmt.toFixed(2)}</span>
                </div>
              )}
              <button
                onClick={handleCashPayment}
                disabled={Number(tendered) < total || processing}
                className="neon-glow w-full py-3.5 rounded-xl bg-chart-4 text-black font-extrabold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                {processing ? "Processing..." : "Complete Cash Payment"}
              </button>
            </div>
          )}

          {mode === "upi_qr" && (
            <div className="space-y-4">
              {!paymentLinkUrl && !processing && (
                <button
                  onClick={generateQR}
                  className="neon-glow w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-4 h-4" />
                  Generate QR Code
                </button>
              )}
              {processing && !paymentLinkUrl && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </div>
              )}
              {paymentLinkUrl && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-2xl shadow-lg">
                      <QRCodeSVG value={paymentLinkUrl} size={300} level="M" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Scan this QR code with any UPI app (GPay, PhonePe, Paytm)
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-chart-5" />
                    <span className="text-chart-5 font-semibold animate-pulse">Waiting for payment...</span>
                  </div>
                  <button
                    onClick={() => {
                      setPaymentLinkUrl(null);
                      setPolling(false);
                      if (pollRef.current) clearInterval(pollRef.current);
                    }}
                    className="w-full py-2.5 rounded-xl bg-muted/40 border border-border text-sm font-medium hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {qrConfirmed && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-chart-4 animate-check-bounce" />
                  <p className="text-lg font-bold text-chart-4">Payment Received!</p>
                </div>
              )}
            </div>
          )}

          {mode === "split" && (
            <div className="space-y-4">
              {!paymentLinkUrl && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      Cash Amount
                    </label>
                    <input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => {
                        setCashAmount(e.target.value);
                        const cash = Number(e.target.value) || 0;
                        setUpiAmount(Math.max(0, total - cash).toFixed(2));
                      }}
                      placeholder="Cash amount"
                      className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-lg font-bold text-center outline-none focus:border-chart-4/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={0}
                      step={1}
                      autoFocus
                    />
                  </div>
                  {cashVal > 0 && cashVal <= total && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-chart-4/10 border border-chart-4/20">
                      <span className="text-sm text-chart-4 font-semibold">Cash Change</span>
                      <span className="text-lg font-black text-chart-4">
                        ₹{Math.max(0, cashVal - total).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                      UPI Amount (remaining)
                    </label>
                    <input
                      type="number"
                      value={upiAmount}
                      onChange={(e) => {
                        setUpiAmount(e.target.value);
                        const upi = Number(e.target.value) || 0;
                        setCashAmount(Math.max(0, total - upi).toFixed(2));
                      }}
                      placeholder="UPI amount"
                      className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-lg font-bold text-center outline-none focus:border-chart-3/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min={0}
                      step={1}
                    />
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className={`text-sm font-bold ${Math.abs(cashVal + upiVal - total) < 0.01 ? "text-chart-4" : "text-destructive"}`}>
                      ₹{(cashVal + upiVal).toFixed(2)} / ₹{total.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={handleSplitPayment}
                    disabled={Math.abs(cashVal + upiVal - total) > 0.01 || processing || (cashVal === 0 && upiVal === 0)}
                    className="neon-glow w-full py-3.5 rounded-xl bg-secondary text-black font-extrabold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                    {processing ? "Processing..." : "Process Split Payment"}
                  </button>
                </>
              )}
              {paymentLinkUrl && !qrConfirmed && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                    <span className="text-sm">UPI Amount to pay</span>
                    <span className="text-lg font-bold text-chart-3">₹{upiVal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-2xl shadow-lg">
                      <QRCodeSVG value={paymentLinkUrl} size={300} level="M" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-chart-5" />
                    <span className="text-chart-5 font-semibold animate-pulse">Waiting for UPI payment...</span>
                  </div>
                  <button
                    onClick={() => {
                      setPaymentLinkUrl(null);
                      setPolling(false);
                      if (pollRef.current) clearInterval(pollRef.current);
                    }}
                    className="w-full py-2.5 rounded-xl bg-muted/40 border border-border text-sm font-medium hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {qrConfirmed && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <CheckCircle2 className="w-16 h-16 text-chart-4 animate-check-bounce" />
                  <p className="text-lg font-bold text-chart-4">Split Payment Complete!</p>
                </div>
              )}
            </div>
          )}

          {mode === "razorpay" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <p className="text-sm font-medium">Pay with Razorpay</p>
                <p className="text-xs text-muted-foreground">
                  Supports: Credit/Debit Cards, Net Banking, UPI, Wallets
                </p>
              </div>
              <button
                onClick={handleRazorpayCheckout}
                disabled={processing}
                className="neon-glow w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-extrabold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                {processing ? "Opening Checkout..." : `Pay ₹${total.toFixed(2)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentSuccess({
  paymentId,
  order,
  cafeName,
  onClose,
  onPrint,
}: {
  paymentId: string;
  order: any;
  cafeName?: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl p-8 text-center max-w-sm w-[90vw] animate-bounce-in">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-20 h-20 text-chart-4 animate-check-bounce" />
        </div>
        <h2 className="text-2xl font-bold mb-1">Payment Successful!</h2>
        <p className="text-sm text-muted-foreground mb-2">
          Order #{order.id.slice(0, 8)}
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Payment ID: {paymentId.slice(0, 8)}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onPrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-sm min-h-[48px] transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm min-h-[48px] transition-opacity hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function printReceipt(order: any, orderItems: any[], cafeName?: string) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    toast.error("Pop-up blocked. Please allow pop-ups to print.");
    return;
  }

  const itemsHtml = (orderItems || [])
    .map(
      (oi: any) =>
        `<tr><td style="padding:4px 0">${oi.quantity}x ${oi.menu_item?.name || oi.menuItem?.name || "Item"}</td><td style="text-align:right;padding:4px 0">₹${Number(oi.subtotal || oi.unit_price * oi.quantity).toFixed(0)}</td></tr>`
    )
    .join("");

  const tableInfo = order.table
    ? `<p style="font-size:11px;margin:0">Table: ${order.table.table_number}</p>`
    : "";

  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt</title>
<style>body{font-family:monospace;font-size:13px;max-width:300px;margin:0 auto;padding:20px;color:#111}.center{text-align:center}.divider{border-top:1px dashed #aaa;margin:10px 0}table{width:100%;border-collapse:collapse}.total{font-size:18px;font-weight:bold}</style>
</head><body>
<div class="center">
  <p style="font-size:18px;font-weight:bold">${cafeName || "Cafe POS"}</p>
  <p style="font-size:11px">Order #${order.id.slice(0, 8)}</p>
  ${tableInfo}
  <p style="font-size:10px">${format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}</p>
</div>
<div class="divider"></div>
<table style="font-size:12px">${itemsHtml}</table>
<div class="divider"></div>
<table style="font-size:12px">
  <tr><td>Subtotal</td><td style="text-align:right">₹${Number(order.subtotal).toFixed(2)}</td></tr>
  <tr><td>Tax</td><td style="text-align:right">₹${Number(order.tax).toFixed(2)}</td></tr>
</table>
<div class="divider"></div>
<div class="center">
  <p class="total">TOTAL: ₹${Number(order.total).toFixed(2)}</p>
  <p style="font-size:14px;margin-top:8px;font-weight:bold">PAID</p>
</div>
<div class="divider"></div>
<div class="center" style="font-size:11px;margin-top:14px">
  <p>Thank you!</p>
  <p>Visit again at RR Downtown Arcade</p>
  <p style="margin-top:6px;font-size:10px">Payment ID: ${order.id.slice(0, 8)}</p>
</div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}