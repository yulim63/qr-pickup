"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";

export default function ProductClient({ sku }: { sku: string }) {
  const upper = (sku || "").toUpperCase();
  const product = useMemo(() => PRODUCTS[upper], [upper]);

  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);

  if (!product) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>제품을 찾을 수 없습니다</h2>
        <div>QR 코드가 올바른지 확인해 주세요.</div>
      </div>
    );
  }

  const requestPickup = async () => {
    if (!navigator.geolocation) {
      setStatus("이 기기에서 위치 기능을 지원하지 않아요.");
      return;
    }

    setSending(true);
    setStatus("위치 확인 중...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setStatus("회수 요청 전송 중...");

          const body = {
            sku: product.sku,
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
            return;
          }

          setStatus("회수 요청 완료! 담당자가 위치를 확인합니다.");
        } catch (e: any) {
          setStatus(`오류: ${e?.message || "알 수 없음"}`);
        } finally {
          setSending(false);
        }
      },
      (err) => {
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
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>{product.name}</h1>

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

      <button
        onClick={requestPickup}
        disabled={sending}
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "none",
          fontSize: 16,
          fontWeight: 700,
          cursor: sending ? "not-allowed" : "pointer",
        }}
      >
        {sending ? "전송 중..." : "회수요청"}
      </button>

      {status && <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>{status}</div>}
    </div>
  );
}
