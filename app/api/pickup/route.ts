import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        // ✅ 없으면 차단/빈 응답 나오는 경우 많음
        "User-Agent": "qr-pickup/1.0 (vercel; contact: admin)",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      // 캐시로 주소 꼬이는 경우 방지
      cache: "no-store",
    });

    if (!res.ok) return "";
    const json: any = await res.json();

    // display_name이 가장 무난
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

    const loadStatus = body?.loadStatus === "O" || body?.loadStatus === "X" ? body.loadStatus : "UNKNOWN";
    const note = body?.note ? String(body.note).slice(0, 100) : null;

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    const accuracy = body?.accuracy != null ? Number(body.accuracy) : null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new NextResponse("Invalid location", { status: 400 });
    }

    // ✅ 주소 생성
    const address = await reverseGeocode(lat, lng);

    // ✅ 사진 업로드(너 프로젝트에서 이미 구현돼있을 거라 여기선 photo_url만 받는 형태로 둠)
    // - 만약 너가 photoDataUrl을 받아서 storage에 업로드하는 로직을 이미 갖고 있다면,
    //   그 로직 결과 URL을 photo_url에 넣으면 됨.
    const photoUrl = body?.photoUrl ? String(body.photoUrl) : null;

    // ✅ DB 저장 (컬럼명은 네 테이블 기준: sku, item_no, qty, load_status, note, lat, lng, accuracy, address, photo_url)
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
        photo_url: photoUrl || null,
      },
    ]);

    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }

    // ✅ 사용자 화면에서 주소 표시할 수 있게 응답에 포함
    return NextResponse.json({ ok: true, address: address || "" }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
