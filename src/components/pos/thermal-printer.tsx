"use client";

import { useState } from "react";
import { Printer, Bluetooth, Loader2 } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";

interface ThermalPrinterProps {
  order: any;
  onClose?: () => void;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function ThermalPrinter({
  order,
  onClose,
  label,
  variant = "default",
  className = "",
}: ThermalPrinterProps) {
  const [printing, setPrinting] = useState(false);
  const [connected, setConnected] = useState(false);

  const connectAndPrint = async () => {
    setPrinting(true);
    try {
      if ((navigator as any)?.bluetooth) {
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
        } catch (btErr: any) {
          if (btErr.name === "NotFoundError") {
            toast.error("Bluetooth device not selected. Using browser print.");
            openBrowserPrint();
          } else {
            toast("Bluetooth failed, using browser print.", { icon: "🖨️" });
            openBrowserPrint();
          }
        }
      } else {
        toast("Bluetooth not supported. Opening browser print.", {
          icon: "🖨️",
        });
        openBrowserPrint();
      }
    } catch (err: any) {
      toast.error("Print failed: " + (err.message || "Unknown error"));
    } finally {
      setPrinting(false);
    }
  };

  const openBrowserPrint = () => {
    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) {
      toast.error("Pop-up blocked. Please allow pop-ups to print.");
      return;
    }
    win.document.write(generateHtmlReceipt(order));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    onClose?.();
  };

  const variantClasses: Record<string, string> = {
    default:
      "bg-muted hover:bg-muted/80 text-foreground",
    outline:
      "border border-border hover:bg-muted/50 text-foreground",
    ghost:
      "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
  };

  return (
    <button
      onClick={connectAndPrint}
      disabled={printing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${variantClasses[variant]} ${className}`}
    >
      {printing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : connected ? (
        <Bluetooth className="w-4 h-4" />
      ) : (
        <Printer className="w-4 h-4" />
      )}
      {printing ? "Printing..." : label || (connected ? "Print Again" : "Print Receipt")}
    </button>
  );
}

function generateReceipt(order: any): string {
  const lines: string[] = [];
  lines.push("\x1B\x40");
  lines.push("\x1B\x61\x01");
  lines.push("RR DOWNTOWN ARCADE\n");
  lines.push(`${order.cafe?.name || "Cafe POS"} Receipt\n`);
  lines.push("\x1B\x61\x00");
  lines.push("------------------------------\n");
  lines.push(`Order: #${order.id.slice(0, 8)}\n`);
  lines.push(`Date: ${format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}\n`);
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

function generateHtmlReceipt(order: any): string {
  const royaltyPct =
    Number(order.royalty_amount) > 0
      ? ((Number(order.royalty_amount) / Number(order.subtotal)) * 100).toFixed(1)
      : "0";

  const items = (order.order_items || [])
    .map(
      (oi: any) => `
    <tr>
      <td style="padding:4px 0">${oi.quantity}x ${oi.menu_item?.name || "Item"}</td>
      <td style="text-align:right;padding:4px 0">₹${Number(oi.subtotal).toFixed(0)}</td>
    </tr>`
    )
    .join("");

  const customerInfo =
    (order.customer_name ? `<p style="font-size:11px;margin:0">Customer: ${order.customer_name}</p>` : "") +
    (order.customer_phone ? `<p style="font-size:10px;margin:0">${order.customer_phone}</p>` : "");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${order.id.slice(0, 8)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Courier New', monospace; font-size:13px; max-width:340px; margin:0 auto; padding:20px; color:#111; }
    .center { text-align:center; }
    .divider { border-top:1px dashed #aaa; margin:10px 0; }
    table { width:100%; border-collapse:collapse; }
    .total { font-size:17px; font-weight:bold; }
    .brand { font-size:20px; font-weight:bold; letter-spacing:1px; }
  </style>
</head>
<body>
  <div class="center">
    <p class="brand">RR DOWNTOWN ARCADE</p>
    <p style="font-size:11px;margin:0">${order.cafe?.name || "Cafe POS"}</p>
    <p style="font-size:10px;margin:4px 0 0 0">${format(new Date(order.created_at), "dd/MM/yyyy hh:mm a")}</p>
    <p style="font-size:11px;margin:0">Order #${order.id.slice(0, 8)}</p>
    ${order.table ? `<p style="font-size:11px;margin:0">Table: ${order.table.table_number}</p>` : ""}
    ${customerInfo}
  </div>
  <div class="divider"></div>
  <table style="font-size:12px">${items}</table>
  <div class="divider"></div>
  <table style="font-size:12px">
    <tr><td>Subtotal</td><td style="text-align:right">₹${Number(order.subtotal).toFixed(2)}</td></tr>
    <tr><td>Tax (5%)</td><td style="text-align:right">₹${Number(order.tax).toFixed(2)}</td></tr>
    ${Number(order.royalty_amount) > 0 ? `<tr><td>Royalty (${royaltyPct}%)</td><td style="text-align:right">₹${Number(order.royalty_amount).toFixed(2)}</td></tr>` : ""}
  </table>
  <div class="divider"></div>
  <div class="center">
    <p class="total">TOTAL: ₹${Number(order.total).toFixed(2)}</p>
  </div>
  <div class="divider"></div>
  <div class="center" style="font-size:11px;margin-top:14px">
    <p style="margin:0">Thank you! Visit again.</p>
    <p style="margin:4px 0 0 0;font-weight:bold">RR Downtown Arcade</p>
    ${order.status === "completed" ? '<p style="margin:8px 0 0 0;font-weight:bold;font-size:14px">PAID</p>' : ""}
  </div>
</body>
</html>`;
}
