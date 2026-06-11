"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Search,
  ChevronUp,
  ChevronDown,
  Copy,
  Download,
  Coffee,
  PackageOpen,
  EyeOff,
  Eye,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  PanelLeftClose,
  PanelLeft,
  SlidersHorizontal,
  AlertTriangle,
  PlusCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type SortMode = "name" | "price-asc" | "price-desc" | "newest" | "popular";

export default function MenuManagement() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  const [editingCategory, setEditingCategory] = useState<Partial<MenuCategory> | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<MenuCategory | null>(null);

  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [saveAndAddAnother, setSaveAndAddAnother] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<MenuItem | null>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkCategoryTarget, setBulkCategoryTarget] = useState<string>("");

  const itemModalRef = useRef<HTMLDivElement>(null);
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

  const fetchData = useCallback(async () => {
    if (!cafeId) return;
    setLoading(true);
    const [catRes, itemRes] = await Promise.all([
      supabase.from("menu_categories").select("*").eq("cafe_id", cafeId).order("display_order"),
      supabase.from("menu_items").select("*").eq("cafe_id", cafeId).order("display_order"),
    ]);
    if (catRes.data) {
      setCategories(catRes.data);
      if (catRes.data.length > 0 && !selectedCategory) {
        setSelectedCategory(catRes.data[0].id);
      }
    }
    if (itemRes.data) setItems(itemRes.data);
    setLoading(false);
  }, [cafeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((i) => {
      counts[i.category_id] = (counts[i.category_id] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (selectedCategory) {
      filtered = filtered.filter((i) => i.category_id === selectedCategory);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((i) => i.name.toLowerCase().includes(q));
    }
    switch (sortMode) {
      case "price-asc":
        filtered = [...filtered].sort((a, b) => Number(a.price) - Number(b.price));
        break;
      case "price-desc":
        filtered = [...filtered].sort((a, b) => Number(b.price) - Number(a.price));
        break;
      case "newest":
        filtered = [...filtered].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "popular":
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        filtered = [...filtered].sort((a, b) => a.display_order - b.display_order);
    }
    return filtered;
  }, [items, selectedCategory, searchQuery, sortMode]);

  const hasSelection = selectedItems.size > 0;
  const allFilteredSelected =
    filteredItems.length > 0 && filteredItems.every((i) => selectedItems.has(i.id));

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const clearSelection = () => setSelectedItems(new Set());

  // --- Category CRUD ---

  const handleSaveCategory = async () => {
    if (!editingCategory?.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setWorking(true);
    try {
      if (editingCategory.id) {
        await supabase
          .from("menu_categories")
          .update({ name: editingCategory.name.trim() })
          .eq("id", editingCategory.id);
        toast.success("Category updated");
      } else {
        await supabase.from("menu_categories").insert({
          cafe_id: cafeId,
          name: editingCategory.name.trim(),
          display_order: categories.length,
        });
        toast.success("Category created");
      }
      setEditingCategory(null);
      setShowAddCategory(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setWorking(true);
    try {
      await supabase.from("menu_categories").delete().eq("id", deleteCategoryTarget.id);
      toast.success("Category deleted");
      setDeleteCategoryTarget(null);
      if (selectedCategory === deleteCategoryTarget.id) setSelectedCategory(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const moveCategory = async (cat: MenuCategory, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === cat.id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === categories.length - 1) return;
    const other = categories[direction === "up" ? idx - 1 : idx + 1];
    setWorking(true);
    try {
      await Promise.all([
        supabase.from("menu_categories").update({ display_order: other.display_order }).eq("id", cat.id),
        supabase.from("menu_categories").update({ display_order: cat.display_order }).eq("id", other.id),
      ]);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  // --- Item CRUD ---

  const handleSaveItem = async () => {
    if (!editingItem?.name?.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (!editingItem?.category_id) {
      toast.error("Category is required");
      return;
    }
    if (Number(editingItem.price) <= 0) {
      toast.error("Price must be greater than 0");
      return;
    }
    setWorking(true);
    try {
      const payload = {
        name: editingItem.name.trim(),
        description: editingItem.description || null,
        price: Number(editingItem.price) || 0,
        category_id: editingItem.category_id,
        image_url: editingItem.image_url || null,
        is_available: editingItem.is_available ?? true,
        stock_quantity: editingItem.stock_quantity ?? null,
        low_stock_threshold: editingItem.low_stock_threshold ?? 5,
      };

      if (editingItem.id) {
        await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
        toast.success("Item updated");
      } else {
        await supabase.from("menu_items").insert({ ...payload, cafe_id: cafeId });
        toast.success("Item created");
      }

      if (saveAndAddAnother && !editingItem.id) {
        setEditingItem({
          name: "",
          price: 0,
          category_id: editingItem.category_id,
        });
        toast("Ready for next item", { icon: "➕" });
      } else {
        setEditingItem(null);
        setShowItemModal(false);
      }
      setSaveAndAddAnother(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    setWorking(true);
    try {
      await supabase.from("menu_items").delete().eq("id", deleteItemTarget.id);
      toast.success("Item deleted");
      setDeleteItemTarget(null);
      setSelectedItems((prev) => {
        const next = new Set(prev);
        next.delete(deleteItemTarget.id);
        return next;
      });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleDuplicateItem = async (item: MenuItem) => {
    setWorking(true);
    try {
      const maxOrder = Math.max(0, ...items.filter((i) => i.category_id === item.category_id).map((i) => i.display_order));
      await supabase.from("menu_items").insert({
        cafe_id: cafeId,
        category_id: item.category_id,
        name: `${item.name} (copy)`,
        description: item.description,
        price: item.price,
        image_url: item.image_url,
        is_available: item.is_available,
        stock_quantity: item.stock_quantity,
        low_stock_threshold: item.low_stock_threshold,
        display_order: maxOrder + 1,
      });
      toast.success("Item duplicated");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const toggleItemAvailable = async (item: MenuItem) => {
    try {
      await supabase
        .from("menu_items")
        .update({ is_available: !item.is_available })
        .eq("id", item.id);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const moveItem = async (item: MenuItem, direction: "up" | "down") => {
    const catItems = items.filter((i) => i.category_id === item.category_id).sort((a, b) => a.display_order - b.display_order);
    const idx = catItems.findIndex((i) => i.id === item.id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === catItems.length - 1) return;
    const other = catItems[direction === "up" ? idx - 1 : idx + 1];
    try {
      await Promise.all([
        supabase.from("menu_items").update({ display_order: other.display_order }).eq("id", item.id),
        supabase.from("menu_items").update({ display_order: item.display_order }).eq("id", other.id),
      ]);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- Bulk operations ---

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.size} selected item(s)?`)) return;
    setWorking(true);
    try {
      await supabase.from("menu_items").delete().in("id", Array.from(selectedItems));
      toast.success(`Deleted ${selectedItems.size} items`);
      clearSelection();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const bulkToggleAvailable = async (available: boolean) => {
    setWorking(true);
    try {
      await supabase
        .from("menu_items")
        .update({ is_available: available })
        .in("id", Array.from(selectedItems));
      toast.success(`${selectedItems.size} items ${available ? "enabled" : "disabled"}`);
      clearSelection();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  const bulkMoveCategory = async () => {
    if (!bulkCategoryTarget) return;
    setWorking(true);
    try {
      await supabase
        .from("menu_items")
        .update({ category_id: bulkCategoryTarget })
        .in("id", Array.from(selectedItems));
      toast.success(`Moved ${selectedItems.size} items`);
      clearSelection();
      setBulkCategoryTarget("");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  };

  // --- CSV Export ---

  const exportCSV = () => {
    const headers = ["Name", "Category", "Price", "Available", "Stock", "Low Stock Threshold", "Description"];
    const rows = items.map((i) => [
      i.name,
      categories.find((c) => c.id === i.category_id)?.name || "",
      Number(i.price).toFixed(2),
      i.is_available ? "Yes" : "No",
      i.stock_quantity ?? "Unlimited",
      i.low_stock_threshold,
      (i.description || "").replace(/,/g, " "),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "menu-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  // --- Helpers ---

  const getCategoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Unknown";

  const stockVariant = (item: MenuItem): "success" | "warning" | "destructive" | "default" => {
    if (item.stock_quantity === null) return "default";
    if (item.stock_quantity <= 0) return "destructive";
    if (item.stock_quantity <= item.low_stock_threshold) return "warning";
    return "success";
  };

  const startEditItem = (item?: MenuItem) => {
    if (item) {
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
      });
    } else {
      setEditingItem({ name: "", price: 0, category_id: selectedCategory || categories[0]?.id || "" });
    }
    setShowItemModal(true);
    setSaveAndAddAnother(false);
  };

  // --- Render: Loading skeleton ---

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="h-8 w-56 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded mt-2 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 bg-muted rounded-lg animate-pulse" />
            <div className="h-10 w-28 bg-muted rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="flex gap-6">
          <div className="hidden lg:block w-56 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <GlassCard key={i} className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-muted rounded-lg animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                    <div className="flex gap-2">
                      <div className="h-5 w-14 bg-muted rounded animate-pulse" />
                      <div className="h-5 w-12 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Render: Empty state ---

  if (categories.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight neon-text">Menu Management</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage categories, items, prices, and stock</p>
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
        <GlassCard className="p-10 sm:p-16 flex flex-col items-center text-center">
          {showAddCategory ? (
            <div className="w-full max-w-sm">
              <h2 className="text-lg font-bold mb-4">Create your first category</h2>
              <div className="flex gap-2">
                <input
                  value={editingCategory?.name || ""}
                  onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                  placeholder="e.g. Beverages, Snacks, Meals"
                  autoFocus
                />
                <button
                  onClick={handleSaveCategory}
                  disabled={working}
                  className="neon-glow px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setShowAddCategory(false); setEditingCategory(null); }}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm min-h-[44px]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Coffee className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">No categories yet</h2>
              <p className="text-muted-foreground text-sm max-w-sm mb-6">
                Create your first category to start organizing your menu items. Categories like "Beverages", "Snacks", or "Meals".
              </p>
              <button
                onClick={() => {
                  setShowAddCategory(true);
                  setEditingCategory({ name: "" });
                }}
                className="neon-glow flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]"
              >
                <Plus className="w-4 h-4" /> Create First Category
              </button>
            </>
          )}
        </GlassCard>
      </div>
    );
  }

  // --- Render: Main ---

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight neon-text">Menu Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {items.length} items across {categories.length} categories
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              setShowAddCategory(true);
              setEditingCategory({ name: "" });
            }}
            className="neon-glow flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
          <button
            onClick={() => startEditItem()}
            className="neon-glow flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Cafe selector for super admins */}
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

      {/* Toolbar */}
      <GlassCard className="p-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
          />
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="px-3 py-2.5 rounded-lg bg-muted border border-border text-sm outline-none min-h-[44px]"
          >
            <option value="name">Default order</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest first</option>
            <option value="popular">Popular</option>
          </select>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm hover:bg-muted min-h-[44px] whitespace-nowrap"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            className="lg:hidden p-2.5 rounded-lg border border-border hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {showMobileSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-2.5 rounded-lg border border-border hover:bg-muted min-h-[44px] min-w-[44px] items-center justify-center"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </button>
        </div>
      </GlassCard>

      <div className="flex gap-0 lg:gap-6">
        {/* Category Sidebar */}
        <div
          className={`${
            showMobileSidebar
              ? "fixed inset-0 z-40 lg:relative lg:inset-auto"
              : "hidden lg:block"
          } ${sidebarOpen ? "lg:w-56" : "lg:w-0 lg:overflow-hidden"}`}
        >
          {showMobileSidebar && (
            <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowMobileSidebar(false)} />
          )}
          <div
            className={`${
              showMobileSidebar
                ? "fixed left-0 top-0 bottom-0 w-64 z-50 p-4 pt-20 bg-background border-r border-border overflow-y-auto animate-slide-in-left"
                : sidebarOpen
                ? "w-56 shrink-0 space-y-1"
                : ""
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categories</h3>
              {showMobileSidebar && (
                <button onClick={() => setShowMobileSidebar(false)} className="p-1 rounded hover:bg-muted">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Add Category inline */}
            {showAddCategory && (
              <GlassCard className="p-3 mb-2">
                <div className="flex gap-1">
                  <input
                    value={editingCategory?.name || ""}
                    onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveCategory()}
                    className="flex-1 px-2 py-1.5 rounded bg-muted border border-border focus:border-primary outline-none text-sm"
                    placeholder="Category name"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveCategory}
                    disabled={working}
                    className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { setShowAddCategory(false); setEditingCategory(null); }}
                    className="p-1.5 rounded border border-border hover:bg-muted"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </GlassCard>
            )}

            {categories.map((cat, idx) => (
              <div key={cat.id} className="group">
                {editingCategory?.id === cat.id ? (
                  <GlassCard className="p-2 mb-1">
                    <div className="flex gap-1">
                      <input
                        value={editingCategory.name || ""}
                        onChange={(e) => setEditingCategory((p) => ({ ...p, name: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveCategory();
                          if (e.key === "Escape") setEditingCategory(null);
                        }}
                        className="flex-1 px-2 py-1.5 rounded bg-muted border border-border focus:border-primary outline-none text-sm"
                        autoFocus
                      />
                      <button onClick={handleSaveCategory} disabled={working} className="p-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditingCategory(null)} className="p-1.5 rounded border border-border hover:bg-muted">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlassCard>
                ) : (
                  <div
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      if (showMobileSidebar) setShowMobileSidebar(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
                      selectedCategory === cat.id
                        ? "bg-primary/15 text-primary border border-primary/30"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{cat.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{categoryItemCounts[cat.id] || 0}</span>
                    <div className="hidden group-hover:flex gap-0.5 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveCategory(cat, "up"); }}
                        disabled={idx === 0 || working}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveCategory(cat, "down"); }}
                        disabled={idx === categories.length - 1 || working}
                        className="p-1 rounded hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCategory({ id: cat.id, name: cat.name }); }}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Edit3 className="w-3 h-3 text-muted-foreground" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteCategoryTarget(cat); }}
                        className="p-1 rounded hover:bg-destructive/15"
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => {
                setShowAddCategory(true);
                setEditingCategory({ name: "" });
              }}
              className="flex items-center gap-2 w-full px-3 py-2 mt-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Bulk Actions Bar */}
          {hasSelection && (
            <GlassCard className="p-3 flex flex-wrap items-center gap-3">
              <button onClick={toggleSelectAll} className="flex items-center gap-1.5 text-sm hover:text-primary min-h-[36px]">
                {allFilteredSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                {allFilteredSelected ? "Deselect all" : "Select all"}
              </button>
              <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
              <div className="flex-1" />
              <select
                value={bulkCategoryTarget}
                onChange={(e) => setBulkCategoryTarget(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm outline-none"
              >
                <option value="">Move to category...</option>
                {categories
                  .filter((c) => c.id !== selectedCategory)
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <button
                onClick={bulkMoveCategory}
                disabled={!bulkCategoryTarget || working}
                className="px-3 py-1.5 rounded-lg bg-muted border border-border text-sm hover:bg-muted/80 disabled:opacity-50 min-h-[36px]"
              >
                Move
              </button>
              <button
                onClick={() => bulkToggleAvailable(true)}
                disabled={working}
                className="px-3 py-1.5 rounded-lg bg-chart-4/20 text-chart-4 border border-chart-4/30 text-sm hover:bg-chart-4/30 disabled:opacity-50 min-h-[36px]"
              >
                <Eye className="w-3.5 h-3.5 inline mr-1" />Enable
              </button>
              <button
                onClick={() => bulkToggleAvailable(false)}
                disabled={working}
                className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive border border-destructive/30 text-sm hover:bg-destructive/30 disabled:opacity-50 min-h-[36px]"
              >
                <EyeOff className="w-3.5 h-3.5 inline mr-1" />Disable
              </button>
              <button
                onClick={bulkDelete}
                disabled={working}
                className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive border border-destructive/30 text-sm hover:bg-destructive/30 disabled:opacity-50 min-h-[36px]"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />Delete
              </button>
              <button onClick={clearSelection} className="p-1.5 rounded hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </GlassCard>
          )}

          {/* Items Grid */}
          {filteredItems.length === 0 && !loading ? (
            <GlassCard className="p-10 sm:p-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <PackageOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">
                {searchQuery ? "No matching items" : "No items in this category"}
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs mb-5">
                {searchQuery
                  ? "Try a different search term or clear the filter."
                  : "Start adding delicious items to this category."}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => startEditItem()}
                  className="neon-glow flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]"
                >
                  <Plus className="w-4 h-4" /> Add your first item
                </button>
              )}
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {filteredItems.map((item, idx) => {
                const catIdx = items
                  .filter((i) => i.category_id === item.category_id)
                  .sort((a, b) => a.display_order - b.display_order)
                  .findIndex((i) => i.id === item.id);
                const catItemsCount = items.filter((i) => i.category_id === item.category_id).length;
                const isSelected = selectedItems.has(item.id);

                return (
                  <GlassCard
                    key={item.id}
                    neon
                    className={`p-0 overflow-hidden group/card transition-all duration-200 ${
                      isSelected ? "ring-2 ring-primary border-primary/50" : ""
                    }`}
                  >
                    {/* Selection checkbox */}
                    <div className="absolute top-2 left-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleSelectItem(item.id)}
                        className={`w-6 h-6 rounded flex items-center justify-center ${
                          isSelected ? "bg-primary text-primary-foreground" : "bg-black/50 hover:bg-black/70"
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Image / Placeholder */}
                    <div className="relative h-36 bg-muted/50 overflow-hidden">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`w-full h-full flex items-center justify-center ${item.image_url ? "hidden" : ""}`}>
                        <Coffee className="w-10 h-10 text-muted-foreground/40" />
                      </div>
                      {/* Availability badge */}
                      <div className="absolute top-2 right-2">
                        {item.is_available ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-chart-4/30 text-chart-4 border border-chart-4/40 backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-chart-4 animate-pulse" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/30 text-destructive border border-destructive/40 backdrop-blur-sm">
                            <EyeOff className="w-2.5 h-2.5" /> Off
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-sm truncate">{item.name}</h4>
                          <p className="text-primary font-bold text-lg mt-0.5">&#8377;{Number(item.price).toFixed(0)}</p>
                        </div>
                        {/* Quick actions */}
                        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditItem(item)}
                            className="p-1.5 rounded hover:bg-muted min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1.5 rounded hover:bg-muted min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => setDeleteItemTarget(item)}
                            className="p-1.5 rounded hover:bg-destructive/15 min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>

                      {/* Category badge */}
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {getCategoryName(item.category_id)}
                      </Badge>

                      {/* Stock badge */}
                      {item.stock_quantity !== null && (
                        <Badge variant={stockVariant(item)} className="mt-1.5 ml-1 text-[10px]">
                          Stock: {item.stock_quantity}
                          {item.stock_quantity <= item.low_stock_threshold && item.stock_quantity > 0 && (
                            <AlertTriangle className="w-2.5 h-2.5 ml-0.5" />
                          )}
                        </Badge>
                      )}

                      {/* Reorder + toggle row */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moveItem(item, "up")}
                            disabled={catIdx === 0}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            title="Move up"
                          >
                            <ArrowUp className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => moveItem(item, "down")}
                            disabled={catIdx === catItemsCount - 1}
                            className="p-1 rounded hover:bg-muted disabled:opacity-30"
                            title="Move down"
                          >
                            <ArrowDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                        <button
                          onClick={() => toggleItemAvailable(item)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                            item.is_available
                              ? "bg-chart-4/20 text-chart-4 hover:bg-chart-4/30"
                              : "bg-destructive/20 text-destructive hover:bg-destructive/30"
                          }`}
                        >
                          {item.is_available ? "Available" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --- Slide-up Item Modal --- */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={() => setShowItemModal(false)} />
          <div
            ref={itemModalRef}
            className="relative z-50 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-background/95 backdrop-blur-2xl border border-border/20 rounded-t-2xl shadow-2xl animate-slide-in-left"
            style={{ animation: "slideUp 0.3s ease-out" }}
          >
            <style>{`
              @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="px-4 sm:px-6 pb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">{editingItem?.id ? "Edit Item" : "New Item"}</h2>
                <button
                  onClick={() => { setShowItemModal(false); setEditingItem(null); }}
                  className="p-2 rounded-lg hover:bg-muted min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Preview */}
              {editingItem?.image_url && (
                <div className="mb-4 w-full h-40 rounded-xl overflow-hidden bg-muted">
                  <img
                    src={editingItem.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Name *</label>
                  <input
                    value={editingItem?.name || ""}
                    onChange={(e) => setEditingItem((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                    placeholder="e.g. Cappuccino"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Category *</label>
                  <select
                    value={editingItem?.category_id || ""}
                    onChange={(e) => setEditingItem((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border outline-none text-sm min-h-[44px]"
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Price (&#8377;) *</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={editingItem?.price ?? 0}
                    onChange={(e) => setEditingItem((f) => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                  />
                  {Number(editingItem?.price) <= 0 && (
                    <p className="text-xs text-destructive mt-1">Price must be greater than 0</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Image URL</label>
                  <input
                    value={editingItem?.image_url || ""}
                    onChange={(e) => setEditingItem((f) => ({ ...f, image_url: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Stock Qty (empty = unlimited)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingItem?.stock_quantity ?? ""}
                    onChange={(e) =>
                      setEditingItem((f) => ({ ...f, stock_quantity: e.target.value === "" ? null : parseInt(e.target.value) }))
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Low Stock Threshold</label>
                  <input
                    type="number"
                    min={1}
                    value={editingItem?.low_stock_threshold ?? 5}
                    onChange={(e) =>
                      setEditingItem((f) => ({ ...f, low_stock_threshold: parseInt(e.target.value) || 5 }))
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={editingItem?.description || ""}
                    onChange={(e) => setEditingItem((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm"
                    rows={2}
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingItem?.is_available ?? true}
                      onChange={(e) => setEditingItem((f) => ({ ...f, is_available: e.target.checked }))}
                      className="rounded"
                    />
                    Available for ordering
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => { setSaveAndAddAnother(false); handleSaveItem(); }}
                  disabled={working}
                  className="neon-glow flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold min-h-[44px] disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {editingItem?.id ? "Update Item" : "Save Item"}
                </button>
                {!editingItem?.id && (
                  <button
                    onClick={() => { setSaveAndAddAnother(true); handleSaveItem(); }}
                    disabled={working}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium min-h-[44px] hover:bg-muted disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" /> Save & Add Another
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={() => { setShowItemModal(false); setEditingItem(null); }}
                  className="px-5 py-2.5 rounded-lg border border-border text-sm min-h-[44px] hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Delete Item Confirmation --- */}
      <ConfirmDialog
        open={!!deleteItemTarget}
        onOpenChange={(open) => { if (!open) setDeleteItemTarget(null); }}
        title="Delete Item"
        message={<>Are you sure you want to delete &ldquo;{deleteItemTarget?.name}&rdquo;? This action cannot be undone.</>}
        confirmText="Delete"
        variant="danger"
        loading={working}
        onConfirm={handleDeleteItem}
      />

      {/* --- Delete Category Confirmation --- */}
      <ConfirmDialog
        open={!!deleteCategoryTarget}
        onOpenChange={(open) => { if (!open) setDeleteCategoryTarget(null); }}
        title="Delete Category"
        message={<>Delete &ldquo;{deleteCategoryTarget?.name}&rdquo; and all {deleteCategoryTarget ? categoryItemCounts[deleteCategoryTarget.id] || 0 : 0} items in it? This cannot be undone.</>}
        confirmText="Delete All"
        variant="danger"
        loading={working}
        onConfirm={handleDeleteCategory}
      />

      {/* Add Item FAB */}
      <button
        onClick={() => startEditItem()}
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 neon-glow flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/25 hover:scale-105 active:scale-95 transition-all min-h-[48px]"
      >
        <PlusCircle className="w-5 h-5" />
        Add Item
      </button>
    </div>
  );
}
