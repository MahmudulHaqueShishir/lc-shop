import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/liquidcash-server";

/**
 * Authoritative order status, used by /order/success. The browser landing on
 * that page (or carrying ?status=success in the URL) proves nothing by
 * itself — this route re-fetches the session from the LiquidCash merchant
 * API (server-to-server, X-API-Key) and returns THAT as the answer.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) {
    return NextResponse.json({ success: false, message: "Missing token." }, { status: 400 });
  }

  try {
    const session = await getSession(token);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch order status.";
    return NextResponse.json({ success: false, message }, { status: 502 });
  }
}
