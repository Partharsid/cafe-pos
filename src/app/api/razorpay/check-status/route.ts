import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return handleCheck(request);
}

export async function POST(request: Request) {
  return handleCheck(request);
}

async function handleCheck(request: Request | NextRequest) {
  try {
    let razorpay_order_id: string | null = null;
    let qr_id: string | null = null;

    if (request instanceof NextRequest || request.method === "GET") {
      const url = new URL(request.url);
      razorpay_order_id = url.searchParams.get("razorpay_order_id");
      qr_id = url.searchParams.get("qr_id");
      const paymentLinkId = url.searchParams.get("payment_link_id");
      if (paymentLinkId) razorpay_order_id = paymentLinkId;
    } else {
      const body = await request.json();
      razorpay_order_id = body.razorpay_order_id || null;
      qr_id = body.qr_id || null;
    }

    if (!razorpay_order_id && !qr_id) {
      return NextResponse.json({ error: "Missing payment identifier" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    // 1. Check Payment Link status (plink_ prefixed IDs)
    if (razorpay_order_id && razorpay_order_id.startsWith("plink_")) {
      const linkRes = await fetch(`https://api.razorpay.com/v1/payment_links/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (linkRes.ok) {
        const linkData = await linkRes.json();
        if (linkData.status === "paid") {
          return NextResponse.json({ paid: true, method: "payment_link" });
        }
      }

      // Also check payments for this payment link
      const payRes = await fetch(`https://api.razorpay.com/v1/payment_links/${razorpay_order_id}/payments`, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (payRes.ok) {
        const payData = await payRes.json();
        const paid = payData?.items?.some((p: any) => p.status === "captured");
        if (paid) {
          return NextResponse.json({ paid: true, method: "payment_link_payments" });
        }
      }
    }

    // 2. Check if a standard Razorpay order has been paid
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

    // 3. Check QR code payments (legacy, kept for backward compatibility)
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

    return NextResponse.json({ paid: false });
  } catch (err: any) {
    return NextResponse.json({ paid: false, error: err.message });
  }
}