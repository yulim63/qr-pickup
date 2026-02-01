"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { PRODUCTS } from "@/lib/products";

export default function ProductClient({ sku }: { sku: string }) {
  const upper = (sku || "").toUpperCase();

  // ✅ ms108_KDA0001 -> baseSku=MS108, itemNo=KDA0001
  const [baseSku, itemNoRaw] = upper.split("_", 2);
  const itemNo = itemNoRaw ? itemNoRaw.trim() : "";

  const product = useMemo(() => PRODUCTS[baseSku], [baseSku]);

  const [status, setStatus] = useState<string>("");
  const [sending, setSending] = useState(false);

  // ✅ 이 화면에서 한번 신청하면 "신청완료"로 끝 (새로 들어오면 다시 신청 가능)
  const [submitted, setSubmitted] = useState(false);

  // 지도 표시용
  const [lastCoord, setLastCoord] = useState<{ lat: number; lng: number; acc?: number } | null>(null);

  if (!product) {
    return (
      <div style={{ padding: 24, fontFamily: "system-ui" }}>
        <h2>제품을 찾을 수 없습니다</h2>
        <div>QR 코드가 올바른지 확인해 주세요.</div>
        <div style={{ marginTop: 8, opacity: 0.7 }}>입력값: {upper}</div>
      </div>
    );
  }

  const requestPickup = async () => {
    if (sending || submitted) return;

    if (!navigator.geolocation) {
      setStatus("이 기기에서 위치 기능을 지원하지 않아요.");
      return;
    }

    const TARGET_ACCURACY_M = 30; // 필요하면 50으로 완화 가능
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
        sku: product.sku,            // ✅ base sku (MS108)
        itemNo: itemNo || null,      // ✅ 개별번호 (KDA0001)
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

      setStatus(`회수 요청 완료! (정확도 약 ${Math.round(pos.coords.accuracy)}m)`);
      setSubmitted(true);

      setLastCoord({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        acc: pos.coords.accuracy ?? undefined,
      });

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

      {/* ✅ 개별번호 표시 */}
      {itemNo && (
        <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 800 }}>
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

      <button
        onClick={requestPickup}
        disabled={sending || submitted}
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: 12,
          border: "none",
          fontSize: 16,
          fontWeight: 800,
          cursor: sending || submitted ? "not-allowed" : "pointer",
          opacity: submitted ? 0.7 : 1,
        }}
      >
        {submitted ? "신청완료" : sending ? "전송 중..." : "회수요청"}
      </button>

      {status && <div style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>{status}</div>}

      {/* ✅ 모바일에서도 지도 보이기: 미리보기(OSM) + 클릭은 구글지도 */}
      {lastCoord && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>
            내 위치 확인 (정확도 약 {lastCoord.acc ? Math.round(lastCoord.acc) : "-"}m)
          </div>

          <a
            href={`https://www.google.com/maps?q=${lastCoord.lat},${lastCoord.lng}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-block", marginBottom: 10, fontWeight: 700 }}
          >
            구글지도에서 열기
          </a>

          <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden" }}>
            <iframe
              title="map"
              width="100%"
              height="280"
              style={{ border: 0, display: "block" }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${lastCoord.lng - 0.002},${
                lastCoord.lat - 0.002
              },${lastCoord.lng + 0.002},${lastCoord.lat + 0.002}&layer=mapnik&marker=${lastCoord.lat},${
                lastCoord.lng
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
