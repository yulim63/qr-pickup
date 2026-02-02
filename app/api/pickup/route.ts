import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceKey) {
      return new NextResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    const body = await req.json();

    // 여기서 pickup_requests INSERT 수행
    const { error } = await supabase.from("pickup_requests").insert([
      {
        sku: body.sku,
        item_no: body.itemNo ?? null,
        qty: body.qty ?? 1,
        load_status: body.loadStatus ?? "UNKNOWN",
        note: body.note ?? null,
        lat: body.lat,
        lng: body.lng,
        accuracy: body.accuracy ?? null,
        photo_url: body.photoUrl ?? null, // 네가 업로드 후 URL 저장하는 컬럼명에 맞춰
        address: body.address ?? null,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
