"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { MenuCategory, MenuItem } from "@/types/database";
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Save,
  X,
  GripVertical,
} from "lucide-react";
import toast from "react-hot-toast";

export default function MenuManagement() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{id:string, name:string}[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<Partial<MenuCategory> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const supabase = createClient();
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.from("cafes").select("id, name").eq("is_active", true).then(({data}) => {
        if (data) { setCafes(data); if (data.length > 0) setSelectedCafeId(data[0].id); }
      });
    }
  }, [isSuperAdmin]);

  const fetchData = async () => {
    if (!cafeId) return;
    const [catRes, itemRes] = await Promise.all([
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
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (itemRes.data) setItems(itemRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveCategory = async () => {
    if (!editingCat?.name) return;
    try {
      if (editingCat.id) {
        await supabase
          .from("menu_categories")
          .update({ name: editingCat.name })
          .eq("id", editingCat.id);
      } else {
        await supabase.from("menu_categories").insert({
          cafe_id: cafeId,
          name: editingCat.name,
          display_order: categories.length,
        });
      }
      toast.success("Category saved");
      setEditingCat(null);
      setShowAddCat(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete category and all items in it?")) return;
    await supabase.from("menu_categories").delete().eq("id", id);
    toast.success("Category deleted");
    fetchData();
  };

  const handleSaveItem = async () => {
    if (!editingItem?.name || !editingItem?.category_id) {
      toast.error("Name and category required");
      return;
    }
    try {
      if (editingItem.id) {
        await supabase
          .from("menu_items")
          .update({
            name: editingItem.name,
            description: editingItem.description || null,
            price: editingItem.price || 0,
            category_id: editingItem.category_id,
            image_url: editingItem.image_url || null,
            is_available: editingItem.is_available ?? true,
            stock_quantity: editingItem.stock_quantity ?? null,
            low_stock_threshold: editingItem.low_stock_threshold ?? 5,
          })
          .eq("id", editingItem.id);
      } else {
        await supabase.from("menu_items").insert({
          cafe_id: cafeId,
          category_id: editingItem.category_id,
          name: editingItem.name,
          description: editingItem.description || null,
          price: editingItem.price || 0,
          image_url: editingItem.image_url || null,
          stock_quantity: editingItem.stock_quantity ?? null,
          low_stock_threshold: editingItem.low_stock_threshold ?? 5,
        });
      }
      toast.success("Item saved");
      setEditingItem(null);
      setShowAddItem(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    toast.success("Item deleted");
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage categories, items, prices, and stock
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowAddCat(true);
              setEditingCat({ name: "" });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" /> Category
          </button>
          <button
            onClick={() => {
              setShowAddItem(true);
              setEditingItem({
                name: "",
                price: 0,
                category_id: categories[0]?.id || "",
              });
            }}
            className="neon-glow flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
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

      {(showAddCat || editingCat) && (
        <GlassCard>
          <h3 className="font-semibold mb-3">
            {editingCat?.id ? "Edit Category" : "New Category"}
          </h3>
          <div className="flex gap-2">
            <input
              value={editingCat?.name || ""}
              onChange={(e) =>
                setEditingCat((f) => ({ ...f, name: e.target.value }))
              }
              className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
              placeholder="Category name"
            />
            <button
              onClick={handleSaveCategory}
              className="p-2 rounded-lg bg-primary text-primary-foreground"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingCat(null);
                setShowAddCat(false);
              }}
              className="p-2 rounded-lg border border-border"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </GlassCard>
      )}

      {(showAddItem || editingItem) && (
        <GlassCard>
          <h3 className="font-semibold mb-4">
            {editingItem?.id ? "Edit Item" : "New Item"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Name *
              </label>
              <input
                value={editingItem?.name || ""}
                onChange={(e) =>
                  setEditingItem((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Category *
              </label>
              <select
                value={editingItem?.category_id || ""}
                onChange={(e) =>
                  setEditingItem((f) => ({ ...f, category_id: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={editingItem?.price || 0}
                onChange={(e) =>
                  setEditingItem((f) => ({
                    ...f,
                    price: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Image URL
              </label>
              <input
                value={editingItem?.image_url || ""}
                onChange={(e) =>
                  setEditingItem((f) => ({ ...f, image_url: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Stock Qty (empty = unlimited)
              </label>
              <input
                type="number"
                min={0}
                value={editingItem?.stock_quantity ?? ""}
                onChange={(e) =>
                  setEditingItem((f) => ({
                    ...f,
                    stock_quantity:
                      e.target.value === "" ? null : parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Low Stock Threshold
              </label>
              <input
                type="number"
                min={1}
                value={editingItem?.low_stock_threshold ?? 5}
                onChange={(e) =>
                  setEditingItem((f) => ({
                    ...f,
                    low_stock_threshold: parseInt(e.target.value) || 5,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                value={editingItem?.description || ""}
                onChange={(e) =>
                  setEditingItem((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editingItem?.is_available ?? true}
                  onChange={(e) =>
                    setEditingItem((f) => ({
                      ...f,
                      is_available: e.target.checked,
                    }))
                  }
                  className="rounded"
                />
                Available for ordering
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveItem}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              {editingItem?.id ? "Update" : "Create"}
            </button>
            <button
              onClick={() => {
                setEditingItem(null);
                setShowAddItem(false);
              }}
              className="px-4 py-2 rounded-lg border border-border text-sm"
            >
              Cancel
            </button>
          </div>
        </GlassCard>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        return (
          <div key={cat.id}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold">{cat.name}</h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setEditingCat({ id: cat.id, name: cat.name })}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                >
                  <Edit3 className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-1.5 rounded hover:bg-destructive/15 transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {catItems.map((item) => (
                <GlassCard key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    {item.image_url && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm truncate">
                          {item.name}
                        </h4>
                        <div className="flex gap-0.5 shrink-0">
                          <button
                            onClick={() =>
                              setEditingItem({
                                id: item.id,
                                name: item.name,
                                description: item.description,
                                price: Number(item.price),
                                category_id: item.category_id,
                                image_url: item.image_url,
                                is_available: item.is_available,
                                stock_quantity: item.stock_quantity,
                                low_stock_threshold: item.low_stock_threshold,
                              })
                            }
                            className="p-1 rounded hover:bg-muted"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded hover:bg-destructive/15"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                      <p className="text-primary font-bold text-sm">
                        ₹{Number(item.price).toFixed(0)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {!item.is_available && (
                          <Badge variant="destructive">Off</Badge>
                        )}
                        {item.stock_quantity !== null && (
                          <Badge
                            variant={
                              item.stock_quantity <= item.low_stock_threshold
                                ? "warning"
                                : "default"
                            }
                          >
                            Stock: {item.stock_quantity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {catItems.length === 0 && (
                <p className="text-muted-foreground text-sm py-4 col-span-full">
                  No items in this category
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
