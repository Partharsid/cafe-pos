"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { useOrderStore } from "@/lib/store/order-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { MenuItem, MenuCategory, CafeTable } from "@/types/database";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Loader2,
  Search,
  AudioLines,
} from "lucide-react";
import toast from "react-hot-toast";

export default function POSPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{id:string, name:string}[]>([]);
  const {
    cart,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateNotes,
    clearCart,
    getCartTotal,
  } = useOrderStore();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">(
    "dine_in"
  );
  const [showCart, setShowCart] = useState(false);
  const [newOrderSound, setNewOrderSound] = useState(false);

  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("cafes").select("id, name").eq("is_active", true).then(({data}) => {
        if (data) { setCafes(data); if (data.length > 0) setSelectedCafeId(data[0].id); }
      });
    }
  }, [isSuperAdmin]);

  const fetchData = useCallback(async () => {
    if (!cafeId) return;
    const [catRes, itemRes, tableRes] = await Promise.all([
      supabase
        .from("menu_categories")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("display_order"),
      supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("display_order"),
      supabase
        .from("tables")
        .select("*")
        .eq("cafe_id", cafeId)
        .eq("is_active", true)
        .order("table_number"),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    if (tableRes.data) setTables(tableRes.data);
    setLoading(false);
  }, [cafeId, supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const channel = supabase
      .channel("new-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `cafe_id=eq.${cafeId}`,
        },
        () => {
          setNewOrderSound(true);
          toast("New order received!", { icon: "🔔" });
          setTimeout(() => setNewOrderSound(false), 1000);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cafeId, supabase]);

  const filteredItems = items.filter((item) => {
    const catMatch = selectedCategory
      ? item.category_id === selectedCategory
      : true;
    const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  });

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !selectedTable) {
      toast.error("Please select a table");
      return;
    }

    setPlacingOrder(true);
    try {
      const subtotal = getCartTotal();
      const taxRate = 0.05;
      const tax = subtotal * taxRate;

      const { data: cafeData } = await supabase
        .from("cafes")
        .select("royalty_percentage")
        .eq("id", cafeId)
        .single();

      const royaltyPct = Number(cafeData?.royalty_percentage || 0);
      const royaltyAmount = (subtotal * royaltyPct) / 100;
      const total = subtotal + tax;

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          cafe_id: cafeId,
          table_id: orderType === "dine_in" ? selectedTable : null,
          staff_id: profile?.id,
          order_type: orderType,
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
        menu_item_id: ci.menuItem.id,
        quantity: ci.quantity,
        unit_price: ci.menuItem.price,
        subtotal: ci.menuItem.price * ci.quantity,
        notes: ci.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);
      if (itemsError) throw itemsError;

      if (royaltyAmount > 0) {
        await supabase.from("royalty_logs").insert({
          cafe_id: cafeId,
          order_id: order.id,
          order_total: total,
          royalty_percentage: royaltyPct,
          royalty_amount: royaltyAmount,
        });
      }

      cart.forEach(async (ci) => {
        if (ci.menuItem.stock_quantity !== null) {
          const newQty = ci.menuItem.stock_quantity - ci.quantity;
          await supabase
            .from("menu_items")
            .update({ stock_quantity: Math.max(0, newQty) })
            .eq("id", ci.menuItem.id);
        }
      });

      toast.success("Order placed!");
      clearCart();
      setSelectedTable(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col space-y-4 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">POS Counter</h1>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
            >
              <option value="dine_in">Dine In</option>
              <option value="takeaway">Takeaway</option>
            </select>
            {orderType === "dine_in" && (
              <select
                value={selectedTable || ""}
                onChange={(e) => setSelectedTable(e.target.value || null)}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
              >
                <option value="">Select Table</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.table_number}
                  </option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="lg:hidden neon-glow flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart ({cart.reduce((s, ci) => s + ci.quantity, 0)})
          </button>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Cafe:</span>
            <select
              value={selectedCafeId || ""}
              onChange={(e) => setSelectedCafeId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
            >
              {cafes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              !selectedCategory
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredItems.map((item) => {
              const inStock =
                item.stock_quantity === null || item.stock_quantity > 0;
              const isLow =
                item.stock_quantity !== null &&
                item.stock_quantity <= item.low_stock_threshold &&
                item.stock_quantity > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => inStock && addToCart(item)}
                  disabled={!inStock || !item.is_available}
                  className={`glass-card rounded-xl p-3 text-left transition-all duration-200 ${
                    inStock && item.is_available
                      ? "hover:border-primary/50 cursor-pointer active:scale-95"
                      : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  {item.image_url && (
                    <div className="h-24 rounded-lg overflow-hidden mb-2 bg-muted">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {item.name}
                      </p>
                      <p className="text-primary font-bold text-sm mt-0.5">
                        ₹{Number(item.price).toFixed(0)}
                      </p>
                    </div>
                    {isLow && (
                      <Badge variant="warning" className="shrink-0">
                        Low
                      </Badge>
                    )}
                  </div>
                  {!item.is_available && (
                    <p className="text-xs text-destructive mt-1">Unavailable</p>
                  )}
                  {!inStock && item.is_available && (
                    <p className="text-xs text-destructive mt-1">Out of stock</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className={`lg:w-96 glass-card rounded-xl p-4 flex flex-col ${
          showCart ? "block" : "hidden lg:flex"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Order Cart</h2>
          <button
            onClick={clearCart}
            className="text-xs text-destructive hover:underline"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {cart.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              No items in cart
            </p>
          ) : (
            cart.map((ci) => (
              <div
                key={ci.menuItem.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {ci.menuItem.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={() =>
                        updateQuantity(ci.menuItem.id, ci.quantity - 1)
                      }
                      className="p-0.5 rounded bg-muted hover:bg-muted/80"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-semibold w-6 text-center">
                      {ci.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity(ci.menuItem.id, ci.quantity + 1)
                      }
                      className="p-0.5 rounded bg-muted hover:bg-muted/80"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    ₹{(ci.menuItem.price * ci.quantity).toFixed(0)}
                  </p>
                  <button
                    onClick={() => removeFromCart(ci.menuItem.id)}
                    className="text-xs text-destructive mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border pt-3 mt-3 space-y-2">
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
          <button
            onClick={handlePlaceOrder}
            disabled={cart.length === 0 || placingOrder}
            className="neon-glow w-full py-3 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {placingOrder && <Loader2 className="w-4 h-4 animate-spin" />}
            {placingOrder ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
