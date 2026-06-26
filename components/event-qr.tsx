"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";

// A scannable QR for an event's join link. Generated client-side from the
// URL — no server round-trip, no storage, no external service.
export function EventQR({
  url,
  size = 128,
  download = false,
  code = "loom",
}: {
  url: string;
  size?: number;
  download?: boolean;
  code?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function downloadPng() {
    const canvas = ref.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${code}-join-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      {/* QR needs a light background + quiet zone to scan reliably. */}
      <div ref={ref} style={{ background: "#fff", padding: 10, borderRadius: 10, lineHeight: 0 }}>
        <QRCodeCanvas value={url} size={size} bgColor="#ffffff" fgColor="#0d0c12" level="M" marginSize={1} />
      </div>
      {download && (
        <button
          onClick={downloadPng}
          className="cursor-pointer transition-opacity hover:opacity-90"
          style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "5px 12px", borderRadius: 999, border: "var(--card-border)", background: "var(--bg2)", color: "var(--ink)" }}
        >
          ⬇ Download QR
        </button>
      )}
    </div>
  );
}
