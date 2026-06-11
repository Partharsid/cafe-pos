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

    const res = await fetch("https://api.razorpay.com/v1/qr_codes", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "upi_qr",
        name: name || "Cafe POS Payment",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: Math.round(amount * 100),
        description: description || "Cafe order payment",
        customer_id: null,
        close_by: Math.floor(Date.now() / 1000) + 1800,
        notes: {
          purpose: "cafe_pos_payment",
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.description || "Failed to create QR code");
    }

    return NextResponse.json({
      qr_code_url: data?.image_url || null,
      razorpay_order_id: data.id,
      qr_id: data.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}