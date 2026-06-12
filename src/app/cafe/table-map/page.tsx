"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { CafeTable } from "@/types/database";
import {
  LayoutGrid,
  QrCode,
  Download,
  X,
  Eye,
  Table2,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

const PROD_BASE = "https://cafe.rrdowntownarcade.in";

export default function TableMapPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [cafeSlug, setCafeSlug] = useState("");
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [activeOrderTableIds, setActiveOrderTableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(null);

  const supabase = useMemo(() => createClient(), []);
  const cafeId = isSuperAdmin ? selectedCafeId : profile?.cafe_id;

  useEffect(() => {
    if (isSuperAdmin) {
      supabase
        .from("cafes")
        .select("id, name, slug")
        .eq("is_active", true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setCafes(data);
            setSelectedCafeId((prev) => prev || data[0].id);
          }
        });
    }
  }, [isSuperAdmin, supabase]);

  useEffect(() => {
    if (!cafeId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [cafeRes, tableRes, ordersRes] = await Promise.all([
        supabase.from("cafes").select("slug").eq("id", cafeId).single(),
        supabase.from("tables").select("*").eq("cafe_id", cafeId).order("table_number"),
        supabase.from("orders").select("table_id").eq("cafe_id", cafeId).in("status", ["pending", "preparing", "ready"]),
      ]);
      if (cancelled) return;
      if (cafeRes.data) setCafeSlug(cafeRes.data.slug);
      if (tableRes.data) setTables(tableRes.data);
      if (ordersRes.data) {
        const occupied = new Set(ordersRes.data.map((o) => o.table_id).filter(Boolean));
        setActiveOrderTableIds(occupied);
      }
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [cafeId, supabase]);

  const buildUrl = useCallback(
    (tableNumber: string, tableId: string) =>
      `${PROD_BASE}/menu/${cafeSlug}?table=${encodeURIComponent(tableNumber)}&table_id=${tableId}`,
    [cafeSlug]
  );

  const handleToggleActive = async (table: CafeTable) => {
    const { error } = await supabase
      .from("tables")
      .update({ is_active: !table.is_active })
      .eq("id", table.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Table ${table.table_number} ${table.is_active ? "deactivated" : "activated"}`);
      setTables((prev) =>
        prev.map((t) => (t.id === table.id ? { ...t, is_active: !t.is_active } : t))
      );
      setSelectedTable(null);
    }
  };

  const handleDownloadQR = (table: CafeTable) => {
    const svgEl = document.getElementById(`map-qr-${table.id}`);
    if (!svgEl) return;
    const svgClone = svgEl.cloneNode(true) as SVGElement;
    svgClone.setAttribute("width", "512");
    svgClone.setAttribute("height", "512");
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(svgBlob);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 512, 512);
      URL.revokeObjectURL(blobUrl);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `QR_Table_${table.table_number}.png`;
      link.href = pngUrl;
      link.click();
    };
    img.src = blobUrl;
  };

  const activeCount = tables.filter((t) => t.is_active).length;
  const occupiedCount = tables.filter((t) => t.is_active && activeOrderTableIds.has(t.id)).length;

  if (loading) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/15 ring-1 ring-primary/25">
            <LayoutGrid className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Table Map</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {activeCount} active &middot; {occupiedCount} occupied &middot; {tables.length - activeCount} inactive
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <select
            value={selectedCafeId || ""}
            onChange={(e) => setSelectedCafeId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none"
          >
            {cafes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          Active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          In Use
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          Inactive
        </span>
      </div>

      {/* Table Grid */}
      {tables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No tables yet"
          description="Add tables from Tables & QR page to see them here"
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {tables.map((table) => {
            const isOccupied = activeOrderTableIds.has(table.id);
            const statusColor = !table.is_active
              ? "bg-red-500/20 border-red-500/30"
              : isOccupied
                ? "bg-amber-500/20 border-amber-500/30"
                : "bg-emerald-500/20 border-emerald-500/30";
            const statusDot = !table.is_active
              ? "bg-red-500"
              : isOccupied
                ? "bg-amber-500"
                : "bg-emerald-500";

            return (
              <button
                key={table.id}
                onClick={() => setSelectedTable(table)}
                className={`glass-card rounded-xl p-4 text-center transition-all duration-200 hover:scale-[1.03] active:scale-95 border ${statusColor}`}
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
                  <h3 className="text-lg font-extrabold">{table.table_number}</h3>
                </div>
                <div className="bg-white p-2 rounded-lg inline-block mx-auto">
                  <QRCodeSVG
                    id={`map-qr-${table.id}`}
                    value={table.qr_code_url || buildUrl(table.table_number, table.id)}
                    size={80}
                    level="M"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 truncate">
                  {table.is_active ? (isOccupied ? "In Use" : "Active") : "Inactive"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedTable && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setSelectedTable(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4">
            <GlassCard className="w-full sm:max-w-sm sm:w-full h-full sm:h-auto overflow-y-auto p-4 sm:p-6 animate-scale-in relative rounded-none sm:rounded-2xl">
              <button
                onClick={() => setSelectedTable(null)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-muted min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <h3 className="text-2xl font-extrabold mb-1">
                  Table {selectedTable.table_number}
                </h3>
                <Badge
                  variant={
                    !selectedTable.is_active
                      ? "destructive"
                      : activeOrderTableIds.has(selectedTable.id)
                        ? "warning"
                        : "success"
                  }
                  className="mb-4"
                >
                  {!selectedTable.is_active
                    ? "Inactive"
                    : activeOrderTableIds.has(selectedTable.id)
                      ? "Currently In Use"
                      : "Active"}
                </Badge>

                <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-4">
                  <QRCodeSVG
                    id={`modal-qr-${selectedTable.id}`}
                    value={
                      selectedTable.qr_code_url ||
                      buildUrl(selectedTable.table_number, selectedTable.id)
                    }
                    size={180}
                    level="M"
                  />
                </div>

                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleDownloadQR(selectedTable)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 text-sm font-medium transition-colors min-h-[44px]"
                  >
                    <Download className="w-4 h-4" />
                    Download QR
                  </button>
                  <button
                    onClick={() => handleToggleActive(selectedTable)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm transition-colors min-h-[44px]"
                  >
                    {selectedTable.is_active ? "Mark Inactive" : "Mark Active"}
                  </button>
                </div>
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}