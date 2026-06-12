"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { Cafe, CafeTable } from "@/types/database";
import {
  Plus,
  Trash2,
  Loader2,
  QrCode,
  Download,
  RefreshCw,
  Copy,
  Check,
  Table2,
  Hash,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

const PROD_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_BASE_URL || window.location.origin)
    : (process.env.NEXT_PUBLIC_BASE_URL || "https://cafe.rrdowntownarcade.in");

function TableCardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-4 text-center space-y-3">
      <Skeleton className="h-7 w-24 mx-auto rounded" />
      <Skeleton className="h-28 w-28 mx-auto rounded-xl" />
      <Skeleton className="h-5 w-16 mx-auto rounded-full" />
      <div className="flex justify-center gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card rounded-xl p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function TablesPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const supabase = useMemo(() => createClient(), []);

  const [cafes, setCafes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [adding, setAdding] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGenericQR, setShowGenericQR] = useState(true);

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
      const [cafeRes, tableRes] = await Promise.all([
        supabase.from("cafes").select("*").eq("id", cafeId).single(),
        supabase
          .from("tables")
          .select("*")
          .eq("cafe_id", cafeId)
          .order("table_number"),
      ]);
      if (cancelled) return;
      if (cafeRes.data) setCafe(cafeRes.data);
      if (tableRes.data) setTables(tableRes.data);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [cafeId, supabase]);

  const buildTableUrl = useCallback(
    (tableNumber: string, tableId: string) =>
      `${PROD_BASE}/menu/${cafe?.slug || ""}?table=${encodeURIComponent(tableNumber)}&table_id=${tableId}`,
    [cafe?.slug]
  );

  const buildGenericUrl = useCallback(
    () => `${PROD_BASE}/menu?cafe=${cafe?.slug || ""}`,
    [cafe?.slug]
  );

  const reloadTables = useCallback(async () => {
    if (!cafeId) return;
    const { data } = await supabase
      .from("tables")
      .select("*")
      .eq("cafe_id", cafeId)
      .order("table_number");
    if (data) setTables(data);
  }, [cafeId, supabase]);

  const handleAddTable = async () => {
    const trimmed = newTableNumber.trim();
    if (!trimmed) {
      toast.error("Enter a table number");
      return;
    }
    if (tables.some((t) => t.table_number.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A table with this number already exists");
      return;
    }
    setAdding(true);
    const baseUrl = buildTableUrl(trimmed, "");
    const { data, error } = await supabase
      .from("tables")
      .insert({
        cafe_id: cafeId,
        table_number: trimmed,
        qr_code_url: baseUrl,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
    } else {
      if (data) {
        const url = buildTableUrl(trimmed, data.id);
        await supabase
          .from("tables")
          .update({ qr_code_url: url })
          .eq("id", data.id);
      }
      toast.success("Table added & QR generated");
      setNewTableNumber("");
      await reloadTables();
    }
    setAdding(false);
  };

  const handleRegenerateQR = async (tableId: string) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    setRegenerating(tableId);
    await new Promise((r) => setTimeout(r, 400));
    const url = buildTableUrl(table.table_number, tableId);
    const { error } = await supabase
      .from("tables")
      .update({ qr_code_url: url })
      .eq("id", tableId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("QR regenerated");
      await reloadTables();
    }
    setRegenerating(null);
  };

  const handleDeleteTable = async (tableId: string) => {
    setDeleting(tableId);
    const { error } = await supabase.from("tables").delete().eq("id", tableId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Table deleted");
      setConfirmDelete(null);
      await reloadTables();
    }
    setDeleting(null);
  };

  const copyLink = async (url: string, tableId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(tableId);
      toast.success("Link copied");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const downloadQR = (elementId: string, filename: string) => {
    const svgEl = document.getElementById(elementId);
    if (!svgEl) {
      toast.error("QR element not found");
      return;
    }
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
      link.download = filename;
      link.href = pngUrl;
      link.click();
    };
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      toast.error("Failed to generate image");
    };
    img.src = blobUrl;
  };

  const downloadGenericQR = () => {
    const safeCafeName = (cafe?.name || "cafe").replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadQR(`qr-generic-${cafeId}`, `QR_Generic_${safeCafeName}.png`);
  };

  const downloadTableQR = (table: CafeTable) => {
    const safeNum = table.table_number.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeCafeName = (cafe?.name || "cafe").replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadQR(`qr-table-${table.id}`, `QR_Table_${safeNum}_${safeCafeName}.png`);
  };

  const activeTables = tables.filter((t) => t.is_active).length;
  const qrGenerated = tables.filter((t) => !!t.qr_code_url).length;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Tables & QR Codes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set up QR codes for each table so customers can scan and order directly from their seat.
          </p>
        </div>
        <button
          onClick={() => setShowGenericQR(!showGenericQR)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
        >
          <QrCode className="w-4 h-4" />
          {showGenericQR ? "Hide Generic QR" : "Show Generic QR"}
        </button>
      </div>

      {/* Cafe Selector (super admin) */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Cafe:</span>
          <select
            value={selectedCafeId || ""}
            onChange={(e) => setSelectedCafeId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-muted border border-border text-sm outline-none focus:border-primary transition-colors"
          >
            {cafes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stats Bar */}
      {loading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Table2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tables.length}</p>
              <p className="text-xs text-muted-foreground">Total Tables</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-chart-4/10 text-chart-4">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeTables}</p>
              <p className="text-xs text-muted-foreground">Active Tables</p>
            </div>
          </GlassCard>
          <GlassCard className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{qrGenerated}</p>
              <p className="text-xs text-muted-foreground">QR Codes Generated</p>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Add Table Form */}
      {!loading && (
        <GlassCard className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              value={newTableNumber}
              onChange={(e) => setNewTableNumber(e.target.value)}
              placeholder='Table number (e.g. "T1", "Booth 1", "Table 5")'
              className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !adding) handleAddTable();
              }}
              disabled={adding}
            />
            <button
              onClick={handleAddTable}
              disabled={adding || !newTableNumber.trim()}
              className="neon-glow flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px] disabled:opacity-50 transition-all active:scale-95"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Table & Generate QR
            </button>
          </div>
        </GlassCard>
      )}

      {/* Generic QR Section */}
      {!loading && showGenericQR && cafe && (
        <GlassCard className="p-4 sm:p-6">
          <div className="text-center">
            <h3 className="font-semibold text-lg mb-1">Generic QR Code</h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Scan this to open the menu. Customer selects their table manually. Good for
              walk-ins or counters where tables are not pre-assigned.
            </p>
            <div className="inline-block bg-white p-4 rounded-xl shadow-md">
              <QRCodeSVG
                id={`qr-generic-${cafeId}`}
                value={buildGenericUrl()}
                size={180}
                level="M"
              />
            </div>
            <div className="mt-4 text-xs text-muted-foreground break-all max-w-sm mx-auto">
              {buildGenericUrl()}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                onClick={downloadGenericQR}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/15 text-accent hover:bg-accent/25 text-sm font-medium transition-colors min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Download QR (PNG)
              </button>
              <button
                onClick={() => copyLink(buildGenericUrl(), "generic")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-sm transition-colors min-h-[44px]"
              >
                {copiedId === "generic" ? (
                  <Check className="w-4 h-4 text-chart-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedId === "generic" ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Table Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <TableCardSkeleton key={i} />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState
          icon={QrCode}
          title="No tables yet"
          description="Add your first table to generate QR codes. Customers will scan these to order directly from their seat."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {tables.map((table) => (
            <GlassCard
              key={table.id}
              neon
              className="p-4 text-center group relative flex flex-col items-center gap-3"
            >
              {/* Table Number & Status */}
              <div className="flex items-center justify-center gap-2 w-full">
                <h3 className="text-xl font-extrabold tracking-tight">
                  {table.table_number}
                </h3>
                <Badge variant={table.is_active ? "success" : "destructive"}>
                  {table.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* QR Code */}
              <div className="bg-white p-3 rounded-xl shadow-md inline-block max-w-full">
                <QRCodeSVG
                  id={`qr-table-${table.id}`}
                  value={
                    table.qr_code_url ||
                    buildTableUrl(table.table_number, table.id)
                  }
                  size={140}
                  level="M"
                />
              </div>

              {/* URL preview */}
              <p className="text-[10px] text-muted-foreground break-all leading-tight max-w-[180px] line-clamp-2">
                {table.qr_code_url || buildTableUrl(table.table_number, table.id)}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap mt-auto pt-1">
                {confirmDelete === table.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDeleteTable(table.id)}
                      disabled={deleting === table.id}
                      className="px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold min-h-[44px] hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {deleting === table.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-3 py-2 rounded-lg bg-muted text-xs font-medium min-h-[44px] hover:bg-muted/80"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleRegenerateQR(table.id)}
                      disabled={regenerating === table.id}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-chart-4/15 text-chart-4 hover:bg-chart-4/25 transition-colors disabled:opacity-50 min-h-[44px]"
                    >
                      {regenerating === table.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Regen
                    </button>
                    <button
                      onClick={() => downloadTableQR(table)}
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors min-h-[44px]"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                    <button
                      onClick={() =>
                        copyLink(
                          table.qr_code_url ||
                            buildTableUrl(table.table_number, table.id),
                          table.id
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors min-h-[44px]"
                    >
                      {copiedId === table.id ? (
                        <Check className="w-3 h-3 text-chart-4" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedId === table.id ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(table.id)}
                      className="p-2 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

    </div>
  );
}
