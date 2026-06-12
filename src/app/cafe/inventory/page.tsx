"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { MenuItem } from "@/types/database";
import {
  Loader2,
  Package,
  AlertTriangle,
  CheckCircle,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

export default function InventoryPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<Record<string, number>>({});
  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from("cafes")
        .select("id, name")
        .eq("is_active", true)
        .then(({ data }) => {
          if (data) {
            setCafes(data);
            if (data.length > 0) setSelectedCafeId(data[0].id);
          }
        });
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!cafeId) return;
    const fetchItems = async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("cafe_id", cafeId)
        .not("stock_quantity", "is", null)
        .order("name");
      if (data) {
        setItems(data);
        const initial: Record<string, number> = {};
        data.forEach((i) => {
          initial[i.id] = i.stock_quantity!;
        });
        setEditingStock(initial);
      }
      setLoading(false);
    };
    fetchItems();
  }, [cafeId]);

  const handleUpdateStock = async (itemId: string) => {
    const newQty = editingStock[itemId] ?? 0;
    const { error } = await supabase
      .from("menu_items")
      .update({ stock_quantity: newQty })
      .eq("id", itemId);
    if (error) toast.error(error.message);
    else {
      toast.success("Stock updated");
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, stock_quantity: newQty } : i
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const lowStock = items.filter(
    (i) =>
      i.stock_quantity !== null &&
      i.stock_quantity <= i.low_stock_threshold
  );
  const outOfStock = items.filter(
    (i) => i.stock_quantity !== null && i.stock_quantity === 0
  );
  const okStock = items.filter(
    (i) =>
      i.stock_quantity !== null &&
      i.stock_quantity > i.low_stock_threshold
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Inventory
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track and update item stock levels
        </p>
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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-destructive/15">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">
                {outOfStock.length}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-chart-5/15">
              <Package className="w-5 h-5 text-chart-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Low Stock</p>
              <p className="text-xl sm:text-2xl font-bold text-chart-5">
                {lowStock.length}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 rounded-lg bg-chart-4/15">
              <CheckCircle className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Well Stocked</p>
              <p className="text-xl sm:text-2xl font-bold text-chart-4">
                {okStock.length}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="space-y-4">
        {outOfStock.length > 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-destructive mb-3">
              Out of Stock
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {outOfStock.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  stock={editingStock[item.id] ?? 0}
                  onChange={(v) =>
                    setEditingStock((p) => ({ ...p, [item.id]: v }))
                  }
                  onSave={handleUpdateStock}
                  urgent
                />
              ))}
            </div>
          </div>
        )}

        {lowStock.length > 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-chart-5 mb-3">
              Low Stock
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lowStock.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  stock={editingStock[item.id] ?? 0}
                  onChange={(v) =>
                    setEditingStock((p) => ({ ...p, [item.id]: v }))
                  }
                  onSave={handleUpdateStock}
                />
              ))}
            </div>
          </div>
        )}

        {okStock.length > 0 && (
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3">
              In Stock
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {okStock.map((item) => (
                <StockCard
                  key={item.id}
                  item={item}
                  stock={editingStock[item.id] ?? 0}
                  onChange={(v) =>
                    setEditingStock((p) => ({ ...p, [item.id]: v }))
                  }
                  onSave={handleUpdateStock}
                />
              ))}
            </div>
          </div>
        )}

        {items.length === 0 && (
          <p className="text-muted-foreground text-center py-8 text-sm">
            No inventory-tracked items. Set stock quantity on menu items to
            enable tracking.
          </p>
        )}
      </div>
    </div>
  );
}

function StockCard({
  item,
  stock,
  onChange,
  onSave,
  urgent,
}: {
  item: MenuItem;
  stock: number;
  onChange: (v: number) => void;
  onSave: (id: string) => void;
  urgent?: boolean;
}) {
  return (
    <GlassCard
      className={`p-3 sm:p-4 ${urgent ? "border-destructive/30" : ""}`}
    >
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm truncate">{item.name}</h4>
          <p className="text-xs text-muted-foreground">
            Alert at {item.low_stock_threshold} units
          </p>
        </div>
        <Badge
          variant={
            stock === 0
              ? "destructive"
              : stock <= item.low_stock_threshold
                ? "warning"
                : "success"
          }
          className="shrink-0"
        >
          {stock === 0
            ? "Out"
            : stock <= item.low_stock_threshold
              ? "Low"
              : "OK"}
        </Badge>
      </div>
      <div className="flex items-start gap-2 flex-col sm:flex-row sm:items-center">
        <input
          type="number"
          min={0}
          value={stock}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          className="w-full sm:w-24 px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm text-center min-h-[44px]"
        />
        <button
          onClick={() => onSave(item.id)}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors min-h-[44px] w-full sm:w-auto justify-center sm:justify-start"
        >
          <Save className="w-3.5 h-3.5" /> Update
        </button>
      </div>
    </GlassCard>
  );
}
