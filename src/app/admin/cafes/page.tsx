"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Store,
  Check,
  X,
  Save,
} from "lucide-react";
import type { Cafe } from "@/types/database";
import toast from "react-hot-toast";

export default function ManageCafes() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCafe, setNewCafe] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    description: "",
    royalty_percentage: 0,
  });
  const supabase = createClient();

  const fetchCafes = async () => {
    const { data } = await supabase
      .from("cafes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setCafes(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCafes();
  }, []);

  const resetForm = () => {
    setForm({ name: "", slug: "", description: "", royalty_percentage: 0 });
    setEditingId(null);
    setNewCafe(false);
  };

  const handleEdit = (cafe: Cafe) => {
    setEditingId(cafe.id);
    setNewCafe(false);
    setForm({
      name: cafe.name,
      slug: cafe.slug,
      description: cafe.description || "",
      royalty_percentage: Number(cafe.royalty_percentage),
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.slug) {
      toast.error("Name and slug are required");
      return;
    }
    try {
      if (editingId) {
        const { error } = await supabase
          .from("cafes")
          .update({
            name: form.name,
            slug: form.slug,
            description: form.description,
            royalty_percentage: form.royalty_percentage,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Cafe updated");
      } else {
        const { error } = await supabase.from("cafes").insert({
          name: form.name,
          slug: form.slug,
          description: form.description || null,
          royalty_percentage: form.royalty_percentage,
        });
        if (error) throw error;
        toast.success("Cafe created");
      }
      resetForm();
      fetchCafes();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleActive = async (cafe: Cafe) => {
    const { error } = await supabase
      .from("cafes")
      .update({ is_active: !cafe.is_active })
      .eq("id", cafe.id);
    if (!error) fetchCafes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this cafe? This cannot be undone.")) return;
    const { error } = await supabase.from("cafes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cafe deleted");
      fetchCafes();
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Manage Cafes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Onboard, edit, or remove cafe shops
          </p>
        </div>
        <button
          onClick={() => {
            setNewCafe(true);
            setEditingId(null);
            setForm({
              name: "",
              slug: "",
              description: "",
              royalty_percentage: 0,
            });
          }}
          className="neon-glow flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          Add Cafe
        </button>
      </div>

      {(newCafe || editingId) && (
        <GlassCard className="p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            {editingId ? "Edit Cafe" : "New Cafe"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Cafe Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
                placeholder="e.g. Pizza Corner"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Slug (URL) *
              </label>
              <input
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    slug: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-"),
                  }))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
                placeholder="e.g. pizza-corner"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
                rows={2}
                placeholder="Short description of the cafe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                Royalty / Commission (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.royalty_percentage}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    royalty_percentage:
                      parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm min-h-[44px]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              {editingId ? "Update" : "Create"}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {cafes.map((cafe) => (
          <GlassCard key={cafe.id} className="p-4 relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Store className="w-5 h-5 text-primary shrink-0" />
                <h3 className="font-semibold truncate">{cafe.name}</h3>
              </div>
              <Badge
                variant={cafe.is_active ? "success" : "destructive"}
                className="shrink-0 ml-2"
              >
                {cafe.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              /{cafe.slug}
            </p>
            <p className="text-sm mb-1">
              Royalty:{" "}
              <span className="text-secondary font-semibold">
                {Number(cafe.royalty_percentage)}%
              </span>
            </p>
            <div className="flex gap-1.5 mt-4 flex-wrap">
              <button
                onClick={() => handleEdit(cafe)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-colors min-h-[36px]"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={() => handleToggleActive(cafe)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-colors min-h-[36px]"
              >
                {cafe.is_active ? (
                  <X className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {cafe.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => handleDelete(cafe.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors min-h-[36px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          </GlassCard>
        ))}
        {cafes.length === 0 && (
          <p className="text-muted-foreground text-center py-8 col-span-full text-sm">
            No cafes yet. Add your first cafe above.
          </p>
        )}
      </div>
    </div>
  );
}
