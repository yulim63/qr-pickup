"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";

function makeGoogleEmbedSrc(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 로드 실패"));
    };
    img.src = url;
  });
}

async function compressToJpegDataUrl(file: File): Promise<string> {
  const img = await loadImageFromFile(file);

  const w = img.width;
  const h = img.height;

  let newW = w;
  let newH = h;

  if (Math.max(w, h) > MAX_EDGE) {
    if (w >= h) {
      newW = MAX_EDGE;
      newH = Math.round((h * MAX_EDGE) / w);
    } else {
      newH = MAX_EDGE;
      newW = Math.round((w * MAX_EDGE) / h);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스 생성 실패");

  // 흰 배경(투명 PNG 대응)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, newW, newH);

  // @ts-ignore
  ctx.imageSmoothingEnabled = true;
  // @ts-ignore
  ctx.imageSmoothingQuality = "high";

  ctx.drawImage(img, 0, 0, newW, newH);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

function estimateDataUrlBytes(dataUrl: string) {
  const idx = dataUrl.indexOf("base64,");
  if (idx < 0) return 0;
  const b64 = dataUrl.slice(idx + 7);
  return Math.floor((b64.length * 3) / 4);
}

export default function ProductClient({ sku }: { sku: string }) {
  const upper = (sku || "").toUpperCase();
  const [baseSku, itemNoRaw] = upper.split("_", 2);
  const itemNo = itemNoRaw ? itemNoRaw.trim() : "";

  const product = useMemo(() => PRODUCTS[baseSku], [baseSku]);

  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [qty, setQty] = useState<number>(1);

  const [loadStatus, setLoadStatus] = useState<"O" | "X" | "UNKNOWN">("UNKNOWN");
  const [note, setNote] = useState<string>("");

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoInfo, setPhotoInfo] = useState<string>("");

  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; acc?: number } | null>(null);
  const [address, setAddress] = useState<string>("");

  if (!product) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>제품을 찾을 수 없습니다</h2>
        <div>QR 코드가 올바른지 확인해 주세요.</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>입력값: {upper}</div>
      </div>
    );
  }

  const onPickPhoto = async (file: File | null) => {
    try {
      setPhotoInfo("");
      setStatus("");

      if (!file) {
        setPhotoDataUrl(null);
        return;
      }

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setStatus("사진 파일만 업로드 가능합니다. (JPG/PNG/WebP)");
        setPhotoDataUrl(null);
        return;
      }

      setStatus("사진 압축 중...");

      const dataUrl = await compressToJpegDataUrl(file);

      const bytes = estimateDataUrlBytes(dataUrl);
      const kb = Math.round(bytes / 1024);
      setPhotoInfo(`압축 완료: 약 ${kb}KB`);

      setPhotoDataUrl(dataUrl);
      setStatus("");
    } catch (e: any) {
      setStatus(`사진 처리 실패: ${e?.message || "오류"}`);
      setPhotoDataUrl(null);
    }
  };

  const requestPickup = async () => {
    if (sending || submitted) return;

    if (!navigator.geolocation) {
      setStatus("이 기기에서 위치 기능을 지원하지 않아요.");
      return;
    }

    let qtySend = Number(qty);
    if (!Number.isFinite(qtySend) || qtySend <= 0) qtySend = 1;
    if (qtySend > 999) qtySend = 999;

    const noteSend = (note || "").trim().slice(0, 100);

    const TARGET_ACCURACY_M = 30;
    const MAX_WAIT_MS = 15000;

    setSending(true);
    setStatus("정확한 GPS 잡는 중... 잠시만요.");

    let done = false;
    let timer: any = null;
    let watchId: number | null = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };

    const send = async (pos: GeolocationPosition) => {
      const body = {
        sku: product.sku,
        itemNo: itemNo || null,
        qty: qtySend,
        loadStatus,
        note: noteSend,
        photoDataUrl: photoDataUrl || null,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };

      const res = await fetch("/api/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        setStatus(`전송 실패: ${t}`);
        return false;
      }

      const json = await res.json().catch(() => null);
      const addr = json?.address ? String(json.address) : "";

      setStatus(`회수 요청 완료! (정확도 약 ${Math.round(pos.coords.accuracy)}m)`);
      setSubmitted(true);

      setLastCoord({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy ?? undefined,
      });

      setAddress(addr);

      return true;
    };

    let lastPos: GeolocationPosition | null = null;

    timer = setTimeout(async () => {
      if (done) return;
      done = true;
      cleanup();

      if (lastPos) {
        setStatus("시간이 지나서 현재 측정값으로 전송합니다...");
        await send(lastPos);
      } else {
        setStatus("위치 측정 실패(시간 초과). 잠시 후 다시 시도해 주세요.");
      }

      setSending(false);
    }, MAX_WAIT_MS);

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        lastPos = pos;
        const acc = pos.coords.accuracy ?? 9999;
        setStatus(`위치 측정 중... (정확도 약 ${Math.round(acc)}m)`);

        if (!done && acc <= TARGET_ACCURACY_M) {
          done = true;
          cleanup();
          setStatus("정확도 기준 충족! 전송 중...");
          await send(pos);
          setSending(false);
        }
      },
      (err) => {
        cleanup();
        setSending(false);

        if (err.code === err.PERMISSION_DENIED) {
          setStatus("위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요.");
        } else {
          setStatus(`위치 확인 실패: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{product.name}</h1>

      {itemNo && (
        <div style={{ marginBottom: 10, fontSize: 14, fontWeight: 900 }}>
          개별번호: {itemNo}
        </div>
      )}

      <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #e5e5e5" }}>
        <Image
          src={product.image}
          alt={product.name}
          width={900}
          height={900}
          style={{ width: "100%", height: "auto" }}
        />
      </div>

      <p style={{ marginTop: 14, lineHeight: 1.5 }}>{product.message}</p>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>상태 확인</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" name="loadStatus" checked={loadStatus === "O"} onChange={() => setLoadStatus("O")} />
            적재 O
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" name="loadStatus" checked={loadStatus === "X"} onChange={() => setLoadStatus("X")} />
            적재 X
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              name="loadStatus"
              checked={loadStatus === "UNKNOWN"}
              onChange={() => setLoadStatus("UNKNOWN")}
            />
            알수없음
          </label>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>수량</div>
        <input
          type="number"
          min={1}
          max={999}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e5e5", fontSize: 14 }}
        />
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>비고</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 100))}
          maxLength={100}
          placeholder="최대 100글자 (특이사항 및 연락처 등 입력)"
          style={{
            width: "100%",
            minHeight: 80,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            fontSize: 14,
            resize: "vertical",
          }}
        />
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{note.length}/100</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>사진 첨부(선택) - JPG/PNG/WebP</div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />

        {photoInfo && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{photoInfo}</div>}

        {photoDataUrl && (
          <div style={{ marginTop: 8, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <img src={photoDataUrl} alt="preview" style={{ width: "100%", display: "block" }} />
          </div>
        )}
      </div>

      <button
        onClick={requestPickup}
        disabled={sending || submitted}
        style={{
          marginTop: 12,
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "none",
          fontSize: 16,
          fontWeight: 900,
          cursor: sending || submitted ? "not-allowed" : "pointer",
          opacity: submitted ? 0.7 : 1,
        }}
      >
        {submitted ? "신청완료" : sending ? "전송 중..." : "회수요청"}
      </button>

      {status && <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>{status}</div>}

      {submitted && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          주소: {address ? address : "주소 확인 중..."}
        </div>
      )}

      {lastCoord && Number.isFinite(lastCoord.lat) && Number.isFinite(lastCoord.lng) && (
        <div style={{ marginTop: 14 }}>
          <a
            href={`https://www.google.com/maps?q=${lastCoord.lat},${lastCoord.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginBottom: 10, fontWeight: 800 }}
          >
            구글지도 열기
          </a>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <iframe
              key={`${lastCoord.lat},${lastCoord.lng}`}
              title="map"
              width="100%"
              height="280"
              style={{ border: 0, display: "block" }}
              src={makeGoogleEmbedSrc(lastCoord.lat, lastCoord.lng)}
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
