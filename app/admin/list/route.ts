import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

export async function GET() {
  try {
    if (!supabaseUrl || !serviceKey) {
      return new NextResponse("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    const { data, error } = await supabase
      .from("pickup_requests")
      .select(
        "id, created_at, sku, item_no, qty, load_status, note, lat, lng, accuracy, address, photo_url"
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }

    return NextResponse.json(
      { rows: data ?? [] },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return new NextResponse(e?.message || "Server error", { status: 500 });
  }
}
