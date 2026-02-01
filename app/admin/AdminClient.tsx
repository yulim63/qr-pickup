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

function toKstDateKey(iso: string) {
  // YYYY-MM-DD (KST 기준) 만들기
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toKstLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export default function AdminClient({ initialRows }: { initialRows: Row[] }) {
  // 🔎 입력값(타이핑)
  const [qInput, setQInput] = useState("");
  // 🔎 실제 적용되는 검색어(검색 버튼 누르거나 Enter 치면 세팅)
  const [qApplied, setQApplied] = useState("");

  // 필터
  const [skuFilter, setSkuFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState<string>(""); // YYYY-MM-DD

  const allSkus = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < initialRows.length; i++) {
      const s = String(initialRows[i].sku || "").toUpperCase();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [initialRows]);

  const applySearch = () => setQApplied(qInput.trim());
  const resetAll = () => {
    setQInput("");
    setQApplied("");
    setSkuFilter("ALL");
    setDateFrom("");
    setDateTo("");
  };

  const filtered = useMemo(() => {
    const q = qApplied.trim().toUpperCase();

    // 1) 필터링
    let rows = initialRows;

    if (skuFilter !== "ALL") {
      const skuU = skuFilter.toUpperCase();
      rows = rows.filter((r) => String(r.sku || "").toUpperCase() === skuU);
    }

    if (dateFrom) {
      rows = rows.filter((r) => toKstDateKey(r.created_at) >= dateFrom);
    }
    if (dateTo) {
      rows = rows.filter((r) => toKstDateKey(r.created_at) <= dateTo);
    }

    if (q) {
      rows = rows.filter((r) => {
        const sku = String(r.sku || "").toUpperCase();
        const item = String(r.item_no || "").toUpperCase();
        return item.includes(q) || sku.includes(q);
      });
    }

    // 2) “정확 일치(item_no)”면 맨 위로 올리기 + 하이라이트
    //    - item_no가 q와 완전 동일한 row들을 먼저
    //    - 그 다음 나머지 (created_at desc 유지하고 싶으면 여기서 정렬)
    if (q) {
      const exact: Row[] = [];
      const rest: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        const item = String(rows[i].item_no || "").toUpperCase();
        if (item && item === q) exact.push(rows[i]);
        else rest.push(rows[i]);
      }
      // 최신순 유지 (혹시 initialRows가 이미 최신순이면 이거 없어도 됨)
      const sortDesc = (a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1);
      exact.sort(sortDesc);
      rest.sort(sortDesc);

      return { rows: exact.concat(rest), qUpper: q, exactCount: exact.length };
    }

    // 검색어 없을 때도 최신순 유지
    const sortDesc = (a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1);
    const copy = rows.slice().sort(sortDesc);

    return { rows: copy, qUpper: "", exactCount: 0 };
  }, [initialRows, qApplied, skuFilter, dateFrom, dateTo]);

  const rows = filtered.rows;
  const qUpper = filtered.qUpper;
  const exactCount = filtered.exactCount;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 1040, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>회수 요청 목록</h1>

      {/* 상단 컨트롤 */}
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gap: 10,
          gridTemplateColumns: "1fr",
        }}
      >
        {/* 검색 영역 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            placeholder="개별번호(KDA0001) / SKU(MS108) 검색 (예: K, KDA, 0001...)"
            style={{
              flex: "1 1 360px",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            onClick={applySearch}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              background: "black",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            검색
          </button>

          <button
            onClick={resetAll}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e5e5",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            전체조회
          </button>

          <div style={{ fontSize: 13, opacity: 0.85 }}>
            {qApplied.trim()
              ? `검색결과 ${rows.length}건${exactCount ? ` (정확 일치 ${exactCount}건 상단 고정)` : ""}`
              : `총 ${initialRows.length}건`}
          </div>
        </div>

        {/* 드롭다운/날짜 필터 */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.85, minWidth: 46 }}>제품</div>
            <select
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
                fontSize: 14,
                background: "white",
              }}
            >
              <option value="ALL">전체</option>
              {allSkus.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>시작</div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
                fontSize: 14,
                background: "white",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>끝</div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e5e5",
                fontSize: 14,
                background: "white",
              }}
            />
          </div>

          {(skuFilter !== "ALL" || dateFrom || dateTo) && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              필터 적용 중
            </div>
          )}
        </div>
      </div>

      {/* 카드 리스트 */}
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const googleUrl = `https://www.google.com/maps?q=${lat},${lng}`;

          const acc = r.accuracy == null ? null : Number(r.accuracy);
          const isLowAcc = acc != null && acc >= 100;

          const itemUpper = String(r.item_no || "").toUpperCase();
          const isExactHighlight = qUpper && itemUpper && itemUpper === qUpper;

          return (
            <div
              key={String(r.id)}
              style={{
                border: isExactHighlight ? "2px solid #111" : "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
                background: isExactHighlight ? "#fafafa" : "white",
              }}
            >
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{toKstLabel(r.created_at)}</div>

                {isExactHighlight && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      border: "1px solid #111",
                      borderRadius: 999,
                      padding: "4px 10px",
                      background: "white",
                    }}
                  >
                    정확 일치
                  </span>
                )}

                {isLowAcc && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      borderRadius: 999,
                      padding: "4px 10px",
                      background: "#e53935",
                      color: "white",
                    }}
                  >
                    정확도 낮음 {Math.round(acc!)}m
                  </span>
                )}
              </div>

              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>
                {r.sku}
                {r.item_no ? <span style={{ fontWeight: 800 }}> / {r.item_no}</span> : null}
              </div>

              <div style={{ marginTop: 6, fontSize: 13 }}>
                좌표: {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>

              <div style={{ marginTop: 4, fontSize: 13 }}>
                정확도: {acc == null ? "-" : Math.round(acc)} m
              </div>

              <a
                href={googleUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 800 }}
              >
                구글지도 열기
              </a>

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
            검색/필터 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
