import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase.server";
import { PRODUCTS } from "@/lib/products";

export async function POST(req: Request) {
  try {
    const ua = req.headers.get("user-agent") || null;
    const body = await req.json();

    const sku = String(body?.sku || "").toUpperCase();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy == null ? null : Number(body.accuracy);

    if (!PRODUCTS[sku]) return new NextResponse("Invalid sku", { status: 400 });
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new NextResponse("Invalid lat/lng", { status: 400 });
    }

    const sb = supabaseServer();
    const { error } = await sb.from("pickup_requests").insert({
      sku,
      lat,
      lng,
      accuracy,
      user_agent: ua,
    });

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
