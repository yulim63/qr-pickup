import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

type LoadStatus = "O" | "X" | "UNKNOWN";

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

function jsonError(message: string, status = 500) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return jsonError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", 500);
    }

    const ct = (req.headers.get("content-type") || "").toLowerCase();

    // ✅ FormData (Client.tsx가 보내는 방식)
    let sku = "";
    let itemNo: string | null = null;
    let qtySafe = 1;
    let loadStatus: LoadStatus = "UNKNOWN";
    let note: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;
    let photoFile: File | null = null;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();

      sku = String(form.get("sku") || "").toUpperCase();
      itemNo = form.get("item_no") ? String(form.get("item_no")) : null;

      const qty = toNum(form.get("qty"));
      if (qty !== null && qty > 0) qtySafe = Math.min(999, Math.floor(qty));

      const ls = String(form.get("load_status") || "");
      loadStatus = ls === "O" || ls === "X" ? (ls as LoadStatus) : "UNKNOWN";

      note = form.get("note") ? String(form.get("note")).slice(0, 100) : null;

      lat = toNum(form.get("lat"));
      lng = toNum(form.get("lng"));
      accuracy = form.get("accuracy") != null ? toNum(form.get("accuracy")) : null;

      const p = form.get("photo");
      if (p && typeof p === "object" && "arrayBuffer" in p) {
        photoFile = p as File;
      }
    }
    // ✅ 혹시 예전 JSON 방식 남아있을 수 있어 백워드 호환
    else if (ct.includes("application/json")) {
      const body: any = await req.json();

      sku = String(body?.sku || "").toUpperCase();
      itemNo = body?.itemNo ? String(body.itemNo) : null;

      const qty = Number(body?.qty);
      qtySafe = Number.isFinite(qty) && qty > 0 ? Math.min(999, Math.floor(qty)) : 1;

      loadStatus =
        body?.loadStatus === "O" || body?.loadStatus === "X" ? body.loadStatus : "UNKNOWN";

      note = body?.note ? String(body.note).slice(0, 100) : null;

      lat = Number(body?.lat);
      lng = Number(body?.lng);
      accuracy = body?.accuracy != null ? Number(body.accuracy) : null;

      // JSON 방식은 파일을 못 받으니 생략
      photoFile = null;
    } else {
      return jsonError("Unsupported content-type. Use multipart/form-data.", 400);
    }

    if (!sku) return jsonError("Invalid sku", 400);
    if (lat === null || lng === null) return jsonError("Invalid location", 400);

    // ✅ 주소 생성(실패해도 저장은 진행)
    const address = await reverseGeocode(lat, lng);

    // ✅ 사진 업로드(옵션)
    let photoUrl: string | null = null;

    if (photoFile) {
      const t = (photoFile.type || "").toLowerCase();
      const okType = t.includes("jpeg") || t.includes("jpg") || t.includes("png");
      if (!okType) return jsonError("Only JPG/PNG is allowed", 400);

      const ab = await photoFile.arrayBuffer();
      const bytes = Buffer.from(ab);

      // 서버 안전망(3MB)
      if (bytes.length > 3 * 1024 * 1024) {
        return jsonError("Photo too large (max 3MB after compression)", 400);
      }

      const ext = t.includes("png") ? "png" : "jpg";
      const fileName = `${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
      const path = `uploads/${sku}/${fileName}`;

      const { error: upErr } = await supabase.storage
        .from("pickup-photos")
        .upload(path, bytes, {
          contentType: ext === "png" ? "image/png" : "image/jpeg",
          upsert: false,
        });

      if (upErr) {
        return jsonError(`Photo upload failed: ${upErr.message}`, 500);
      }

      const { data } = supabase.storage.from("pickup-photos").getPublicUrl(path);
      photoUrl = data?.publicUrl || null;
    }

    // ✅ DB 저장 (+ row 반환)
    const { data: row, error } = await supabase
      .from("pickup_requests")
      .insert([
        {
          sku,
          item_no: itemNo,
          qty: qtySafe,
          load_status: loadStatus,
          note,
          lat,
          lng,
          accuracy: accuracy !== null && Number.isFinite(accuracy) ? accuracy : null,
          address: address || null,
          photo_url: photoUrl,
        },
      ])
      .select("*")
      .single();

    if (error) return jsonError(error.message, 500);

    return NextResponse.json(
      { ok: true, row },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return jsonError(e?.message || "Server error", 500);
  }
}
