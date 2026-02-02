"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";

type LoadStatus = "O" | "X" | "UNKNOWN";

const PRODUCTS: Record<string, { name: string; img: string; desc: string }> = {
  BPS: { name: "BPS", img: "/products/BPS.JPG", desc: "BPS 회수 요청" },
  MS108: { name: "MS108", img: "/products/MS108.JPG", desc: "MS108 회수 요청" },
  MS112: { name: "MS112", img: "/products/MS112.JPG", desc: "MS112 회수 요청" },
};

function parseSkuAndItem(raw: string) {
  const s = (raw || "").trim();
  const up = s.toUpperCase();

  // ms108_KDA0001 형태 지원: 첫 "_" 기준으로 분리
  const idx = up.indexOf("_");
  if (idx >= 0) {
    const sku = up.slice(0, idx);
    const item_no = s.slice(idx + 1).trim(); // 원문 케이스 유지하고 싶으면 원문에서 추출
    return { sku, item_no: item_no || null };
  }
  return { sku: up, item_no: null };
}

// ✅ 사용자 화면: 적재 X(초록), 적재 O(빨강)
function loadStatusChip(s: LoadStatus) {
  if (s === "X") return { text: "적재 X", bg: "#ecfff1", fg: "#166534" };
  if (s === "O") return { text: "적재 O", bg: "#ffecec", fg: "#b00020" };
  return { text: "알수없음", bg: "#eef2ff", fg: "#1f2a6b" };
}

async function compressImage(file: File, maxSide = 1280, quality = 0.75): Promise<Blob> {
  // jpg/png만
  const t = (file.type || "").toLowerCase();
  if (!(t.includes("jpeg") || t.includes("jpg") || t.includes("png"))) {
    throw new Error("JPG/PNG 형식만 업로드 가능합니다.");
  }

  const img = document.createElement("img");
  const url = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = url;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (!w || !h) throw new Error("이미지 크기 확인 실패");

    const scale = Math.min(1, maxSide / Math.max(w, h));
    const nw = Math.max(1, Math.round(w * scale));
    const nh = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("캔버스 생성 실패");

    ctx.drawImage(img, 0, 0, nw, nh);

    const outType = "image/jpeg"; // 통일(jpg)해서 용량 절감
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (!b) reject(new Error("이미지 압축 실패"));
          else resolve(b);
        },
        outType,
        quality
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Props = {
  sku: string; // page.tsx에서 넘겨준 params.sku
};

