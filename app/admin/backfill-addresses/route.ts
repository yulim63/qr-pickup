export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase.server";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}` +
      `&zoom=18&addressdetails=1&accept-language=ko`;

    const res = await fetch(url, {
      headers: { "User-Agent": "qr-pickup/1.0 (vercel)" },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = await res.json();
    const display = json?.display_name;
    return typeof display === "string" ? display : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    let limit = Number(body?.limit);
    if (!Number.isFinite(limit) || limit <= 0) limit = 30;
    if (limit > 80) limit = 80;

    const sb = supabaseServer();

    const { data: targets, error: selErr } = await sb
      .from("pickup_requests")
      .select("id, lat, lng, address")
      .or("address.is.null,address.eq.")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (selErr) return new NextResponse(selErr.message, { status: 500 });

    const rows = (targets || []) as Array<{ id: any; lat: any; lng: any; address: any }>;

    if (rows.length === 0) {
      const { count } = await sb
        .from("pickup_requests")
        .select("id", { count: "exact", head: true })
        .or("address.is.null,address.eq.");
      return NextResponse.json({ ok: true, updated: 0, remaining: count ?? 0 });
    }

    let updated = 0;

    for (let i = 0; i < rows.length; i++) {
      const id = rows[i].id;
      const lat = Number(rows[i].lat);
      const lng = Number(rows[i].lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      const address = await reverseGeocode(lat, lng);

      // Nominatim 예의상 약간 딜레이
      await sleep(250);

      if (!address) continue;

      const { error: upErr } = await sb.from("pickup_requests").update({ address }).eq("id", id);
      if (!upErr) updated++;
    }

    const { count } = await sb
      .from("pickup_requests")
      .select("id", { count: "exact", head: true })
      .or("address.is.null,address.eq.");

    return NextResponse.json({ ok: true, updated, remaining: count ?? 0 });
  } catch (e: any) {
    return new NextResponse(e?.message || "Unknown error", { status: 500 });
  }
}
