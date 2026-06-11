import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { razorpay_order_id } = await request.json();

    if (!razorpay_order_id) {
      return NextResponse.json({ error: "Missing razorpay_order_id" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const res = await fetch(`https://api.razorpay.com/v1/payments?razorpay_order_id=${razorpay_order_id}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ paid: false, error: data.error?.description });
    }

    const paid = data?.items?.some((p: any) => p.status === "captured");

    return NextResponse.json({ paid: !!paid });
  } catch (err: any) {
    return NextResponse.json({ paid: false, error: err.message });
  }
}