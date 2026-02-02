export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseServer } from "@/lib/supabase.server";
import AdminClient from "./AdminClient";

export default async function AdminPage() {
  const sb = supabaseServer();

  const { data, error } = await sb
    .from("pickup_requests")
    .select("id, created_at, sku, item_no, qty, lat, lng, accuracy, address, photo_url")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return <div style={{ padding: 24 }}>DB 오류: {error.message}</div>;
  }

  return <AdminClient initialRows={(data || []) as any[]} />;
}
