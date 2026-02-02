import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

function isDataUrlImage(dataUrl: string) {
  return /^data:image\/(jpeg|jpg|png);base64,/.test(dataUrl);
}

function extFromDataUrl(dataUrl: string) {
  if (/^data:image\/png;base64,/.test(dataUrl)) return "png";
  return "jpg";
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "qr-pickup/1.0 (vercel; contact: admin)",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!res.ok) return "";
    const json: any = await res.json();
    const dn = typeof json?.display_name === "string" ? json.display_name : "";
    return dn;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return new NextResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    const body: any = await req.json();

    const sku = String(body?.sku || "").toUpperCase();
    const itemNo = body?.itemNo ? String(body.itemNo) : null;

    const qty = Number(body?.qty);
    const qtySafe = Number.isFinite(qty) && qty > 0 ? Math.min(999, Math.floor(qty)) : 1;

    const loadStatus =
      body?.loadStatus === "O" || body?.loadStatus === "X" ? body.loadStatus : "UNKNOWN";

    const note = body?.note ? String(body.note).slice(0, 100) : null;

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy != null ? Number(body.accuracy) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new NextResponse("Invalid location", { status: 400 });
    }

    // ✅ 주소 생성
    const address = await reverseGeocode(lat, lng);

    // ✅ 사진 업로드(옵션)
    let photoUrl: string | null = null;

    const photoDataUrl = body?.photoDataUrl ? String(body.photoDataUrl) : "";
    if (photoDataUrl) {
      if (!isDataUrlImage(photoDataUrl)) {
        return new NextResponse("Only JPG/PNG is allowed", { status: 400 });
      }

      const comma = photoDataUrl.indexOf(",");
      const b64 = comma >= 0 ? photoDataUrl.slice(comma + 1) : "";
      const bytes = Buffer.from(b64, "base64");

      // 안전망
      if (bytes.length > 3 * 1024 * 1024) {
        return new NextResponse("Photo too large (max 3MB after compression)", { status: 400 });
      }

      const ext = extFromDataUrl(photoDataUrl);
      const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
      const path = `uploads/${sku}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("pickup-photos")
        .upload(path, bytes, {
          contentType: ext === "png" ? "image/png" : "image/jpeg",
          upsert: false,
        });

      if (upErr) {
        return new NextResponse(`Photo upload failed: ${upErr.message}`, { status: 500 });
      }

      const { data } = supabase.storage.from("pickup-photos").getPublicUrl(path);
      photoUrl = data?.publicUrl || null;
    }

    // ✅ DB 저장
    const { error } = await supabase.from("pickup_requests").insert([
      {
        sku,
        item_no: itemNo,
        qty: qtySafe,
        load_status: loadStatus,
        note,
        lat,
        lng,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
        address: address || null,
        photo_url: photoUrl,
      },
    ]);

    if (error) return new NextResponse(error.message, { status: 500 });

    return NextResponse.json(
      { ok: true, address: address || "", photoUrl: photoUrl || "" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