export default function ProductClient({ sku: rawSku }: Props) {
  const { sku, item_no } = useMemo(() => parseSkuAndItem(rawSku), [rawSku]);
  const product = PRODUCTS[sku];

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("UNKNOWN");
  const [note, setNote] = useState<string>("");

  // ✅ 수량: string으로 관리(0/공백 허용, 입력 막힘 해결)
  const [qtyText, setQtyText] = useState<string>("1");

  const parsedQty = useMemo(() => {
    const t = (qtyText ?? "").trim();
    if (t === "") return null;
    if (!/^\d+$/.test(t)) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return n;
  }, [qtyText]);

  const canSubmitQty = parsedQty !== null && parsedQty > 0;

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const photoPreviewUrlRef = useRef<string>("");

  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [address, setAddress] = useState<string>("");

  const handlePickPhoto = async (file: File | null) => {
    setMsg("");
    setPhotoFile(null);
    setPhotoPreview("");

    if (!file) return;

    const t = (file.type || "").toLowerCase();
    if (!(t.includes("jpeg") || t.includes("jpg") || t.includes("png"))) {
      setMsg("JPG/PNG 형식만 업로드 가능합니다.");
      return;
    }

    // 미리보기 URL 갱신
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = "";
    }
    const url = URL.createObjectURL(file);
    photoPreviewUrlRef.current = url;
    setPhotoPreview(url);
    setPhotoFile(file);
  };

  const requestLocation = async (): Promise<{ lat: number; lng: number; accuracy: number }> => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      throw new Error("이 기기/브라우저는 위치 기능을 지원하지 않습니다.");
    }

    return await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const la = pos.coords.latitude;
          const ln = pos.coords.longitude;
          const ac = pos.coords.accuracy;

          if (!Number.isFinite(la) || !Number.isFinite(ln)) {
            reject(new Error("좌표를 가져오지 못했습니다."));
            return;
          }
          resolve({ lat: la, lng: ln, accuracy: Number.isFinite(ac) ? ac : 0 });
        },
        (err) => {
          if (err.code === 1) reject(new Error("위치권한이 거부되었습니다. 브라우저 설정에서 위치권한을 허용해주세요."));
          else if (err.code === 2) reject(new Error("위치 정보를 가져올 수 없습니다(신호 불안정)."));
          else reject(new Error("위치 요청이 시간초과되었습니다."));
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0,
        }
      );
    });
  };

  const submit = async () => {
    setMsg("");

    if (!product) {
      setMsg("지원하지 않는 제품입니다.");
      return;
    }

    // ✅ 0 또는 공백이면 전송 불가
    if (!canSubmitQty) {
      setMsg("수량은 1 이상이어야 합니다.");
      return;
    }

    setSending(true);

    try {
      // ✅ 원클릭: 위치 먼저 받고 → 바로 전송
      const loc = await requestLocation();
      setLat(loc.lat);
      setLng(loc.lng);
      setAccuracy(loc.accuracy);

      // 사진이 있으면 압축해서 업로드(폼데이터)
      const form = new FormData();
      form.set("sku", sku);
      if (item_no) form.set("item_no", item_no);

      form.set("qty", String(parsedQty)); // number 확정이라 String 변환만
      form.set("load_status", loadStatus);
      form.set("note", (note || "").slice(0, 100));

      form.set("lat", String(loc.lat));
      form.set("lng", String(loc.lng));
      form.set("accuracy", String(loc.accuracy));

      if (photoFile) {
        const compressed = await compressImage(photoFile, 1280, 0.75);
        const ext = "jpg";
        const fname = `pickup_${sku}_${item_no ? item_no + "_" : ""}${Date.now()}.${ext}`;
        form.set("photo", compressed, fname);
      }

      const res = await fetch("/api/pickup", { method: "POST", body: form });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "전송 실패");
      }

      // 서버가 address 내려주면 표시
      const data = (await res.json()) as any;
      if (data?.row?.address) setAddress(String(data.row.address));
      else if (data?.address) setAddress(String(data.address));

      setSubmitted(true);
      setMsg("신청 완료!");
    } catch (e: any) {
      setMsg(e?.message || "오류");
    } finally {
      setSending(false);
    }
  };

  const mapEmbedSrc = useMemo(() => {
    if (!lat || !lng) return "";
    return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  }, [lat, lng]);

  if (!product) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui" }}>
        <h2 style={{ margin: 0 }}>제품을 찾을 수 없습니다</h2>
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          SKU: <b>{sku}</b>
        </div>
      </div>
    );
  }

  const st = loadStatusChip(loadStatus);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16, fontFamily: "system-ui" }}>
      <style jsx>{`
        .card {
          border: 1px solid #e5e5e5;
          border-radius: 16px;
          padding: 14px;
          background: #fff;
        }
        .btn {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: none;
          font-weight: 1000;
          cursor: pointer;
        }
        .input {
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #e5e5e5;
          font-size: 14px;
          box-sizing: border-box;
        }
        .label {
          display: block;
          font-weight: 900;
          margin-top: 12px;
          margin-bottom: 6px;
        }
        .chip {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 1000;
          white-space: nowrap;
        }
        .muted {
          opacity: 0.75;
        }
      `}</style>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 18, fontWeight: 1000 }}>
            {product.name}
            {item_no ? <span style={{ fontSize: 13, fontWeight: 900, marginLeft: 8, opacity: 0.7 }}>({item_no})</span> : null}
          </div>

          <span className="chip" style={{ background: st.bg, color: st.fg }} title="적재 상태">
            {st.text}
          </span>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #eee" }}>
            <Image
              src={product.img}
              alt={product.name}
              width={900}
              height={600}
              style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }}
              priority
            />
          </div>
          <div style={{ marginTop: 8, fontWeight: 900 }} className="muted">
            {product.desc}
          </div>
        </div>

        {/* ✅ 수량 */}
        <label className="label">수량</label>
        <input
          className="input"
          inputMode="numeric"
          pattern="[0-9]*"
          value={qtyText}
          onChange={(e) => {
            const next = e.target.value;
            // ✅ "" 또는 숫자만 허용(0 포함)
            if (next === "" || /^\d+$/.test(next)) setQtyText(next);
          }}
          onBlur={() => {
            // 빈값이면 1로 복구 (원하면 제거 가능)
            if ((qtyText ?? "").trim() === "") setQtyText("1");
          }}
          placeholder="예: 1 (0 또는 공백은 불가)"
          style={{
            border: `1px solid ${canSubmitQty ? "#e5e5e5" : "#ffb4b4"}`,
          }}
        />
        {!canSubmitQty && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#b00020", fontWeight: 900 }}>
            수량은 1 이상이어야 합니다.
          </div>
        )}

        {/* ✅ 적재 상태 */}
        <div className="label">상태 확인</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
            <input type="radio" name="load" checked={loadStatus === "O"} onChange={() => setLoadStatus("O")} />
            적재 O
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
            <input type="radio" name="load" checked={loadStatus === "X"} onChange={() => setLoadStatus("X")} />
            적재 X
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900 }}>
            <input type="radio" name="load" checked={loadStatus === "UNKNOWN"} onChange={() => setLoadStatus("UNKNOWN")} />
            알수없음
          </label>
        </div>

        {/* ✅ 비고 */}
        <label className="label">비고</label>
        <input
          className="input"
          value={note}
          maxLength={100}
          onChange={(e) => setNote(e.target.value)}
          placeholder="(최대 100글자) 특이사항 및 연락처 등 입력"
        />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65, textAlign: "right", fontWeight: 900 }}>
          {note.length}/100
        </div>

        {/* ✅ 사진 */}
        <label className="label">사진 첨부 (선택)</label>
        <input
          className="input"
          type="file"
          accept="image/*"
          // ✅ capture 속성 절대 넣지 않기(카메라 강제 방지)
          onChange={(e) => handlePickPhoto(e.target.files?.[0] || null)}
        />
        {photoPreview ? (
          <div style={{ marginTop: 10, borderRadius: 14, overflow: "hidden", border: "1px solid #eee", background: "#fafafa" }}>
            <img
              src={photoPreview}
              alt="preview"
              style={{
                width: "100%",
                maxHeight: 260,
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7, fontWeight: 900 }}>사진 없음</div>
        )}

        {/* ✅ 회수요청 버튼 */}
        <div style={{ marginTop: 14 }}>
          <button
            className="btn"
            onClick={submit}
            disabled={sending || submitted || !canSubmitQty}
            style={{
              background: sending || submitted || !canSubmitQty ? "#e5e7eb" : "#111827",
              color: sending || submitted || !canSubmitQty ? "#6b7280" : "#fff",
              cursor: sending || submitted || !canSubmitQty ? "not-allowed" : "pointer",
            }}
          >
            {submitted ? "신청완료" : sending ? "전송 중..." : "회수요청"}
          </button>

          {msg && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                background: msg.includes("완료") ? "#ecfff1" : "#ffecec",
                color: msg.includes("완료") ? "#166534" : "#b00020",
                fontWeight: 1000,
              }}
            >
              {msg}
            </div>
          )}
        </div>
      </div>

      {/* ✅ 지도/주소 */}
      <div style={{ marginTop: 14 }} className="card">
        <div style={{ fontWeight: 1000, marginBottom: 8 }}>현재 위치</div>

        {address ? (
          <div style={{ marginBottom: 8, fontWeight: 900, opacity: 0.85 }}>{address}</div>
        ) : (
          <div style={{ marginBottom: 8, fontWeight: 900, opacity: 0.6 }}>주소는 전송 후 자동 표시됩니다.</div>
        )}

        {lat && lng ? (
          <>
            <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.75, fontWeight: 900 }}>
              정확도: {accuracy ? `${Math.round(accuracy)}m` : "-"}
            </div>
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #eee" }}>
              <iframe title="map" src={mapEmbedSrc} style={{ width: "100%", height: 240, border: 0, display: "block" }} loading="lazy" />
            </div>
          </>
        ) : (
          <div style={{ padding: 14, borderRadius: 14, border: "1px dashed #ddd", opacity: 0.7, fontWeight: 900 }}>
            아직 위치 정보가 없습니다. 회수요청을 누르면 위치가 표시됩니다.
          </div>
        )}
      </div>
    </div>
  );
}
