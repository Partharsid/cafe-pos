import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, qr_id } = await request.json();

    if (!razorpay_order_id && !qr_id) {
      return NextResponse.json({ error: "Missing payment identifier" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // 1. Check if a standard Razorpay order has been paid
    if (razorpay_order_id && razorpay_order_id.startsWith("order_")) {
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}/payments`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (orderRes.ok) {
        const orderData = await orderRes.json();
        const paid = orderData?.items?.some((p: any) => p.status === "captured");
        if (paid) {
          return NextResponse.json({ paid: true, method: "razorpay_order" });
        }
      }

      // Also check payments by order ID
      const payRes = await fetch(`https://api.razorpay.com/v1/payments?razorpay_order_id=${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (payRes.ok) {
        const payData = await payRes.json();
        const paid = payData?.items?.some((p: any) => p.status === "captured");
        if (paid) {
          return NextResponse.json({ paid: true, method: "payment_by_order" });
        }
      }
    }

    // 2. Check QR code payments (for UPI QR)
    if (qr_id && qr_id.startsWith("qr_")) {
      const qrPayRes = await fetch(`https://api.razorpay.com/v1/qr_codes/${qr_id}/payments`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (qrPayRes.ok) {
        const qrPayData = await qrPayRes.json();
        const paid = qrPayData?.items?.some((p: any) => p.status === "captured");
        if (paid) {
          return NextResponse.json({ paid: true, method: "qr_payment" });
        }
      }
    }

    // 3. Also try fetching the order directly to check its status
    if (razorpay_order_id) {
      const orderInfoRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (orderInfoRes.ok) {
        const orderInfo = await orderInfoRes.json();
        if (orderInfo.status === "paid") {
          return NextResponse.json({ paid: true, method: "order_status" });
        }
      }
    }

    return NextResponse.json({ paid: false });
  } catch (err: any) {
    return NextResponse.json({ paid: false, error: err.message });
  }
}