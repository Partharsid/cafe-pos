"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type {
  Cafe,
  MenuCategory,
  MenuItem,
  CafeTable,
} from "@/types/database";
import { QRCodeSVG } from "qrcode.react";
import {
  Minus,
  Plus,
  ShoppingCart,
  Loader2,
  ArrowLeft,
  User,
  Phone,
  Send,
  X,
  ChevronUp,
  Clock,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes: string;
  modifiers?: { groupName: string; selectedOptions: { name: string; price_modifier: number }[] }[];
  unitPrice?: number;
}

export default function CafeMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    searchParams.get("table_id") || null
  );
  const [tableNumber, setTableNumber] = useState(
    searchParams.get("table") || ""
  );
  const [placingOrder, setPlacingOrder] = useState(false);
  const [modifierPopup, setModifierPopup] = useState<{
    item: MenuItem;
    modifiers: any[];
    selections: Record<string, string[]>;
  } | null>(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<"now" | "later" | null>(null);
  const [paymentLinkUrl, setPaymentLinkUrl] = useState("");
  const [paymentLinkId, setPaymentLinkId] = useState("");
  const [razorpayOrderId, setRazorpayOrderId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "loading" | "qr" | "polling" | "paid" | "failed">("idle");

  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: cafeData } = await supabase
        .from("cafes")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();

      if (!cafeData) {
        setLoading(false);
        return;
      }

      setCafe(cafeData);

      const [catRes, itemRes, tableRes] = await Promise.all([
        supabase
          .from("menu_categories")
          .select("*")
          .eq("cafe_id", cafeData.id)
          .order("display_order"),
        supabase
          .from("menu_items")
          .select("*")
          .eq("cafe_id", cafeData.id)
          .eq("is_available", true)
          .order("display_order"),
        supabase
          .from("tables")
          .select("*")
          .eq("cafe_id", cafeData.id)
          .eq("is_active", true)
          .order("table_number"),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (itemRes.data) setItems(itemRes.data);
      if (tableRes.data) setTables(tableRes.data);
      setLoading(false);
    };
    fetchData();
  }, [slug]);

  const filteredItems = selectedCat
    ? items.filter((i) => i.category_id === selectedCat)
    : items;

  const addToCart = async (item: MenuItem) => {
    const { data: mods } = await supabase
      .from("item_modifiers")
      .select("*")
      .eq("menu_item_id", item.id)
      .order("display_order");

    if (mods && mods.length > 0) {
      const selections: Record<string, string[]> = {};
      mods.forEach((m: any) => {
        selections[m.id] = m.type === "select" ? [m.options[0]?.name || ""] : [];
      });
      setModifierPopup({ item, modifiers: mods, selections });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing)
        return prev.map((ci) =>
          ci.item.id === item.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        );
      return [{ item, quantity: 1, notes: "", unitPrice: item.price }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  const updateQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart((prev) =>
      prev.map((ci) =>
        ci.item.id === itemId ? { ...ci, quantity: qty } : ci
      )
    );
  };

  const getCartTotal = () =>
    cart.reduce((s, ci) => s + (ci.unitPrice ?? ci.item.price) * ci.quantity, 0);
  const getCartCount = () => cart.reduce((s, ci) => s + ci.quantity, 0);
  const taxPct = Number(cafe?.tax_percentage || 5) / 100;

  const placeOrderInDb = async (paymentNote?: string) => {
    const subtotal = getCartTotal();
const taxPct = Number((cafe as any)?.tax_percentage || 5) / 100;
    const tax = subtotal * taxPct;
    const royaltyPct = Number(cafe?.royalty_percentage || 0);
    const royaltyAmount = (subtotal * royaltyPct) / 100;
    const total = subtotal + tax;

    const notes = paymentNote ? paymentNote : "";

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        cafe_id: cafe?.id,
        table_id: selectedTableId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        order_type: "qr",
        status: "pending",
        subtotal,
        tax,
        royalty_amount: royaltyAmount,
        total,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    const orderItems = cart.map((ci) => {
      const unitPrice = ci.unitPrice ?? ci.item.price;
      return {
        order_id: order.id,
        menu_item_id: ci.item.id,
        quantity: ci.quantity,
        unit_price: unitPrice,
        subtotal: unitPrice * ci.quantity,
        notes: ci.notes || null,
        modifiers: ci.modifiers || null,
      };
    });

    await supabase.from("order_items").insert(orderItems);

    if (royaltyAmount > 0) {
      await supabase.from("royalty_logs").insert({
        cafe_id: cafe?.id,
        order_id: order.id,
        order_total: total,
        royalty_percentage: royaltyPct,
        royalty_amount: royaltyAmount,
      });
    }

    return order;
  };

  const handlePayLater = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!selectedTableId && !tableNumber.trim()) {
      toast.error("Please select or enter your table number");
      return;
    }

    setPlacingOrder(true);
    try {
      await placeOrderInDb("Payment pending at counter");
      toast.success("Order placed! Pay at the counter.");
      setCart([]);
      setShowForm(false);
      setShowCart(false);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod(null);
      setPaymentStatus("idle");

      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("cafe_id", cafe?.id)
        .in("status", ["pending", "preparing"]);

      const avgPrepTime = Number(cafe?.avg_prep_time_minutes ?? 15);
      const ordersAhead = (pendingOrders?.length || 0);
      const wait = Math.max(ordersAhead * avgPrepTime, avgPrepTime);
      setEstimatedWait(wait);
      setShowConfirmation(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePayNow = async () => {
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter your name and phone number");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    if (!selectedTableId && !tableNumber.trim()) {
      toast.error("Please select or enter your table number");
      return;
    }

    setPaymentStatus("loading");
    try {
      const subtotal = getCartTotal();
      const pct = Number((cafe as any)?.tax_percentage || 5) / 100;
      const total = subtotal + subtotal * pct;

      const res = await fetch("/api/razorpay/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: total,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          description: `Order at ${cafe?.name || "Cafe"}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment link");

      setPaymentLinkUrl(data.payment_link_url);
      setPaymentLinkId(data.payment_link_id);
      setRazorpayOrderId(data.payment_link_id);
      setPaymentStatus("qr");
    } catch (err: any) {
      toast.error(err.message);
      setPaymentStatus("failed");
    }
  };

  const confirmPaidOrder = async () => {
    setPlacingOrder(true);
    try {
      await placeOrderInDb("Paid via UPI QR");
      toast.success("Payment received! Your order is being prepared.");
      setCart([]);
      setShowForm(false);
      setShowCart(false);
      setCustomerName("");
      setCustomerPhone("");
      setPaymentMethod(null);
      setPaymentStatus("idle");
      setPaymentLinkUrl("");

      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("cafe_id", cafe?.id)
        .in("status", ["pending", "preparing"]);

      const avgPrepTime = Number(cafe?.avg_prep_time_minutes ?? 15);
      const ordersAhead = (pendingOrders?.length || 0);
      const wait = Math.max(ordersAhead * avgPrepTime, avgPrepTime);
      setEstimatedWait(wait);
      setShowConfirmation(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const resetPayment = () => {
    setPaymentMethod(null);
    setPaymentStatus("idle");
    setPaymentLinkUrl("");
    setPaymentLinkId("");
    setRazorpayOrderId("");
  };

  // Poll for payment status when QR is displayed
  useEffect(() => {
    if (paymentStatus !== "qr") return;
    if (!paymentLinkId && !razorpayOrderId) return;

    const linkId = paymentLinkId || razorpayOrderId;
    if (!linkId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/razorpay/check-status?payment_link_id=${linkId}`
        );
        const data = await res.json();
        if (data.paid) {
          clearInterval(interval);
          setPaymentStatus("paid");
          await confirmPaidOrder();
        }
      } catch {
        // continue polling
      }
    }, 5000);

    // Timeout after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setPaymentStatus("failed");
      toast.error("Payment timed out. You can try again or pay later.");
    }, 300000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentStatus, paymentLinkId, razorpayOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cafe) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Cafe Not Found</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          This cafe does not exist or is not active.
        </p>
        <Link
          href="/menu"
          className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm min-h-[44px] inline-flex items-center"
        >
          View All Cafes
        </Link>
      </div>
    );
  }

  const cartCount = getCartCount();

  return (
    <div className="min-h-screen p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/menu"
              className="text-muted-foreground hover:text-foreground shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate">
                {cafe.name}
              </h1>
              {cafe.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {cafe.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative neon-glow px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 shrink-0 ml-2 min-h-[44px]"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full text-xs flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] ${
              !selectedCat
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap min-h-[36px] ${
                selectedCat === cat.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="glass-card rounded-xl p-2 sm:p-3 text-left hover:border-primary/50 transition-all duration-200 active:scale-95 min-h-[44px]"
            >
              {item.image_url && (
                <div className="h-20 sm:h-28 rounded-lg overflow-hidden mb-2 bg-muted">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <p className="text-xs sm:text-sm font-semibold truncate">
                {item.name}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.description}
              </p>
              <p className="text-primary font-bold text-sm mt-1">
                ₹{Number(item.price).toFixed(0)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 right-4 z-30 neon-glow w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center sm:hidden active:scale-95 transition-transform"
        >
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full text-xs flex items-center justify-center font-bold">
            {cartCount}
          </span>
        </button>
      )}

      {/* Modifier Selection Popup */}
      {modifierPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-[90vw] animate-scale-in">
            <h3 className="font-bold text-lg mb-4">{modifierPopup.item.name}</h3>
            <div className="space-y-4">
              {modifierPopup.modifiers.map((mod: any) => (
                <div key={mod.id}>
                  <p className="text-sm font-semibold text-muted-foreground mb-2">{mod.name}</p>
                  <div className="space-y-1">
                    {mod.options.map((opt: any) => {
                      const isSelected = modifierPopup.selections[mod.id]?.includes(opt.name);
                      return (
                        <button
                          key={opt.name}
                          onClick={() => {
                            const selections = { ...modifierPopup.selections };
                            if (mod.type === "select") {
                              selections[mod.id] = [opt.name];
                            } else {
                              const current = selections[mod.id] || [];
                              selections[mod.id] = current.includes(opt.name)
                                ? current.filter((n: string) => n !== opt.name)
                                : [...current, opt.name];
                            }
                            setModifierPopup({ ...modifierPopup, selections });
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? "bg-primary/20 text-primary border border-primary/30"
                              : "bg-muted/60 text-muted-foreground border border-border hover:border-primary/30"
                          }`}
                        >
                          <span>{opt.name}</span>
                          {opt.price_modifier > 0 && (
                            <span className="text-xs">+₹{opt.price_modifier}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setModifierPopup(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const modifiers = modifierPopup.modifiers.map((m: any) => ({
                    groupName: m.name,
                    selectedOptions: (modifierPopup.selections[m.id] || []).map((name: string) => {
                      const opt = m.options.find((o: any) => o.name === name);
                      return { name, price_modifier: opt?.price_modifier || 0 };
                    }),
                  }));
                  const modifierPrice = modifiers.reduce(
                    (sum, m) => sum + m.selectedOptions.reduce((s, o) => s + o.price_modifier, 0),
                    0
                  );
                  setCart((prev) => {
                    const existing = prev.find(
                      (ci) => ci.item.id === modifierPopup.item.id && JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
                    );
                    if (existing)
                      return prev.map((ci) =>
                        ci.item.id === modifierPopup.item.id && JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
                          ? { ...ci, quantity: ci.quantity + 1 }
                          : ci
                      );
                    return [...prev, { item: modifierPopup.item, quantity: 1, notes: "", modifiers, unitPrice: modifierPopup.item.price + modifierPrice }];
                  });
                  setModifierPopup(null);
                }}
                className="flex-1 neon-glow px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Bottom Sheet (Mobile) / Drawer (Desktop) */}
      {showCart && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-md glass-card rounded-t-2xl sm:rounded-l-2xl sm:rounded-t-none max-h-[85vh] sm:max-h-full flex flex-col">
            {/* Drag handle (mobile only) */}
            <div className="flex items-center justify-center pt-2 pb-1 sm:hidden">
              <button
                onClick={() => setShowCart(false)}
                className="p-1 rounded-full hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Order</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-muted-foreground p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Cart is empty
                </p>
              ) : (
                cart.map((ci) => {
                  const unitPrice = ci.unitPrice ?? ci.item.price;
                  return (
                  <div
                    key={ci.item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ci.item.name}
                      </p>
                      {ci.modifiers && ci.modifiers.length > 0 && (
                        <p className="text-[10px] text-primary mt-0.5">
                          {ci.modifiers.map((m) => m.selectedOptions.map((o) => o.name).join(", ")).join(" | ")}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() =>
                            updateQty(ci.item.id, ci.quantity - 1)
                          }
                          className="p-1.5 rounded bg-muted hover:bg-muted/80 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQty(ci.item.id, ci.quantity + 1)
                          }
                          className="p-1.5 rounded bg-muted hover:bg-muted/80 min-w-[36px] min-h-[36px] flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        ₹{(unitPrice * ci.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{getCartTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax ({(taxPct * 100).toFixed(0)}%)</span>
                  <span>₹{(getCartTotal() * taxPct).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    ₹{(getCartTotal() * (1 + taxPct)).toFixed(2)}
                  </span>
                </div>

                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm min-h-[48px]"
                  >
                    Proceed to Order
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Your Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          value={customerName}
                          onChange={(e) =>
                            setCustomerName(e.target.value)
                          }
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                          placeholder="Enter your name"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          value={customerPhone}
                          onChange={(e) =>
                            setCustomerPhone(e.target.value)
                          }
                          type="tel"
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>
                    {!selectedTableId && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Table Number *
                        </label>
                        {tables.length > 0 ? (
                          <select
                            value={tableNumber}
                            onChange={(e) =>
                              setTableNumber(e.target.value)
                            }
                            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border outline-none text-sm min-h-[44px]"
                          >
                            <option value="">
                              Select your table
                            </option>
                            {tables.map((t) => (
                              <option
                                key={t.id}
                                value={t.table_number}
                              >
                                {t.table_number}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={tableNumber}
                            onChange={(e) =>
                              setTableNumber(e.target.value)
                            }
                            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                            placeholder="Enter your table number"
                          />
                        )}
                      </div>
                    )}

                    {/* Payment Method Selection */}
                    {!paymentMethod ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <p className="text-sm font-semibold text-center">
                          Select Payment Method
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => {
                              setPaymentMethod("now");
                              handlePayNow();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[80px]"
                          >
                            <CreditCard className="w-6 h-6 text-primary" />
                            <span className="text-xs font-semibold">Pay Now</span>
                            <span className="text-[10px] text-muted-foreground">Scan UPI QR</span>
                          </button>
                          <button
                            onClick={() => {
                              setPaymentMethod("later");
                              handlePayLater();
                            }}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[80px]"
                          >
                            <Clock className="w-6 h-6 text-muted-foreground" />
                            <span className="text-xs font-semibold">Pay Later</span>
                            <span className="text-[10px] text-muted-foreground">Pay at counter</span>
                          </button>
                        </div>
                      </div>
                    ) : paymentMethod === "later" ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <button
                          onClick={handlePayLater}
                          disabled={placingOrder}
                          className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                        >
                          {placingOrder ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          {placingOrder ? "Placing Order..." : "Confirm & Pay Later"}
                        </button>
                        <button
                          onClick={resetPayment}
                          className="w-full text-xs text-muted-foreground hover:text-foreground text-center min-h-[36px]"
                        >
                          Change payment method
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* QR Code Payment Modal */}
      {(paymentStatus === "loading" || paymentStatus === "qr" || paymentStatus === "polling" || paymentStatus === "paid" || paymentStatus === "failed") && (
        <>
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 max-w-sm w-full animate-scale-in text-center">
              {paymentStatus === "loading" && (
                <div className="py-8">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-sm font-semibold">Generating payment QR...</p>
                </div>
              )}

              {paymentStatus === "qr" && (
                <div>
                  <h3 className="text-lg font-bold mb-2">Scan to Pay</h3>
                  <p className="text-xs text-muted-foreground mb-4">Scan with any UPI app to pay</p>
                  <div className="flex justify-center mb-4">
                    <div className="bg-white rounded-xl p-4 inline-block">
                      <QRCodeSVG value={paymentLinkUrl} size={250} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Scan the QR code or tap to open payment link</p>
                  <a
                    href={paymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm block text-center min-h-[48px]"
                  >
                    Open Payment Link
                  </a>
                  <button
                    onClick={resetPayment}
                    className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    Cancel & pay later instead
                  </button>
                </div>
              )}

              {paymentStatus === "polling" && (
                <div>
                  <h3 className="text-lg font-bold mb-2">Awaiting Payment</h3>
                  <div className="flex justify-center mb-4">
                    <div className="bg-white rounded-xl p-4 inline-block opacity-70">
                      <QRCodeSVG value={paymentLinkUrl} size={250} />
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Waiting for payment confirmation...</span>
                  </div>
                  <button
                    onClick={resetPayment}
                    className="w-full text-xs text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    Cancel & pay later instead
                  </button>
                </div>
              )}

              {paymentStatus === "paid" && (
                <div className="py-6">
                  <div className="w-16 h-16 rounded-full bg-chart-4/20 mx-auto mb-4 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-chart-4" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Payment Successful!</h3>
                  <p className="text-sm text-muted-foreground">Your order is being placed...</p>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="py-6">
                  <div className="w-16 h-16 rounded-full bg-destructive/20 mx-auto mb-4 flex items-center justify-center">
                    <X className="w-8 h-8 text-destructive" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">Payment Failed</h3>
                  <p className="text-xs text-muted-foreground mb-4">Payment was not completed. You can try again or pay later.</p>
                  <button
                    onClick={() => {
                      setPaymentMethod("later");
                      handlePayLater();
                    }}
                    disabled={placingOrder}
                    className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px]"
                  >
                    {placingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                    Pay Later Instead
                  </button>
                  <button
                    onClick={() => {
                      resetPayment();
                      setPaymentMethod("now");
                      handlePayNow();
                    }}
                    className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground min-h-[36px]"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Order Confirmation with Estimated Wait */}
      {showConfirmation && estimatedWait !== null && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowConfirmation(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="glass-card rounded-2xl p-6 max-w-sm w-full animate-scale-in text-center">
              <div className="w-16 h-16 rounded-full bg-chart-4/20 mx-auto mb-4 flex items-center justify-center">
                <Clock className="w-8 h-8 text-chart-4" />
              </div>
              <h2 className="text-xl font-bold mb-2">Order Placed!</h2>
              <p className="text-3xl font-extrabold text-primary mb-1">
                ~{estimatedWait} min
              </p>
              <p className="text-sm text-muted-foreground mb-1">
                Estimated wait time
              </p>
              <p className="text-xs text-muted-foreground/60 mb-6">
                You will be notified when your order is ready
              </p>
              <button
                onClick={() => setShowConfirmation(false)}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm min-h-[48px] neon-glow"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
