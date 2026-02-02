"use client";

import { useEffect, useMemo, useState } from "react";

type LoadStatus = "O" | "X" | "UNKNOWN";

type PickupRow = {
  id: string;
  created_at: string;
  sku: string;
  item_no: string | null;
  qty: number | null;
  load_status: LoadStatus | null;
  note: string | null;

  lat: number | null;
  lng: number | null;
  accuracy: number | null;

  address: string | null;

  photo_url: string | null;
};

function fmtKST(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function makeGoogleLink(lat: number | null, lng: number | null) {
  if (!lat || !lng) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function makeGoogleEmbedSrc(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

function statusLabel(v: LoadStatus | null) {
  if (v === "O") return { text: "적재 O", bg: "#ecfff1", fg: "#166534" };
  if (v === "X") return { text: "적재 X", bg: "#ffecec", fg: "#b00020" };
  return { text: "알수없음", bg: "#f3f4f6", fg: "#374151" };
}

function accuracyPill(acc: number | null) {
  if (!acc || !Number.isFinite(acc)) return null;
  const bad = acc >= 100;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 1000,
        background: bad ? "#ffe1e1" : "#eef2ff",
        color: bad ? "#b00020" : "#1f2a6b",
        whiteSpace: "nowrap",
      }}
      title={bad ? "정확도 낮음(100m 이상)" : "정확도 양호"}
    >
      정확도 {Math.round(acc)}m
      {bad ? <span style={{ fontWeight: 1100 }}>⚠</span> : null}
    </span>
  );
}

