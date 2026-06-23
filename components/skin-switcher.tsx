"use client";

import { useTheme, type Theme } from "./theme-provider";

const skins: { key: Theme; color: string; label: string }[] = [
  { key: "loom", color: "#e2624a", label: "Loom \u00b7 warm" },
  { key: "arcade", color: "#ffd23f", label: "Arcade \u00b7 neon" },
  { key: "press", color: "#2746e0", label: "Press \u00b7 riso" },
];

export function SkinSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-[7px]">
      <span
        className="text-muted mr-[2px]"
        style={{
          fontFamily: "var(--mono)",
          fontSize: "9.5px",
          letterSpacing: ".08em",
        }}
      >
        SKIN
      </span>
      {skins.map((s) => {
        const active = s.key === theme;
        return (
          <button
            key={s.key}
            onClick={() => setTheme(s.key)}
            title={s.label}
            style={{
              width: 22,
              height: 22,
              borderRadius: 7,
              cursor: "pointer",
              background: s.color,
              border: active ? "2px solid var(--ink)" : "2px solid transparent",
              outline: active ? `2px solid ${s.color}` : "none",
              outlineOffset: 1,
              padding: 0,
              transition: "transform .15s",
              transform: active ? "scale(1.12)" : "scale(1)",
            }}
          />
        );
      })}
    </div>
  );
}
