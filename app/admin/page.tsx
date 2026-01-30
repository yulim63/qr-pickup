export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  const rows = data || [];

  return (
    <div style={{ padding: 24, fontFamily: "system-ui" }}>
      <style>{`
        .desktopTable { display: block; }
        .mobileCards { display: none; }

        @media (max-width: 640px) {
          .desktopTable { display: none; }
          .mobileCards { display: block; }
        }
      `}</style>

      <h1 style={{ fontSize: 22, margin: 0 }}>회수 요청 목록</h1>
      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
        총 {rows.length}건
      </div>

      {/* ✅ PC용: 테이블 */}
      <div className="desktopTable" style={{ marginTop: 12, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f7f7f7" }}>
            <tr>
              <th style={th}>시간(KST)</th>
              <th style={th}>제품</th>
              <th style={th}>좌표</th>
              <th style={th}>정확도(m)</th>
              <th style={th}>지도</th>
              <th style={th}>미리보기</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lat = Number(r.lat);
              const lng = Number(r.lng);
              const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;

              return (
                <tr key={r.id}>
                  <td style={td}>
                    {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                  </td>
                  <td style={td}>{r.sku}</td>
                  <td style={td}>
                    {lat.toFixed(6)}, {lng.toFixed(6)}
                  </td>
                  <td style={td}>{r.accuracy ?? "-"}</td>
                  <td style={td}>
                    <a href={googleUrl} target="_blank" rel="noreferrer">
                      구글지도 열기
                    </a>
                  </td>
                  <td style={td}>
                    <div style={{ width: 260, border: "1px solid #e5e5e5", borderRadius: 10, overflow: "hidden" }}>
                      <iframe
                        title={`map-${r.id}`}
                        width="100%"
                        height="160"
                        style={{ border: 0, display: "block" }}
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003},${lat - 0.003},${lng + 0.003},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td style={td} colSpan={6}>
                  아직 요청이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ 모바일용: 카드 + 지도 미리보기(화면 안에서 보임) */}
      <div className="mobileCards" style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          return (
            <div
              key={r.id}
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
                background: "white",
              }}
            >
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                {new Date(r.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
              </div>

              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800 }}>
                {r.sku}
              </div>

              <div style={{ marginTop: 6, fontSize: 13 }}>
                좌표: {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>
                정확도: {r.accuracy ?? "-"} m
              </div>

              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 700 }}
              >
                구글지도 열기
              </a>

              <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
                <iframe
                  title={`map-m-${r.id}`}
                  width="100%"
                  height="240"
                  style={{ border: 0, display: "block" }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003},${lat - 0.003},${lng + 0.003},${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`}
                />
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
            아직 요청이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e5e5e5",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};
