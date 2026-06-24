"use client";

interface AppHeaderProps {
  participantCount?: number;
  joinCode?: string;
  showSkinSwitcher?: boolean;
}

export function AppHeader({
  participantCount,
  joinCode,
}: AppHeaderProps) {
  return (
    <header
      className="flex-none flex items-center justify-between gap-5"
      style={{
        padding: "14px 26px",
        borderBottom: "var(--card-border)",
        background: "var(--surface)",
      }}
    >
      {/* Left: logo + wordmark */}
      <div className="flex items-center gap-[14px] min-w-0">
        <div
          className="flex-none flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            borderRadius: "calc(var(--radius-sm) * .8)",
            background: "var(--accent)",
            boxShadow: "var(--logo-shadow)",
          }}
        >
          <div
            style={{
              width: 15,
              height: 15,
              border: "3px solid var(--on-accent)",
              borderRadius: 6,
            }}
          />
        </div>
        <div className="min-w-0">
          <div
            style={{
              fontFamily: "var(--display)",
              fontWeight: 800,
              fontStyle: "var(--hi-style)",
              fontSize: 19,
              letterSpacing: "var(--hi-spacing)",
              textTransform: "var(--case)" as React.CSSProperties["textTransform"],
              lineHeight: 1,
              color: "var(--ink)",
            }}
          >
            Loom
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: "10.5px",
              color: "var(--muted)",
              letterSpacing: ".04em",
              marginTop: 3,
            }}
          >
            live rooms
          </div>
        </div>
      </div>

      {/* Right: live pill + join code + skin swatches */}
      <div className="flex items-center gap-[18px]">
        {participantCount != null && (
          <div
            className="flex items-center gap-[9px]"
            style={{
              padding: "7px 13px",
              border: "var(--card-border)",
              borderRadius: 999,
              background: "var(--bg2)",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent3)",
                animation: "loomPulse 1.6s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink)",
              }}
            >
              {participantCount}
            </span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10.5px",
                color: "var(--muted)",
              }}
            >
              in room
            </span>
          </div>
        )}

        {joinCode && (
          <div className="text-right">
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--muted)",
                letterSpacing: ".06em",
              }}
            >
              JOIN CODE
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--accent2)",
                letterSpacing: ".18em",
              }}
            >
              {joinCode}
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
