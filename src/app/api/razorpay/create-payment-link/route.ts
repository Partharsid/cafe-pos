import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { amount, customerName, customerPhone, description } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
        accept_partial: false,
        description: description || "Cafe Order Payment",
        customer: {
          name: customerName || "Guest",
          contact: customerPhone || "",
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        notes: { purpose: "cafe_qr_order" },
        callback_url: "",
        callback_method: "get",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error?.description || "Failed to create payment link");
    }

    return NextResponse.json({
      payment_link_url: data.short_url,
      payment_link_id: data.id,
      amount: data.amount,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}