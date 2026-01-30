import { supabaseServer } from "@/lib/supabase.server";

export default async function AdminPage() {
  const sb = supabaseServer();

  const { data, error } = await sb
    .from("pickup_requests")
    .select("id, created_at, sku, lat, lng, accuracy")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return <div style={{ padding: 24 }}>DB 오류: {error.message}</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 22 }}>회수 요청 목록</h1>

      <div style={{ marginTop: 12, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f7f7f7" }}>
            <tr>
              <th style={th}>시간</th>
              <th style={th}>제품</th>
              <th style={th}>좌표</th>
              <th style={th}>정확도(m)</th>
              <th style={th}>지도</th>
            </tr>
          </thead>
          <tbody>
            {(data || []).map((r) => {
              const mapUrl = `https://www.google.com/maps?q=${r.lat},${r.lng}`;
              return (
                <tr key={r.id}>
                  <td style={td}>{new Date(r.created_at).toLocaleString("ko-KR")}</td>
                  <td style={td}>{r.sku}</td>
                  <td style={td}>
                    {Number(r.lat).toFixed(6)}, {Number(r.lng).toFixed(6)}
                  </td>
                  <td style={td}>{r.accuracy ?? "-"}</td>
                  <td style={td}>
                    <a href={mapUrl} target="_blank" rel="noreferrer">열기</a>
                  </td>
                </tr>
              );
            })}
            {(!data || data.length === 0) && (
              <tr>
                <td style={td} colSpan={5}>아직 요청이 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e5e5" };
const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0", verticalAlign: "top" };
