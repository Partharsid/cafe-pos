"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { Cafe, MenuCategory, MenuItem, CafeTable } from "@/types/database";
import {
  Minus,
  Plus,
  ShoppingCart,
  Loader2,
  ArrowLeft,
  User,
  Phone,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";

interface CartItem {
  item: MenuItem;
  quantity: number;
  notes: string;
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
  const [tableNumber, setTableNumber] = useState(searchParams.get("table") || "");
  const [placingOrder, setPlacingOrder] = useState(false);

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

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing)
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      return [...prev, { item, quantity: 1, notes: "" }];
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
      prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: qty } : ci))
    );
  };

  const getCartTotal = () =>
    cart.reduce((s, ci) => s + ci.item.price * ci.quantity, 0);
  const getCartCount = () => cart.reduce((s, ci) => s + ci.quantity, 0);

  const handlePlaceOrder = async () => {
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
      const subtotal = getCartTotal();
      const tax = subtotal * 0.05;
      const royaltyPct = Number(cafe?.royalty_percentage || 0);
      const royaltyAmount = (subtotal * royaltyPct) / 100;
      const total = subtotal + tax;

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
        })
        .select()
        .single();

      if (error) throw error;

      const orderItems = cart.map((ci) => ({
        order_id: order.id,
        menu_item_id: ci.item.id,
        quantity: ci.quantity,
        unit_price: ci.item.price,
        subtotal: ci.item.price * ci.quantity,
        notes: ci.notes || null,
      }));

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

      toast.success("Order placed successfully! Your order will be prepared soon.");
      setCart([]);
      setShowForm(false);
      setCustomerName("");
      setCustomerPhone("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

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
        <p className="text-muted-foreground mb-4">
          This cafe does not exist or is not active.
        </p>
        <Link
          href="/menu"
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
        >
          View All Cafes
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/menu" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {cafe.name}
              </h1>
              {cafe.description && (
                <p className="text-xs text-muted-foreground">
                  {cafe.description}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative neon-glow px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            {getCartCount() > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full text-xs flex items-center justify-center font-bold">
                {getCartCount()}
              </span>
            )}
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
          <button
            onClick={() => setSelectedCat(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                selectedCat === cat.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => addToCart(item)}
              className="glass-card rounded-xl p-3 text-left hover:border-primary/50 transition-all duration-200 active:scale-95"
            >
              {item.image_url && (
                <div className="h-28 rounded-lg overflow-hidden mb-2 bg-muted">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <p className="text-sm font-semibold truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {item.description}
              </p>
              <p className="text-primary font-bold mt-1">
                ₹{Number(item.price).toFixed(0)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart Drawer */}
      {showCart && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowCart(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md glass-card rounded-l-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold">Your Order</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Cart is empty
                </p>
              ) : (
                cart.map((ci) => (
                  <div key={ci.item.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {ci.item.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateQty(ci.item.id, ci.quantity - 1)}
                          className="p-0.5 rounded bg-muted"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(ci.item.id, ci.quantity + 1)}
                          className="p-0.5 rounded bg-muted"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">
                        ₹{(ci.item.price * ci.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{getCartTotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (5%)</span>
                  <span>₹{(getCartTotal() * 0.05).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    ₹{(getCartTotal() * 1.05).toFixed(2)}
                  </span>
                </div>

                {!showForm ? (
                  <button
                    onClick={() => setShowForm(true)}
                    className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
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
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
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
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          type="tel"
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
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
                            onChange={(e) => setTableNumber(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border outline-none text-sm"
                          >
                            <option value="">Select your table</option>
                            {tables.map((t) => (
                              <option key={t.id} value={t.table_number}>
                                {t.table_number}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={tableNumber}
                            onChange={(e) => setTableNumber(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
                            placeholder="Enter your table number"
                          />
                        )}
                      </div>
                    )}
                    <button
                      onClick={handlePlaceOrder}
                      disabled={placingOrder}
                      className="neon-glow w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {placingOrder ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {placingOrder ? "Placing Order..." : "Place Order"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
