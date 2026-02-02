export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase.server";
import { PRODUCTS } from "@/lib/products";

const BUCKET = "pickup-photos";

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  try {
    const buffer = Buffer.from(b64, "base64");
    return { mime, buffer };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=ko`;

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
    const body = await req.json();

    const sku = String(body?.sku || "").toUpperCase();
    const itemNo = body?.itemNo == null ? null : String(body.itemNo);

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy == null ? null : Number(body.accuracy);

    let qty = Number(body?.qty);
    if (!Number.isFinite(qty) || qty <= 0) qty = 1;
    if (qty > 999) qty = 999;

    // ✅ 상태 / 비고
    const loadStatusRaw = String(body?.loadStatus || "UNKNOWN").toUpperCase();
    const loadStatus =
      loadStatusRaw === "O" || loadStatusRaw === "X" ? loadStatusRaw : "UNKNOWN";

    let note = body?.note == null ? "" : String(body.note);
    note = note.trim();
    if (note.length > 100) note = note.slice(0, 100);

    const photoDataUrl = body?.photoDataUrl ? String(body.photoDataUrl) : null;

    if (!PRODUCTS[sku]) return new NextResponse("Invalid sku", { status: 400 });
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new NextResponse("Invalid lat/lng", { status: 400 });
    }

    const sb = supabaseServer();

    // 1) 주소
    const address = await reverseGeocode(lat, lng);

    // 2) 사진 업로드(선택)
    let photoUrl: string | null = null;

    if (photoDataUrl) {
      const parsed = parseDataUrl(photoDataUrl);
      if (!parsed) return new NextResponse("Invalid photo format", { status: 400 });

      const ext = parsed.mime.includes("png")
        ? "png"
        : parsed.mime.includes("webp")
        ? "webp"
        : "jpg";

      const filePath = `${sku}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

      const { error: upErr } = await sb.storage
        .from(BUCKET)
        .upload(filePath, parsed.buffer, {
          contentType: parsed.mime,
          upsert: false,
        });

      if (!upErr) {
        const { data } = sb.storage.from(BUCKET).getPublicUrl(filePath);
        photoUrl = data?.publicUrl ?? null;
      }
    }

    // 3) DB insert
    const { error } = await sb.from("pickup_requests").insert([
      {
        sku,
        item_no: itemNo,
        qty,
        load_status: loadStatus,
        note,
        lat,
        lng,
        accuracy,
        address,
        photo_url: photoUrl,
      },
    ]);

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json({ ok: true, address, photoUrl });
  } catch (e: any) {
    return new NextResponse(e?.message || "Unknown error", { status: 500 });
  }
}
