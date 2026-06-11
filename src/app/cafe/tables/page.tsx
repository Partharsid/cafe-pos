"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import type { Cafe, CafeTable } from "@/types/database";
import {
  Plus,
  Trash2,
  Loader2,
  QrCode,
  Download,
  RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

export default function TablesPage() {
  const { profile } = useAuthStore();
  const isSuperAdmin = profile?.role === "super_admin";
  const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
  const [cafes, setCafes] = useState<{ id: string; name: string }[]>([]);
  const [cafe, setCafe] = useState<Cafe | null>(null);
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTableNumber, setNewTableNumber] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [showGenericQR, setShowGenericQR] = useState(false);
  const [qrSize, setQrSize] = useState(120);
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

  const menuUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/menu/${cafe?.slug}`
      : "";

  const fetchData = async () => {
    if (!cafeId) return;
    const [cafeRes, tableRes] = await Promise.all([
      supabase.from("cafes").select("*").eq("id", cafeId).single(),
      supabase
        .from("tables")
        .select("*")
        .eq("cafe_id", cafeId)
        .order("table_number"),
    ]);
    if (cafeRes.data) setCafe(cafeRes.data);
    if (tableRes.data) setTables(tableRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [cafeId]);

  useEffect(() => {
    setQrSize(window.innerWidth < 400 ? 100 : 120);
    const onResize = () => setQrSize(window.innerWidth < 400 ? 100 : 120);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleAddTable = async () => {
    if (!newTableNumber.trim()) return;
    const { error } = await supabase.from("tables").insert({
      cafe_id: cafeId,
      table_number: newTableNumber.trim(),
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Table added");
      setNewTableNumber("");
      fetchData();
    }
  };

  const handleDeleteTable = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    await supabase.from("tables").delete().eq("id", id);
    toast.success("Table deleted");
    fetchData();
  };

  const handleGenerateQR = async (tableId: string) => {
    setGenerating(tableId);
    await new Promise((r) => setTimeout(r, 500));
    const table = tables.find((t) => t.id === tableId);
    const qrUrl = `${menuUrl}?table=${table?.table_number || ""}&table_id=${tableId}`;
    await supabase
      .from("tables")
      .update({ qr_code_url: qrUrl })
      .eq("id", tableId);
    fetchData();
    setGenerating(null);
  };

  const handleDownloadQR = (tableId: string, tableNumber: string) => {
    const svg = document.getElementById(
      `qr-${tableId}`
    ) as unknown as SVGElement;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `QR_Table_${tableNumber}.png`;
      link.href = pngFile;
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
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
            Tables & QR Codes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage tables and generate QR codes
          </p>
        </div>
        <button
          onClick={() => setShowGenericQR(!showGenericQR)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
        >
          <QrCode className="w-4 h-4" />
          Generic QR
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
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={newTableNumber}
            onChange={(e) => setNewTableNumber(e.target.value)}
            placeholder="Table number (e.g. T5)"
            className="flex-1 px-3 py-2.5 rounded-lg bg-muted border border-border focus:border-primary outline-none text-sm min-h-[44px]"
            onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
          />
          <button
            onClick={handleAddTable}
            className="neon-glow flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Add Table
          </button>
        </div>
      </GlassCard>

      {showGenericQR && (
        <GlassCard className="p-4 sm:p-6">
          <div className="text-center">
            <h3 className="font-semibold mb-2">
              Generic QR Code (Select Table Manually)
            </h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
              Scan this QR to open the menu. Customer will select or enter
              their table number.
            </p>
            <div className="inline-block bg-white p-3 sm:p-4 rounded-xl">
              <QRCodeSVG
                id={`qr-generic-${cafeId}`}
                value={`${menuUrl}`}
                size={qrSize === 100 ? 120 : 160}
                level="M"
              />
            </div>
            <div className="mt-3">
              <button
                onClick={() =>
                  handleDownloadQR(`generic-${cafeId}`, "Generic")
                }
                className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Download Generic QR
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {tables.map((table) => (
          <GlassCard key={table.id} className="p-4 text-center">
            <h3 className="text-lg font-bold mb-3">
              Table {table.table_number}
            </h3>

            <div className="inline-block bg-white p-3 rounded-xl mb-3">
              <QRCodeSVG
                id={`qr-${table.id}`}
                value={
                  table.qr_code_url ||
                  `${menuUrl}?table=${table.table_number}&table_id=${table.id}`
                }
                size={qrSize}
                level="M"
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleGenerateQR(table.id)}
                disabled={generating === table.id}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50 min-h-[36px]"
              >
                {generating === table.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Regenerate
              </button>
              <button
                onClick={() =>
                  handleDownloadQR(table.id, table.table_number)
                }
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-colors min-h-[36px]"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={() => handleDeleteTable(table.id)}
                className="p-2 rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </GlassCard>
        ))}
        {tables.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8 col-span-full">
            No tables yet. Add your first table above.
          </p>
        )}
      </div>
    </div>
  );
}
