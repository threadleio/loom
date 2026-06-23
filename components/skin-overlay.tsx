"use client";

import { useTheme } from "./theme-provider";

export function SkinOverlay() {
  const { theme } = useTheme();

  if (theme === "arcade") {
    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px)",
          mixBlendMode: "overlay",
          zIndex: 50,
        }}
      />
    );
  }

  if (theme === "press") {
    return (
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          zIndex: 50,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
        }}
      />
    );
  }

  return null;
}