export default function AdminClient() {
  const [rows, setRows] = useState<PickupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const [q, setQ] = useState("");
  const [skuFilter, setSkuFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");

  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);
  const [photoModalTitle, setPhotoModalTitle] = useState<string>("");

  const fetchList = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/list", { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "관리자 조회 실패");
      }
      const data = (await res.json()) as { rows: PickupRow[] };
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (e: any) {
      setErr(e?.message || "오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const skuOptions = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < rows.length; i++) s.add(String(rows[i].sku || "").toUpperCase());
    return ["ALL", ...Array.from(s).sort()];
  }, [rows]);

  const dateOptions = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < rows.length; i++) {
      const d = new Date(rows[i].created_at);
      if (Number.isNaN(d.getTime())) continue;
      const kst = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
      s.add(kst);
    }
    return ["ALL", ...Array.from(s).sort().reverse()];
  }, [rows]);

  const filtered = useMemo(() => {
    const text = (q || "").trim().toUpperCase();
    const out: PickupRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if (skuFilter !== "ALL" && String(r.sku || "").toUpperCase() !== skuFilter) continue;

      if (dateFilter !== "ALL") {
        const d = new Date(r.created_at);
        const kst = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        if (kst !== dateFilter) continue;
      }

      if (text) {
        const item = (r.item_no || "").toUpperCase();
        const sku = (r.sku || "").toUpperCase();
        const addr = (r.address || "").toUpperCase();
        const note = (r.note || "").toUpperCase();
        if (!(item.includes(text) || sku.includes(text) || addr.includes(text) || note.includes(text))) continue;
      }

      out.push(r);
    }

    // 검색 시 완전 일치 우선
    if (text) {
      out.sort((a, b) => {
        const aItem = (a.item_no || "").toUpperCase();
        const bItem = (b.item_no || "").toUpperCase();
        const aExact = aItem === text ? 1 : 0;
        const bExact = bItem === text ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else {
      out.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return out;
  }, [rows, q, skuFilter, dateFilter]);

  const exactMatchItem = useMemo(() => (q || "").trim().toUpperCase(), [q]);

  const openPhoto = (url: string, title: string) => {
    setPhotoModalTitle(title);
    setPhotoModalUrl(url);
  };

  const closePhoto = () => {
    setPhotoModalUrl(null);
    setPhotoModalTitle("");
  };

  return (
    <div className="wrap">
      <style jsx>{`
        :global(body) {
          background: #f6f7fb;
        }

        /* ✅ PC에서도 "모바일 느낌" 고정 */
        .wrap {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
          padding: 12px;
          font-family: system-ui;
          box-sizing: border-box;
        }

        .topBar {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(246, 247, 251, 0.9);
          backdrop-filter: blur(8px);
          padding: 10px 0 10px;
        }

        .title {
          font-size: 20px;
          font-weight: 1000;
          margin: 0 0 10px 0;
        }

        .toolbar {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .input,
        .select {
          width: 100%;
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          background: #fff;
          box-sizing: border-box;
        }

        .btn {
          width: 100%;
          padding: 11px 12px;
          border-radius: 12px;
          border: none;
          font-weight: 1000;
          cursor: pointer;
          background: #3b5bff;
          color: #fff;
        }

        .btn:disabled {
          background: #c9d3ff;
          cursor: not-allowed;
        }

        .err {
          margin-top: 10px;
          padding: 10px;
          border-radius: 12px;
          background: #ffecec;
          color: #b00020;
          font-weight: 900;
        }

        .list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-bottom: 18px;
        }

        .card {
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .cardHeader {
          padding: 12px 12px 10px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }

        .hLeft {
          display: grid;
          gap: 6px;
        }

        .hTitle {
          font-weight: 1000;
          font-size: 15px;
          line-height: 1.2;
        }

        .sub {
          font-size: 12px;
          opacity: 0.7;
        }

        .pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pill {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 1000;
          background: #f3f4f6;
          color: #374151;
          white-space: nowrap;
        }

        .body {
          padding: 0 12px 12px;
          display: grid;
          gap: 10px;
        }

        .kv {
          display: grid;
          gap: 6px;
          font-size: 13px;
          line-height: 1.45;
        }

        .kv b {
          font-weight: 1000;
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .actionBtn, .actionLink {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-weight: 1000;
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          color: #111827;
          flex: 1 1 auto;
          min-width: 120px;
        }

        .actionBtn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .mapBox {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          background: #fafafa;
        }

        .mapFrame {
          border: 0;
          display: block;
          width: 100%;
          height: 230px;
        }

        .highlight {
          background: #fff7cc;
        }
      `}</style>

      <div className="topBar">
        <h1 className="title">회수 요청 목록</h1>

        <div className="toolbar">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="개별번호/제품/주소/비고 검색 (예: KDA0001, K)"
          />

          <div className="row2">
            <select className="select" value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)}>
              {skuOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "제품 전체" : s}
                </option>
              ))}
            </select>

            <select className="select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
              {dateOptions.map((d) => (
                <option key={d} value={d}>
                  {d === "ALL" ? "날짜 전체" : d}
                </option>
              ))}
            </select>
          </div>

          <button className="btn" onClick={fetchList} disabled={loading}>
            {loading ? "로딩..." : "새로고침"}
          </button>

          {err ? <div className="err">{err}</div> : null}
        </div>
      </div>

      <div className="list">
        {filtered.map((r) => {
          const item = (r.item_no || "").toUpperCase();
          const isHighlight = exactMatchItem && item && item === exactMatchItem;

          const title = `${String(r.sku || "").toUpperCase()}${r.item_no ? ` / ${r.item_no}` : ""}`;
          const hasCoord = !!(r.lat && r.lng);

          const st = statusLabel(r.load_status);

          return (
            <div key={r.id} className={`card ${isHighlight ? "highlight" : ""}`}>
              <div className="cardHeader">
                <div className="hLeft">
                  <div className="hTitle">{title}</div>
                  <div className="pills">
                    <span className="pill" style={{ background: st.bg, color: st.fg }}>
                      {st.text}
                    </span>
                    <span className="pill">수량 {r.qty ?? 1}</span>
                    {accuracyPill(r.accuracy)}
                  </div>
                  <div className="sub">{fmtKST(r.created_at)}</div>
                </div>
              </div>

              <div className="body">
                <div className="kv">
                  <div>
                    <b>주소:</b> {r.address || "주소 없음"}
                  </div>
                  {r.note ? (
                    <div>
                      <b>비고:</b> {r.note}
                    </div>
                  ) : null}
                </div>

                {/* ✅ 액션 버튼 */}
                <div className="actions">
                  <a
                    className="actionLink"
                    href={makeGoogleLink(r.lat, r.lng) || "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{ pointerEvents: hasCoord ? "auto" : "none", opacity: hasCoord ? 1 : 0.45 }}
                  >
                    📍 지도 열기
                  </a>

                  <button
                    className="actionBtn"
                    onClick={() => r.photo_url && openPhoto(r.photo_url, title)}
                    disabled={!r.photo_url}
                    title={r.photo_url ? "사진 보기" : "사진 없음"}
                  >
                    🖼 {r.photo_url ? "사진보기" : "사진없음"}
                  </button>
                </div>

                {/* ✅ 지도 */}
                <div>
                  {hasCoord ? (
                    <div className="mapBox">
                      <iframe
                        key={`${r.lat},${r.lng}`}
                        title={`map-${r.id}`}
                        className="mapFrame"
                        src={makeGoogleEmbedSrc(r.lat as number, r.lng as number)}
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div style={{ padding: 12, borderRadius: 12, border: "1px dashed #ddd", opacity: 0.7 }}>
                      좌표 없음
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 20, borderRadius: 14, border: "1px dashed #ddd", textAlign: "center", opacity: 0.7 }}>
            조회 결과가 없습니다.
          </div>
        )}
      </div>

      {/* ✅ 사진 모달 (너가 '완벽'이라 한 버전 유지) */}
      {photoModalUrl && (
        <div
          onClick={closePhoto}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(920px, calc(100vw - 28px))",
              maxHeight: "calc(100vh - 28px)",
              background: "#fff",
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "12px 14px",
                borderBottom: "1px solid #eee",
                flex: "0 0 auto",
              }}
            >
              <div style={{ fontWeight: 1000, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {photoModalTitle}
              </div>
              <button
                onClick={closePhoto}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                  flex: "0 0 auto",
                }}
              >
                닫기
              </button>
            </div>

            <div style={{ padding: 14, overflow: "auto", flex: "1 1 auto" }}>
              <div
                style={{
                  width: "100%",
                  background: "#fafafa",
                  borderRadius: 12,
                  border: "1px solid #eee",
                  overflow: "hidden",
                }}
              >
                <img
                  src={photoModalUrl}
                  alt="photo"
                  style={{
                    width: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>

              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <a href={photoModalUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 900 }}>
                  원본 새창
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
