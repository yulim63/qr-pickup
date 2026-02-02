"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";

function makeOsmEmbedSrc(lat: number, lng: number) {
  // ✅ 동네 수준 줌(대략 700m~1km)
  const d = 0.0045;

  const lat1 = (lat - d).toFixed(6);
  const lat2 = (lat + d).toFixed(6);
  const lng1 = (lng - d).toFixed(6);
  const lng2 = (lng + d).toFixed(6);

  return `https://www.openstreetmap.org/export/embed.html?layer=mapnik&bbox=${lng1},${lat1},${lng2},${lat2}&marker=${lat.toFixed(
    6
  )},${lng.toFixed(6)}`;
}

export default function ProductClient({ sku }: { sku: string }) {
  const upper = (sku || "").toUpperCase();

  // ✅ ms108_KDA0001 → baseSku=MS108, itemNo=KDA0001
  const [baseSku, itemNoRaw] = upper.split("_", 2);
  const itemNo = itemNoRaw ? itemNoRaw.trim() : "";

  const product = useMemo(() => PRODUCTS[baseSku], [baseSku]);

  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // 수량(기본 1)
  const [qty, setQty] = useState<number>(1);

  // 사진(선택)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  // 지도/주소 표시용
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
    if (!file) {
      setPhotoDataUrl(null);
      return;
    }

    // 너무 큰 건 제한(대충 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatus("사진 용량이 너무 큽니다. 5MB 이하로 올려주세요.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const v = typeof reader.result === "string" ? reader.result : null;
      setPhotoDataUrl(v);
    };
    reader.readAsDataURL(file);
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
        photoDataUrl: photoDataUrl || null, // ✅ 선택
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
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
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
        <Image src={product.image} alt={product.name} width={900} height={900} style={{ width: "100%", height: "auto" }} />
      </div>

      <p style={{ marginTop: 14, lineHeight: 1.5 }}>{product.message}</p>

      {/* 수량 */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>수량</div>
        <input
          type="number"
          min={1}
          max={999}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e5e5",
            fontSize: 14,
          }}
        />
      </div>

      {/* 사진 첨부(선택) */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>사진 첨부(선택)</div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
        />

        {photoDataUrl && (
          <div style={{ marginTop: 8, border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            {/* 미리보기 */}
            <img src={photoDataUrl} alt="preview" style={{ width: "100%", display: "block" }} />
          </div>
        )}
      </div>

      {/* 버튼 */}
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

      {/* 주소 표시 */}
      {submitted && address && (
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          주소: {address}
        </div>
      )}

      {/* 지도 */}
      {lastCoord && Number.isFinite(lastCoord.lat) && Number.isFinite(lastCoord.lng) && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>
            내 위치 (정확도 약 {lastCoord.acc ? Math.round(lastCoord.acc) : "-"}m)
          </div>

          <a
            href={`https://www.google.com/maps?q=${lastCoord.lat},${lastCoord.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginBottom: 10, fontWeight: 800 }}
          >
            구글지도에서 열기
          </a>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <iframe title="map" width="100%" height="280" style={{ border: 0, display: "block" }} src={makeOsmEmbedSrc(lastCoord.lat, lastCoord.lng)} />
          </div>
        </div>
      )}
    </div>
  );
}
