"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

type Product = { name: string; img: string };
type LoadStatus = "O" | "X" | "UNKNOWN";

const PRODUCTS: Record<string, Product> = {
  BPS: { name: "BPS", img: "/products/BPS.jpg" },
  MS108: { name: "MS108", img: "/products/MS108.jpg" },
  MS112: { name: "MS112", img: "/products/MS112.jpg" },
};

type Props = {
  rawSku: string; // ex) "ms108_KDA0001"
};

function parseSku(rawSku: string) {
  const up = (rawSku || "").toUpperCase();
  const idx = up.indexOf("_");
  if (idx < 0) return { sku: up, itemNo: "" };
  return { sku: up.slice(0, idx), itemNo: up.slice(idx + 1) };
}

// ✅ JPG/PNG만, 긴변 1280px, JPEG 품질 0.75로 압축
async function compressImageToDataUrl(file: File): Promise<string> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) {
    throw new Error("JPG/PNG만 업로드 가능합니다.");
  }

  const img = document.createElement("img");
  const url = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = url;
    });

    const maxSide = 1280;
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    let nw = w;
    let nh = h;
    if (Math.max(w, h) > maxSide) {
      const scale = maxSide / Math.max(w, h);
      nw = Math.round(w * scale);
      nh = Math.round(h * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas error");

    ctx.drawImage(img, 0, 0, nw, nh);

    // PNG도 용량 줄이려고 JPEG로 통일
    let out = canvas.toDataURL("image/jpeg", 0.75);

    // 너무 크면 한번 더 낮춤
    const approxBytes = Math.floor((out.length * 3) / 4);
    if (approxBytes > 2.2 * 1024 * 1024) {
      out = canvas.toDataURL("image/jpeg", 0.6);
    }

    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function makeEmbedMap(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

export default function ProductClient({ rawSku }: Props) {
  const { sku, itemNo } = useMemo(() => parseSku(rawSku), [rawSku]);
  const product = useMemo(() => PRODUCTS[sku], [sku]);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ 요청 성공 후 현재 화면에서만 비활성화
  const [submitted, setSubmitted] = useState(false);

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [acc, setAcc] = useState<number | null>(null);

  const [address, setAddress] = useState<string>("");

  const [qty, setQty] = useState<number>(1);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("UNKNOWN");
  const [note, setNote] = useState<string>("");

  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoPreview, setPhotoPreview] = useState<string>("");

  const canSubmit = !!product;

  const getLocation = async () => {
    setMsg("");
    if (!navigator.geolocation) {
      setMsg("이 기기는 위치 기능을 지원하지 않습니다.");
      return;
    }

    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setAcc(pos.coords.accuracy ?? null);
    } catch {
      setMsg("위치권한이 거부되었습니다. 브라우저 설정에서 위치권한을 허용해주세요.");
    } finally {
      setBusy(false);
    }
  };

  const onPickPhoto = async (file: File | null) => {
    setMsg("");
    if (!file) return;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setPhotoDataUrl(dataUrl);
      setPhotoPreview(dataUrl);
    } catch (e: any) {
      setMsg(e?.message || "사진 처리 실패");
    }
  };

  const submit = async () => {
    setMsg("");
    if (!canSubmit) return;
    if (submitted) return;

    // 위치 없으면 먼저 가져오기
    if (!lat || !lng) {
      await getLocation();
      if (!lat || !lng) return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          itemNo: itemNo || null,
          qty,
          loadStatus,
          note,
          lat,
          lng,
          accuracy: acc,
          photoDataUrl: photoDataUrl || null,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "전송 실패");
      }

      const json = await res.json();
      if (typeof json?.address === "string") setAddress(json.address);

      setSubmitted(true); // ✅ 성공하면 현재 화면에서만 비활성화
      setMsg("✅ 신청 완료");
      setTimeout(() => setMsg(""), 2500);
    } catch (e: any) {
      setMsg(`전송 실패: ${e?.message || "오류"}`);
    } finally {
      setBusy(false);
    }
  };

  if (!product) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>제품을 찾을 수 없습니다</h1>
        <div style={{ opacity: 0.7 }}>가능한 코드: BPS, MS108, MS112</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 14, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <style jsx>{`
        .card {
          border: 1px solid #e8e8e8;
          border-radius: 18px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
        }
        .section {
          border: 1px solid #ededed;
          border-radius: 14px;
          padding: 12px;
          background: #fff;
        }
        .label {
          font-weight: 900;
          margin-bottom: 8px;
        }
        .input,
        .textarea {
          width: 100%;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .textarea {
          min-height: 90px;
          resize: none;
        }
        .primary {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: none;
          font-weight: 1000;
          font-size: 16px;
          color: #fff;
          background: ${busy || submitted ? "#c9d3ff" : "#3b5bff"};
          cursor: ${busy || submitted ? "not-allowed" : "pointer"};
        }
        .chip {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          background: #eef2ff;
          color: #1f2a6b;
        }
      `}</style>

      <div className="card">
        <div style={{ position: "relative", width: "100%", height: 260, background: "#f6f7f9" }}>
          <Image
            src={product.img}
            alt={product.name}
            fill
            style={{ objectFit: "contain" }}
            // ✅ 이미지가 진짜 404일 때 화면이 빈칸처럼 보이니까 메시지로 바로 감지
            onError={() => {
              setMsg("제품 이미지가 없습니다. public/products 경로 및 파일명을 확인하세요.");
            }}
          />
        </div>

        <div style={{ padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 1000 }}>{product.name}</div>
            {itemNo ? <span className="chip">{itemNo}</span> : null}
          </div>

          <div className="section">
            <div className="label">수량</div>
            <input
              className="input"
              type="number"
              min={1}
              max={999}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
              disabled={submitted}
            />
          </div>

          <div className="section">
            <div className="label">상태 확인</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="load"
                  checked={loadStatus === "O"}
                  onChange={() => setLoadStatus("O")}
                  disabled={submitted}
                />
                적재 O
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="load"
                  checked={loadStatus === "X"}
                  onChange={() => setLoadStatus("X")}
                  disabled={submitted}
                />
                적재 X
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="radio"
                  name="load"
                  checked={loadStatus === "UNKNOWN"}
                  onChange={() => setLoadStatus("UNKNOWN")}
                  disabled={submitted}
                />
                알수없음
              </label>
            </div>
          </div>

          <div className="section">
            <div className="label">비고</div>
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 100))}
              placeholder="최대 100글자 / 특이사항 및 연락처 등 입력"
              disabled={submitted}
            />
            <div style={{ textAlign: "right", opacity: 0.6, fontSize: 12 }}>{note.length}/100</div>
          </div>

          <div className="section">
            <div className="label">사진 첨부(선택)</div>

            {/* ✅ capture 없음: 갤러리/카메라 선택은 기기 기본 UI */}
            <input
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
              disabled={submitted}
            />

            {photoPreview ? (
              <div style={{ marginTop: 10, borderRadius: 12, overflow: "hidden", border: "1px solid #eee" }}>
                <img
                  src={photoPreview}
                  alt="preview"
                  style={{
                    width: "100%",
                    maxHeight: 240,
                    objectFit: "contain",
                    display: "block",
                    background: "#fafafa",
                  }}
                />
              </div>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.6, fontSize: 13 }}>사진 없음</div>
            )}
          </div>

          <div className="section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div className="label" style={{ marginBottom: 0 }}>
                위치
              </div>
              <button
                onClick={getLocation}
                disabled={busy || submitted}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  fontWeight: 900,
                  cursor: busy || submitted ? "not-allowed" : "pointer",
                }}
              >
                위치 가져오기
              </button>
            </div>

            {lat && lng ? (
              <>
                <div style={{ marginTop: 10, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
                  <iframe
                    title="map"
                    src={makeEmbedMap(lat, lng)}
                    width="100%"
                    height="220"
                    style={{ border: 0, display: "block" }}
                    loading="lazy"
                  />
                </div>
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                  정확도: {acc ? `${Math.round(acc)}m` : "-"}
                </div>
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  <b>주소:</b> {address ? address : "신청 후 자동 표시됩니다"}
                </div>
              </>
            ) : (
              <div style={{ marginTop: 10, opacity: 0.7, fontSize: 14 }}>위치를 가져오면 지도가 표시됩니다.</div>
            )}
          </div>

          <button className="primary" onClick={submit} disabled={busy || submitted || !canSubmit}>
            {submitted ? "신청완료" : "회수 요청"}
          </button>

          {msg ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: msg.startsWith("✅") ? "#ecfff1" : "#ffecec",
                color: msg.startsWith("✅") ? "#166534" : "#b00020",
                fontWeight: 800,
              }}
            >
              {msg}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ marginTop: 10, textAlign: "center", opacity: 0.45, fontSize: 12 }}>QR Pickup</div>
    </div>
  );
}
