"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { useOrderStore } from "@/lib/store/order-store";
import type { MenuItem, MenuCategory, CafeTable } from "@/types/database";
import { PaymentModal } from "@/components/pos/payment-modal";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  Loader2,
  Search,
  X,
  ChevronDown,
  Zap,
  Bell,
  Hash,
  NotebookPen,
  CheckCircle2,
  Printer,
  PlusCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const TAX_RATE_DEFAULT = 0.05;

function playBellSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not supported
  }
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-3 animate-pulse space-y-2">
          <div className="h-28 rounded-lg bg-muted/50" />
          <div className="h-4 w-3/4 rounded bg-muted/50" />
          <div className="h-5 w-1/3 rounded bg-muted/50" />
        </div>
      ))}
    </div>
  );
}

function SuccessOverlay({ orderId, onPrint, onClose }: { orderId: string; onPrint: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-8 text-center max-w-sm w-[90vw] animate-bounce-in">
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-16 h-16 text-chart-4 animate-check-bounce" />
        </div>
        <h2 className="text-xl font-bold mb-1">Order Placed!</h2>
        <p className="text-sm text-muted-foreground mb-6">Order #{orderId.slice(0, 8)}</p>
        <div className="flex gap-3">
          <button onClick={onPrint} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-sm min-h-[48px] transition-colors">
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm min-h-[48px] transition-opacity hover:opacity-90">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function POSPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const { cart, addToCart, removeFromCart, updateQuantity, updateNotes, clearCart, getCartTotal } = useOrderStore();

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway">("dine_in");
  const [showCart, setShowCart] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [taxRate, setTaxRate] = useState(TAX_RATE_DEFAULT);
  const [showTaxInput, setShowTaxInput] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [successOrder, setSuccessOrder] = useState<{ id: string; data: any } | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<{ order: any; items: any[] } | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;
  const orderItemsRef = useRef<any[]>([]);

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("cafes").select("id, name").eq("is_active", true).then(({ data }) => {
        if (data) { setCafes(data); if (data.length > 0 && !selectedCafeId) setSelectedCafeId(data[0].id); }
      });
    }
  }, [isSuperAdmin]);

  const fetchData = useCallback(async () => {
    if (!cafeId) return;
    setLoading(true);
    const [catRes, itemRes, tableRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("cafe_id", cafeId).order("display_order"),
      supabase.from("menu_items").select("*").eq("cafe_id", cafeId).order("display_order"),
      supabase.from("tables").select("*").eq("cafe_id", cafeId).eq("is_active", true).order("table_number"),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    if (tableRes.data) setTables(tableRes.data);
    setLoading(false);
  }, [cafeId, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!cafeId) return;
    const channel = supabase.channel("new-orders-pos")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `cafe_id=eq.${cafeId}` },
        (payload) => {
          const order = payload.new as any;
          if (order.order_type === "qr") {
            setNewOrderCount((c) => c + 1);
            playBellSound();
            toast("New QR order received! 🔔", { duration: 5000, style: { background: "rgba(5,5,10,0.95)", color: "#fff", border: "1px solid var(--primary)" } });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cafeId, supabase]);

  const filteredItems = useMemo(() => items.filter((item) => {
    const catMatch = selectedCategory ? item.category_id === selectedCategory : true;
    const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
    return catMatch && searchMatch;
  }), [items, selectedCategory, search]);

  const handleAddToCart = useCallback((item: MenuItem) => {
    if (!item.is_available || (item.stock_quantity !== null && item.stock_quantity <= 0)) return;
    addToCart(item);
    setRecentlyAdded((prev) => new Set(prev).add(item.id));
    setTimeout(() => { setRecentlyAdded((prev) => { const next = new Set(prev); next.delete(item.id); return next; }); }, 800);
    if (quickAdd && navigator.vibrate) navigator.vibrate(15);
  }, [addToCart, quickAdd]);

  const handlePlaceOrder = useCallback(async () => {
    if (cart.length === 0) return;
    if (orderType === "dine_in" && !selectedTable) { toast.error("Please select a table"); return; }
    setPlacingOrder(true);
    try {
      const subtotal = getCartTotal();
      const discountAmount = subtotal * (discountPercent / 100);
      const tax = subtotal * taxRate;
      const { data: cafeData } = await supabase.from("cafes").select("royalty_percentage, name").eq("id", cafeId).single();
      const royaltyPct = Number(cafeData?.royalty_percentage || 0);
      const royaltyAmount = ((subtotal - discountAmount) * royaltyPct) / 100;
      const total = subtotal - discountAmount + tax;

      const { data: order, error } = await supabase.from("orders").insert({
        cafe_id: cafeId, table_id: orderType === "dine_in" ? selectedTable : null,
        staff_id: profile?.id, order_type: orderType, status: "pending",
        subtotal, tax, discount_amount: discountAmount, discount_percentage: discountPercent, royalty_amount: royaltyAmount, total, notes: orderNotes || null,
      }).select().single();
      if (error) throw error;

      const orderItems = cart.map((ci) => ({
        order_id: order.id, menu_item_id: ci.menuItem.id, quantity: ci.quantity,
        unit_price: ci.menuItem.price, subtotal: ci.menuItem.price * ci.quantity, notes: ci.notes || null,
      }));

      orderItemsRef.current = cart.map((ci) => ({
        order_id: order.id, menu_item_id: ci.menuItem.id, quantity: ci.quantity,
        unit_price: ci.menuItem.price, subtotal: ci.menuItem.price * ci.quantity,
        notes: ci.notes || null, menu_item: ci.menuItem, name: ci.menuItem.name,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      if (royaltyAmount > 0) {
        await supabase.from("royalty_logs").insert({
          cafe_id: cafeId, order_id: order.id, order_total: total,
          royalty_percentage: royaltyPct, royalty_amount: royaltyAmount,
        });
      }

      await Promise.all(
        cart.filter((ci) => ci.menuItem.stock_quantity !== null).map((ci) =>
          supabase.from("menu_items").update({ stock_quantity: Math.max(0, (ci.menuItem.stock_quantity as number) - ci.quantity) }).eq("id", ci.menuItem.id)
        )
      );

      clearCart();
      setSelectedTable(null);
      setOrderNotes("");
      setDiscountPercent(0);
      setShowDiscount(false);
      setShowCart(false);
      fetchData();
      setPaymentOrder({
        order: { ...order, cafe: { name: cafeData?.name || "Cafe POS" }, table: tables.find((t) => t.id === selectedTable) || null },
        items: orderItemsRef.current,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setPlacingOrder(false);
    }
  }, [cart, orderType, selectedTable, getCartTotal, taxRate, discountPercent, cafeId, profile?.id, orderNotes, supabase, clearCart, fetchData, tables]);

  const handlePrint = useCallback(() => {
    if (!successOrder) return;
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) { toast.error("Pop-up blocked. Please allow pop-ups to print."); return; }
    const order = successOrder.data;
    const itemsHtml = (orderItemsRef.current.length > 0 ? orderItemsRef.current : [])
      .map((ci: any) => `<tr><td style="padding:4px 0">${ci.quantity}x ${ci.menu_item?.name || "Item"}</td><td style="text-align:right;padding:4px 0">₹${(ci.unit_price * ci.quantity || ci.subtotal).toFixed(0)}</td></tr>`)
      .join("");
    win.document.write(`<html><head><meta charset="utf-8"><title>Receipt</title><style>body{font-family:monospace;font-size:13px;max-width:300px;margin:0 auto;padding:20px;color:#111}.center{text-align:center}.divider{border-top:1px dashed #aaa;margin:10px 0}table{width:100%;border-collapse:collapse}.total{font-size:18px;font-weight:bold}</style></head><body><div class="center"><p style="font-size:18px;font-weight:bold">CAFE POS</p><p style="font-size:11px">Order #${order.id.slice(0, 8)}</p></div><div class="divider"></div><table style="font-size:12px">${itemsHtml}</table><div class="divider"></div><table style="font-size:12px"><tr><td>Subtotal</td><td style="text-align:right">₹${Number(order.subtotal).toFixed(2)}</td></tr><tr><td>Tax</td><td style="text-align:right">₹${Number(order.tax).toFixed(2)}</td></tr></table><div class="divider"></div><div class="center"><p class="total">TOTAL: ₹${Number(order.total).toFixed(2)}</p></div><div class="divider"></div><div class="center" style="font-size:11px;margin-top:14px"><p>Thank you!</p></div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }, [successOrder]);

  const handlePaymentComplete = useCallback((payment: any) => {
    setPaymentOrder(null);
    supabase.from("orders").select("*, payments(*)").eq("id", payment.order_id).single().then(({ data }) => {
      if (data) setSuccessOrder({ id: data.id, data });
    });
  }, [supabase]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if (e.key === "F1" || e.key === "F2" || e.key === "F10" || e.key === "Escape") e.preventDefault();
      if (e.key === "F1") { searchRef.current?.focus(); searchRef.current?.select(); }
      else if (e.key === "F2") setShowCart((prev) => !prev);
      else if (e.key === "F10") handlePlaceOrder();
      else if (e.key === "Escape") { if (showCart) setShowCart(false); else if (search) { setSearch(""); searchRef.current?.focus(); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showCart, search, handlePlaceOrder]);

  const cartCount = useMemo(() => cart.reduce((s, ci) => s + ci.quantity, 0), [cart]);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-40 rounded-lg bg-muted/40 animate-pulse" />
            <div className="flex-1 h-11 rounded-lg bg-muted/40 animate-pulse" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 w-20 rounded-full bg-muted/40 animate-pulse shrink-0" />)}
          </div>
          <SkeletonGrid />
        </div>
        <div className="hidden lg:block lg:w-96 glass-card rounded-xl p-4 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      <div className="flex-1 flex flex-col space-y-3 min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
          <div className="shrink-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">POS</h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Take orders and process payments</p>
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items... (Ctrl+K)"
              className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl bg-muted/60 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm transition-all" />
            {search && <button onClick={() => { setSearch(""); searchRef.current?.focus(); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted min-h-[28px] min-w-[28px] flex items-center justify-center"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>}
          </div>
          <button onClick={() => setQuickAdd(!quickAdd)}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold transition-all ${quickAdd ? "bg-chart-4/20 text-chart-4 border border-chart-4/30 neon-glow" : "bg-muted/60 text-muted-foreground border border-border"}`}>
            <Zap className="w-3.5 h-3.5" /> Quick
          </button>
          <div className="flex gap-1.5">
            <select value={orderType} onChange={(e) => setOrderType(e.target.value as any)}
              className="px-3 py-2 min-h-[44px] rounded-xl bg-muted/60 border border-border text-sm outline-none focus:border-primary">
              <option value="dine_in">Dine In</option>
              <option value="takeaway">Takeaway</option>
            </select>
            {orderType === "dine_in" && (
              <select value={selectedTable || ""} onChange={(e) => setSelectedTable(e.target.value || null)}
                className="px-3 py-2 min-h-[44px] rounded-xl bg-muted/60 border border-border text-sm outline-none focus:border-primary max-w-[120px] sm:max-w-none">
                <option value="">Table</option>
                {tables.map((t) => <option key={t.id} value={t.id}>{t.table_number}</option>)}
              </select>
            )}
          </div>
          {newOrderCount > 0 && (
            <button onClick={() => setNewOrderCount(0)} className="relative flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-chart-5/20 text-chart-5 border border-chart-5/30 text-xs font-bold animate-pulse">
              <Bell className="w-3.5 h-3.5" /> {newOrderCount} new
            </button>
          )}
          <button onClick={() => setShowCart(!showCart)} className="lg:hidden relative neon-glow flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]">
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-chart-4 text-black text-[10px] font-bold flex items-center justify-center animate-cart-pop">{cartCount}</span>}
          </button>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Cafe:</span>
            <select value={selectedCafeId || ""} onChange={(e) => setSelectedCafeId(e.target.value)} className="px-3 py-1.5 rounded-lg bg-muted/60 border border-border text-xs outline-none">
              {cafes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 shrink-0 scrollbar-none">
          <button onClick={() => setSelectedCategory(null)} className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${!selectedCategory ? "bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10" : "bg-muted/60 text-muted-foreground border border-border hover:border-primary/30"}`}>All</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all min-h-[38px] ${selectedCategory === cat.id ? "bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10" : "bg-muted/60 text-muted-foreground border border-border hover:border-primary/30"}`}>{cat.name}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredItems.map((item) => {
              const inStock = item.stock_quantity === null || item.stock_quantity > 0;
              const isLow = item.stock_quantity !== null && item.stock_quantity <= item.low_stock_threshold && item.stock_quantity > 0;
              const justAdded = recentlyAdded.has(item.id);
              const soldOut = !inStock || (!item.is_available && item.stock_quantity !== null && item.stock_quantity <= 0);
              return (
                <button key={item.id} onClick={() => inStock && item.is_available && handleAddToCart(item)} disabled={!inStock || !item.is_available}
                  className={`group glass-card rounded-xl p-2 sm:p-3 text-left transition-all duration-200 min-h-[44px] relative overflow-hidden ${justAdded ? "border-primary/60 shadow-lg shadow-primary/15 ring-1 ring-primary/30" : ""} ${inStock && item.is_available ? "hover:border-primary/40 active:scale-[0.97] cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                  {soldOut && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 rounded-xl"><span className="text-xs font-black tracking-widest text-destructive/80 rotate-[-15deg] text-lg">SOLD OUT</span></div>}
                  {item.image_url ? (
                    <div className="h-24 sm:h-[120px] rounded-lg overflow-hidden mb-2 bg-muted/40">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    </div>
                  ) : (
                    <div className="h-24 sm:h-[120px] rounded-lg overflow-hidden mb-2 bg-muted/30 flex items-center justify-center">
                      <Hash className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold truncate">{item.name}</p>
                      <p className="text-primary font-bold text-sm sm:text-lg mt-0.5">₹{Number(item.price).toFixed(0)}</p>
                    </div>
                    {isLow && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-chart-5/20 text-chart-5 border border-chart-5/30">{item.stock_quantity}</span>}
                    {!item.is_available && inStock && <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/20">NA</span>}
                  </div>
                  {justAdded && <div className="absolute inset-0 rounded-xl ring-2 ring-primary/40 animate-glow-pulse pointer-events-none" />}
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-16 space-y-2">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground text-sm">No items found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-[28%] xl:w-[30%] glass-card rounded-xl flex-col shrink-0 overflow-hidden">
        <CartContent cart={cart} cartCount={cartCount} getCartTotal={getCartTotal} updateQuantity={updateQuantity} removeFromCart={removeFromCart} clearCart={clearCart} placingOrder={placingOrder} onPlaceOrder={handlePlaceOrder} orderNotes={orderNotes} setOrderNotes={setOrderNotes} taxRate={taxRate} setTaxRate={setTaxRate} showTaxInput={showTaxInput} setShowTaxInput={setShowTaxInput} discountPercent={discountPercent} setDiscountPercent={setDiscountPercent} showDiscount={showDiscount} setShowDiscount={setShowDiscount} />
      </div>

      {showCart && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden" onClick={() => setShowCart(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden glass-card rounded-t-2xl max-h-[82vh] flex flex-col safe-bottom animate-slide-in-up">
            <div className="flex items-center justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-muted-foreground/30" /></div>
            <div className="px-4 pb-4 flex-1 overflow-y-auto">
              <CartContent cart={cart} cartCount={cartCount} getCartTotal={getCartTotal} updateQuantity={updateQuantity} removeFromCart={removeFromCart} clearCart={clearCart} placingOrder={placingOrder} onPlaceOrder={handlePlaceOrder} orderNotes={orderNotes} setOrderNotes={setOrderNotes} taxRate={taxRate} setTaxRate={setTaxRate} showTaxInput={showTaxInput} setShowTaxInput={setShowTaxInput} discountPercent={discountPercent} setDiscountPercent={setDiscountPercent} showDiscount={showDiscount} setShowDiscount={setShowDiscount} onClose={() => setShowCart(false)} />
            </div>
          </div>
        </>
      )}

      {paymentOrder && <PaymentModal order={paymentOrder.order} orderItems={paymentOrder.items} cafeName={paymentOrder.order.cafe?.name} onClose={() => setPaymentOrder(null)} onPaymentComplete={handlePaymentComplete} />}
      {successOrder && <SuccessOverlay orderId={successOrder.id} onPrint={handlePrint} onClose={() => setSuccessOrder(null)} />}

      <button onClick={() => { clearCart(); setSelectedTable(null); setOrderNotes(""); setSearch(""); setSelectedCategory(null); toast.success("Ready for new order"); }}
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 neon-glow flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all min-h-[48px]">
        <PlusCircle className="w-5 h-5" /> New Order
      </button>
    </div>
  );
}

function CartContent({ cart, cartCount, getCartTotal, updateQuantity, removeFromCart, clearCart, placingOrder, onPlaceOrder, orderNotes, setOrderNotes, taxRate, setTaxRate, showTaxInput, setShowTaxInput, discountPercent, setDiscountPercent, showDiscount, setShowDiscount, onClose }: {
  cart: any[]; cartCount: number; getCartTotal: () => number; updateQuantity: (id: string, qty: number) => void; removeFromCart: (id: string) => void; clearCart: () => void; placingOrder: boolean; onPlaceOrder: () => void;
  orderNotes: string; setOrderNotes: (n: string) => void; taxRate: number; setTaxRate: (r: number) => void; showTaxInput: boolean; setShowTaxInput: (s: boolean) => void; discountPercent: number; setDiscountPercent: (d: number) => void; showDiscount: boolean; setShowDiscount: (s: boolean) => void; onClose?: () => void;
}) {
  const subtotal = getCartTotal();
  const discountAmount = subtotal * (discountPercent / 100);
  const tax = subtotal * taxRate;
  const total = subtotal - discountAmount + tax;

  return (
    <>
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Current Order</h2>
          {cartCount > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-bold">{cartCount}</span>}
        </div>
        <div className="flex items-center gap-1">
          {cart.length > 0 && <button onClick={clearCart} className="text-xs text-destructive hover:underline min-h-[36px] px-2 flex items-center">Clear</button>}
          {onClose && <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted min-h-[36px] min-w-[36px] flex items-center justify-center"><ChevronDown className="w-4 h-4 text-muted-foreground" /></button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {cart.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <ShoppingCart className="w-10 h-10 text-muted-foreground/20 mx-auto" />
            <p className="text-muted-foreground text-sm">Cart is empty</p>
            <p className="text-muted-foreground/50 text-xs">Tap items to add</p>
          </div>
        ) : (
          cart.map((ci) => (
            <div key={ci.menuItem.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{ci.menuItem.name}</p>
                <p className="text-xs text-muted-foreground">₹{Number(ci.menuItem.price).toFixed(0)} each</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => updateQuantity(ci.menuItem.id, ci.quantity - 1)} className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"><Minus className="w-4 h-4" /></button>
                <span className="text-sm font-bold w-7 text-center tabular-nums">{ci.quantity}</span>
                <button onClick={() => updateQuantity(ci.menuItem.id, ci.quantity + 1)} className="p-1.5 rounded-lg bg-muted/60 hover:bg-muted border border-border min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
              <div className="text-right shrink-0 min-w-[60px]">
                <p className="text-sm font-bold tabular-nums">₹{(ci.menuItem.price * ci.quantity).toFixed(0)}</p>
                <button onClick={() => removeFromCart(ci.menuItem.id)} className="text-xs text-destructive/70 hover:text-destructive mt-0.5 min-h-[28px] flex items-center justify-end w-full"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {cart.length > 0 && (
        <div className="mt-3 shrink-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <NotebookPen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Order Note</span>
          </div>
          <input value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Add a note..." className="w-full px-3 py-2.5 min-h-[42px] rounded-xl bg-muted/40 border border-border text-sm outline-none focus:border-primary/50 transition-colors" />
        </div>
      )}

      <div className="border-t border-border pt-3 mt-3 space-y-1.5 shrink-0">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">₹{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm items-center">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Tax</span>
            <button onClick={() => setShowTaxInput(!showTaxInput)} className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground px-1">{(taxRate * 100).toFixed(0)}%</button>
          </div>
          {showTaxInput ? (
            <div className="flex items-center gap-1">
              <input type="number" value={Math.round(taxRate * 100)} onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 100) setTaxRate(v / 100); }} className="w-14 px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-right outline-none" min={0} max={100} />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          ) : (
            <span className="font-medium tabular-nums">₹{tax.toFixed(2)}</span>
          )}
        </div>
        {discountPercent > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-chart-4">Discount ({discountPercent}%)</span>
            <span className="text-chart-4">-₹{discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <button onClick={() => setShowDiscount(!showDiscount)} className="text-xs text-primary hover:underline">
            {discountPercent > 0 ? `Discount: ${discountPercent}%` : "Add Discount"}
          </button>
          {showDiscount && (
            <div className="flex items-center gap-1">
              <input type="number" value={discountPercent} onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= 100) setDiscountPercent(v); }} className="w-14 px-2 py-0.5 rounded bg-muted/60 border border-border text-xs text-right outline-none" min={0} max={100} placeholder="%" />
              <span className="text-xs text-muted-foreground">%</span>
              <button onClick={() => setShowDiscount(false)} className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25">Apply</button>
              {discountPercent > 0 && <button onClick={() => { setDiscountPercent(0); setShowDiscount(false); }} className="px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground">X</button>}
            </div>
          )}
        </div>
        <div className="flex justify-between items-baseline pt-2 border-t border-border/50">
          <span className="text-base font-bold">Total</span>
          <span className="text-xl font-black text-primary tabular-nums neon-text">₹{total.toFixed(2)}</span>
        </div>

        <button onClick={onPlaceOrder} disabled={cart.length === 0 || placingOrder}
          className="neon-glow w-full py-3.5 min-h-[52px] rounded-xl bg-primary text-primary-foreground font-extrabold text-sm hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 tracking-wide">
          {placingOrder && <Loader2 className="w-5 h-5 animate-spin" />}
          {placingOrder ? "PLACING..." : "PLACE ORDER"}
        </button>
        <p className="text-[10px] text-muted-foreground/40 text-center">F10 to place · Esc to close</p>
      </div>
    </>
  );
}