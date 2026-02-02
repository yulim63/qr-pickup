"use client";

import { useMemo, useState } from "react";

type Row = {
  id: string | number;
  created_at: string;

  sku: string;
  item_no: string | null;

  qty: number | null;

  load_status: string | null; // 'O' | 'X' | 'UNKNOWN'
  note: string | null;

  lat: number;
  lng: number;
  accuracy: number | null;

  address: string | null;

  photo_url: string | null;
};

function toKstDateKey(iso: string) {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`; // yyyy-mm-dd
}

function toKstLabel(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function statusLabel(v: string | null | undefined) {
  const u = String(v || "UNKNOWN").toUpperCase();
  if (u === "O") return "적재 O";
  if (u === "X") return "적재 X";
  return "알수없음";
}

function makeOsmEmbedSrc(lat: number, lng: number) {
  // ✅ 동네 수준 줌(새로고침해도 세계지도 안 뜨게)
  const d = 0.0045;

  const lat1 = (lat - d).toFixed(6);
  const lat2 = (lat + d).toFixed(6);
  const lng1 = (lng - d).toFixed(6);
  const lng2 = (lng + d).toFixed(6);

  return `https://www.openstreetmap.org/export/embed.html?layer=mapnik&bbox=${lng1},${lat1},${lng2},${lat2}&marker=${lat.toFixed(
    6
  )},${lng.toFixed(6)}`;
}

export default function AdminClient({ initialRows }: { initialRows: Row[] }) {
  // 검색
  const [qInput, setQInput] = useState("");
  const [qApplied, setQApplied] = useState("");

  // 필터
  const [skuFilter, setSkuFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // 사진 펼침 상태
  const [photoOpen, setPhotoOpen] = useState<Record<string, boolean>>({});

  const allSkus = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < initialRows.length; i++) {
      const s = String(initialRows[i]?.sku || "").toUpperCase();
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

  const computed = useMemo(() => {
    const q = qApplied.trim().toUpperCase();

    let rows = initialRows;

    // 제품 필터
    if (skuFilter !== "ALL") {
      const s = skuFilter.toUpperCase();
      rows = rows.filter((r) => String(r.sku || "").toUpperCase() === s);
    }

    // 날짜 필터(한국 날짜 기준)
    if (dateFrom) rows = rows.filter((r) => toKstDateKey(r.created_at) >= dateFrom);
    if (dateTo) rows = rows.filter((r) => toKstDateKey(r.created_at) <= dateTo);

    // 검색 필터 (개별번호 + 제품)
    if (q) {
      rows = rows.filter((r) => {
        const sku = String(r.sku || "").toUpperCase();
        const item = String(r.item_no || "").toUpperCase();
        return item.includes(q) || sku.includes(q);
      });
    }

    // 최신순 기본
    const sortDesc = (a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1);

    // 정확 일치(item_no === q) 상단 고정 + 하이라이트
    if (q) {
      const exact: Row[] = [];
      const rest: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        const item = String(rows[i].item_no || "").toUpperCase();
        if (item && item === q) exact.push(rows[i]);
        else rest.push(rows[i]);
      }
      exact.sort(sortDesc);
      rest.sort(sortDesc);
      return {
        rows: exact.concat(rest),
        qUpper: q,
        exactCount: exact.length,
      };
    }

    return { rows: rows.slice().sort(sortDesc), qUpper: "", exactCount: 0 };
  }, [initialRows, qApplied, skuFilter, dateFrom, dateTo]);

  const rows = computed.rows;
  const qUpper = computed.qUpper;
  const exactCount = computed.exactCount;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>회수 요청 목록</h1>

      {/* 검색/필터 영역 */}
      <div
        style={{
          marginTop: 12,
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          padding: 12,
        }}
      >
        {/* 검색바 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearch();
            }}
            placeholder="개별번호/제품 검색 (예: K, KDA0001, MS108...)"
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
            onClick={applySearch}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
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
        </div>

        {/* 드롭다운/날짜 */}
        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.85, minWidth: 42 }}>제품</div>
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

          <div style={{ fontSize: 13, opacity: 0.85, marginLeft: "auto" }}>
            {qApplied.trim()
              ? `검색결과 ${rows.length}건${exactCount ? ` (정확 일치 ${exactCount}건 상단)` : ""}`
              : `총 ${initialRows.length}건`}
          </div>
        </div>
      </div>

      {/* 리스트 */}
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {rows.map((r) => {
          const lat = Number(r.lat);
          const lng = Number(r.lng);
          const acc = r.accuracy == null ? null : Number(r.accuracy);

          const isLowAcc = acc != null && acc >= 100;

          const itemUpper = String(r.item_no || "").toUpperCase();
          const isExactHighlight = qUpper && itemUpper && itemUpper === qUpper;

          const qty = r.qty && Number(r.qty) > 0 ? Number(r.qty) : 1;

          const idKey = String(r.id);
          const hasPhoto = !!r.photo_url;
          const isPhotoOpen = !!photoOpen[idKey];

          return (
            <div
              key={idKey}
              style={{
                border: isExactHighlight ? "2px solid #111" : "1px solid #e5e5e5",
                borderRadius: 12,
                padding: 12,
                background: isExactHighlight ? "#fafafa" : "white",
              }}
            >
              {/* 상단 라인 */}
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

              {/* 타이틀 */}
              <div style={{ marginTop: 6, fontSize: 16, fontWeight: 900 }}>
                {String(r.sku || "").toUpperCase()}
                {r.item_no ? <span style={{ fontWeight: 800 }}> / {r.item_no}</span> : null}
              </div>

              {/* 정보 */}
              <div style={{ marginTop: 6, fontSize: 13 }}>상태: {statusLabel(r.load_status)}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>수량: {qty}</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                정확도: {acc == null ? "-" : `${Math.round(acc)} m`}
              </div>

              {/* ✅ 좌표 대신 주소 */}
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.92 }}>
                주소: {r.address ? r.address : "없음"}
              </div>

              {/* ✅ 비고 */}
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.92, whiteSpace: "pre-wrap" }}>
                비고: {r.note && r.note.trim() ? r.note : "-"}
              </div>

              {/* 지도 링크 */}
              {Number.isFinite(lat) && Number.isFinite(lng) && (
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 800 }}
                >
                  구글지도 열기
                </a>
              )}

              {/* 사진 버튼 */}
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  disabled={!hasPhoto}
                  onClick={() => {
                    if (!hasPhoto) return;
                    setPhotoOpen((prev) => ({ ...prev, [idKey]: !prev[idKey] }));
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e5e5e5",
                    background: hasPhoto ? "white" : "#f3f3f3",
                    fontWeight: 900,
                    cursor: hasPhoto ? "pointer" : "not-allowed",
                    opacity: hasPhoto ? 1 : 0.6,
                  }}
                >
                  {hasPhoto ? (isPhotoOpen ? "사진 접기" : "사진 펼치기") : "사진 없음"}
                </button>
              </div>

              {/* 사진 */}
              {hasPhoto && isPhotoOpen && (
                <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
                  <img src={r.photo_url!} alt="photo" style={{ width: "100%", display: "block" }} />
                </div>
              )}

              {/* 지도 */}
              {Number.isFinite(lat) && Number.isFinite(lng) && (
                <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
                  <iframe
                    title={`map-${idKey}`}
                    width="100%"
                    height="260"
                    style={{ border: 0, display: "block" }}
                    src={makeOsmEmbedSrc(lat, lng)}
                  />
                </div>
              )}
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
