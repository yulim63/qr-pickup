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

function accuracyBadge(acc: number | null) {
  if (!acc || !Number.isFinite(acc)) return null;
  const isBad = acc >= 100; // 100m 이상 빨간 배지
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: isBad ? "#ffdddd" : "#eef2ff",
        color: isBad ? "#b00020" : "#1f2a6b",
        marginLeft: 8,
        whiteSpace: "nowrap",
      }}
      title={isBad ? "정확도 낮음(100m 이상)" : "정확도 양호"}
    >
      {Math.round(acc)}m
    </span>
  );
}

function makeGoogleLink(lat: number | null, lng: number | null) {
  if (!lat || !lng) return "";
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function makeGoogleEmbedSrc(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

export default function AdminClient() {
  const [rows, setRows] = useState<PickupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  // 검색/필터
  const [q, setQ] = useState("");
  const [skuFilter, setSkuFilter] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL"); // YYYY-MM-DD (KST 기준)

  // 사진 모달
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
      const kst = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
      s.add(kst);
    }
    return ["ALL", ...Array.from(s).sort().reverse()];
  }, [rows]);

  const filtered = useMemo(() => {
    const text = (q || "").trim().toUpperCase();
    const fSku = skuFilter;

    const out: PickupRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      if (fSku !== "ALL" && String(r.sku || "").toUpperCase() !== fSku) continue;

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

        const hit =
          item.includes(text) || sku.includes(text) || addr.includes(text) || note.includes(text);
        if (!hit) continue;
      }

      out.push(r);
    }

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
    <div className="adminWrap">
      <style jsx>{`
        .adminWrap {
          width: 100%;
          max-width: 980px;
          margin: 0 auto;
          padding: 16px;
          font-family: system-ui;
          box-sizing: border-box;
        }

        /* ✅ 상단 검색/필터/버튼: 기본(데스크톱) */
        .toolbar {
          display: grid;
          grid-template-columns: 1fr 180px 180px 120px;
          gap: 10px;
          align-items: center;
          margin-bottom: 12px;
        }

        /* ✅ 태블릿 이하: 2열 */
        @media (max-width: 900px) {
          .adminWrap {
            max-width: 100%;
            padding: 12px;
          }
          .toolbar {
            grid-template-columns: 1fr 1fr;
          }
          .toolbar .search {
            grid-column: 1 / -1; /* 검색은 한 줄 전체 */
          }
          .toolbar .refresh {
            grid-column: 1 / -1; /* 새로고침도 한 줄 전체 */
          }
        }

        /* ✅ 모바일: 1열(꼬임/오버플로우 방지) */
        @media (max-width: 520px) {
          .toolbar {
            grid-template-columns: 1fr;
          }
          .toolbar .search,
          .toolbar .sku,
          .toolbar .date,
          .toolbar .refresh {
            grid-column: auto;
          }
        }

        .input,
        .select {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e5e5e5;
          font-size: 14px;
          background: #fff;
          box-sizing: border-box;
        }

        .btn {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          font-weight: 900;
          cursor: pointer;
        }

        .card {
          border: 1px solid #e5e5e5;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
        }

        .mapBox {
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          overflow: hidden;
        }

        .mapFrame {
          border: 0;
          display: block;
          width: 100%;
          height: 240px;
        }

        @media (max-width: 520px) {
          .mapFrame {
            height: 220px;
          }
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 10px;
          margin-bottom: 10px; /* ✅ 지도 위에 버튼이 오게 여유 */
        }

        .actionBtn {
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid #e5e5e5;
          background: #fff;
          font-weight: 900;
          cursor: pointer;
        }

        .link {
          font-weight: 900;
          text-decoration: none;
        }
      `}</style>

      <h1 style={{ fontSize: 22, marginBottom: 10 }}>회수 요청 목록</h1>

      <div className="toolbar">
        <input
          className="input search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="개별번호/제품/주소/비고 검색 (예: KDA0001, K)"
        />

        <select className="select sku" value={skuFilter} onChange={(e) => setSkuFilter(e.target.value)}>
          {skuOptions.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "제품 전체" : s}
            </option>
          ))}
        </select>

        <select className="select date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          {dateOptions.map((d) => (
            <option key={d} value={d}>
              {d === "ALL" ? "날짜 전체" : d}
            </option>
          ))}
        </select>

        <button className="btn refresh" onClick={fetchList} disabled={loading} style={{ cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "로딩..." : "새로고침"}
        </button>
      </div>

      {err && (
        <div style={{ marginBottom: 10, padding: 10, borderRadius: 10, background: "#ffecec", color: "#b00020" }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((r) => {
          const item = (r.item_no || "").toUpperCase();
          const isHighlight = exactMatchItem && item && item === exactMatchItem;

          const title = `${String(r.sku || "").toUpperCase()}${r.item_no ? ` / ${r.item_no}` : ""}`;
          const hasCoord = !!(r.lat && r.lng);

          return (
            <div key={r.id} className="card" style={{ background: isHighlight ? "#fff7cc" : "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 1000, fontSize: 16 }}>
                  {title}
                  {accuracyBadge(r.accuracy)}
                </div>
                <div style={{ opacity: 0.75, fontSize: 13 }}>{fmtKST(r.created_at)}</div>
              </div>

              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>
                <div><b>주소:</b> {r.address || "주소 없음"}</div>
                <div>
                  <b>수량:</b> {r.qty ?? 1}
                  <b style={{ marginLeft: 10 }}>상태:</b>{" "}
                  {r.load_status === "O" ? "적재 O" : r.load_status === "X" ? "적재 X" : "알수없음"}
                </div>
                {r.note ? <div><b>비고:</b> {r.note}</div> : null}
              </div>

              {/* ✅ 버튼을 지도 위로 이동 */}
              <div className="actions">
                <a
                  className="link"
                  href={makeGoogleLink(r.lat, r.lng) || "#"}
                  target="_blank"
                  rel="noreferrer"
                  style={{ pointerEvents: hasCoord ? "auto" : "none", opacity: hasCoord ? 1 : 0.45 }}
                >
                  구글지도 열기
                </a>

                <button
                  className="actionBtn"
                  onClick={() => r.photo_url && openPhoto(r.photo_url, title)}
                  disabled={!r.photo_url}
                  style={{
                    cursor: r.photo_url ? "pointer" : "not-allowed",
                    opacity: r.photo_url ? 1 : 0.45,
                  }}
                  title={r.photo_url ? "사진 보기" : "사진 없음"}
                >
                  {r.photo_url ? "사진보기" : "사진없음"}
                </button>
              </div>

              {/* ✅ 내장 지도 */}
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
          );
        })}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 20, borderRadius: 14, border: "1px dashed #ddd", textAlign: "center", opacity: 0.7 }}>
            조회 결과가 없습니다.
          </div>
        )}
      </div>

      {/* ✅ 사진 모달 (현재 완벽하다고 한 버전 유지) */}
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
