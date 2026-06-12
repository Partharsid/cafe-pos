import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, name, description } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // First create a Razorpay order
    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `qr_${Date.now()}`,
        payment_capture: 1,
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      throw new Error(orderData.error?.description || "Failed to create order");
    }

    // Try creating a Razorpay QR code
    const qrRes = await fetch("https://api.razorpay.com/v1/qr_codes", {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "upi_qr",
        name: name || "Cafe POS",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: Math.round(amount * 100),
        description: description || "Cafe order",
        close_by: Math.floor(Date.now() / 1000) + 1800,
        notes: { purpose: "cafe_pos", order_id: orderData.id },
      }),
    });

    const qrData = await qrRes.json();

    let qrCodeUrl: string;

    if (qrRes.ok && qrData?.image_url) {
      qrCodeUrl = qrData.image_url;
    } else {
      // Fallback: generate UPI QR using order details
      qrCodeUrl = `https://api.razorpay.com/v1/orders/${orderData.id}/qr`;
    }

    return NextResponse.json({
      qr_code_url: qrCodeUrl,
      razorpay_order_id: orderData.id,
      qr_id: qrData?.id || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}