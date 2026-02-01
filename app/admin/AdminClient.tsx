"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string | number;
  created_at: string;
  sku: string;
  item_no: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
};

export default function AdminClient({ initialRows }: { initialRows: Row[] }) {
  const [q, setQ] = useState("");

  const qNorm = q.trim().toUpperCase();

  const rows = useMemo(() => {
    if (!qNorm) return initialRows;

    return initialRows.filter((r) => {
      const sku = String(r.sku || "").toUpperCase();
      const item = String(r.item_no || "").toUpperCase();

      // ✅ 부분검색: K, KDA, 0001 등 모두 매칭
      return item.includes(qNorm) || sku.includes(qNorm);
    });
  }, [initialRows, qNorm]);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>회수 요청 목록</h1>

      {/* ✅ 검색 영역 */}
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="개별번호(KDA0001) / SKU(MS108) 검색 (예: K, KDA, 0001...)"
          style={{
            flex: "1 1 320px",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={() => setQ("")}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            background: "white",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          전체조회
        </button>

        <div style={{ fontSize: 13, opacity: 0.8 }}>
          {qNorm ? `검색결과 ${rows.length}건` : `총 ${initialRows.length}건`}
        </div>
      </div>

      {/* ✅ 카드 리스트 */}
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          return (
            <div
              key={String(r.id)}
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

              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>
                {r.sku}
                {r.item_no ? <span style={{ fontWeight: 800 }}> / {r.item_no}</span> : null}
              </div>

              <div style={{ marginTop: 6, fontSize: 13 }}>
                좌표: {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
              <div style={{ marginTop: 4, fontSize: 13 }}>정확도: {r.accuracy ?? "-"} m</div>

              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 800 }}
              >
                구글지도 열기
              </a>

              {/* 미리보기 지도(OSM) */}
              <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
                <iframe
                  title={`map-${String(r.id)}`}
                  width="100%"
                  height="260"
                  style={{ border: 0, display: "block" }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003},${lat - 0.003},${
                    lng + 0.003
                  },${lat + 0.003}&layer=mapnik&marker=${lat},${lng}`}
                />
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
