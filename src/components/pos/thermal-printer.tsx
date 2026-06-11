"use client";

import { useState } from "react";
import { Printer, Bluetooth, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Order } from "@/types/database";

interface ThermalPrinterProps {
  order: any;
  onClose?: () => void;
}

export function ThermalPrinter({ order, onClose }: ThermalPrinterProps) {
  const [printing, setPrinting] = useState(false);
  const [connected, setConnected] = useState(false);

  const connectAndPrint = async () => {
    setPrinting(true);
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb"],
      });

      const server = await device.gatt?.connect();
      setConnected(true);

      const service = await server?.getPrimaryService(
        "000018f0-0000-1000-8000-00805f9b34fb"
      );
      const characteristic = await service?.getCharacteristic(
        "00002af1-0000-1000-8000-00805f9b34fb"
      );

      const encoder = new TextEncoder();
      const receipt = generateReceipt(order);
      const data = encoder.encode(receipt);

      const chunkSize = 512;
      for (let i = 0; i < data.length; i += chunkSize) {
        await characteristic?.writeValueWithoutResponse(
          data.slice(i, i + chunkSize)
        );
        await new Promise((r) => setTimeout(r, 50));
      }

      toast.success("Receipt printed!");
      onClose?.();
    } catch (err: any) {
      if (err.name !== "NotFoundError") {
        toast.error("Print failed: " + err.message);
      }
    } finally {
      setPrinting(false);
    }
  };

  return (
    <button
      onClick={connectAndPrint}
      disabled={printing}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors disabled:opacity-50"
    >
      {printing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
      {printing ? "Printing..." : connected ? "Print Again" : "Print Receipt"}
    </button>
  );
}

function generateReceipt(order: any): string {
  const lines: string[] = [];
  lines.push("\x1B\x40");
  lines.push("\x1B\x61\x01");
  lines.push("RR DOWNTOWN ARCADE\n");
  lines.push("Cafe POS Receipt\n");
  lines.push("\x1B\x61\x00");
  lines.push("------------------------------\n");
  lines.push(`Order: #${order.id.slice(0, 8)}\n`);
  lines.push(`Date: ${new Date(order.created_at).toLocaleString()}\n`);
  if (order.table) {
    lines.push(`Table: ${order.table.table_number}\n`);
  }
  if (order.customer_name) {
    lines.push(`Customer: ${order.customer_name}\n`);
  }
  lines.push("------------------------------\n");
  lines.push("\x1B\x45\x01Items\x1B\x45\x00\n");

  order.order_items?.forEach((oi: any) => {
    const name = (oi.menu_item?.name || "Item").slice(0, 20);
    const qty = oi.quantity;
    const price = Number(oi.subtotal).toFixed(2);
    lines.push(`${qty}x ${name}\n`);
    lines.push(`  Rs. ${price}\n`);
  });

  lines.push("------------------------------\n");
  lines.push("\x1B\x45\x01");
  lines.push(`TOTAL: Rs. ${Number(order.total).toFixed(2)}\n`);
  lines.push("\x1B\x45\x00");
  lines.push("\n");
  lines.push("\x1B\x61\x01");
  lines.push("Thank you!\n");
  lines.push("Visit again at RR Downtown Arcade\n");
  lines.push("\x1B\x61\x00");
  lines.push("\n\n\n\n");
  lines.push("\x1D\x56\x42\x00");

  return lines.join("");
}
