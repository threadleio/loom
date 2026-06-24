"use client";

import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function JoinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [guestName, setGuestName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [needsPasscode, setNeedsPasscode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      joinEvent();
    }
  }, [status]);

  async function joinEvent(passcodeValue?: string) {
    setLoading(true);
    const res = await fetch("/api/events/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, passcode: passcodeValue?.trim() || undefined }),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data.requiresPasscode) {
        setNeedsPasscode(true);
        setError(passcodeValue ? "Incorrect passcode" : "");
        setLoading(false);
        return;
      }
      setError(data.error || "Event not found");
      setLoading(false);
      return;
    }

    const { eventId } = await res.json();
    router.push(`/event/${eventId}`);
  }

  async function handleGuestJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const result = await signIn("guest", {
      displayName: guestName,
      redirect: false,
    });

    if (result?.error) {
      setError("Failed to create guest session");
      return;
    }

    await joinEvent();
  }

  async function handlePasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    await joinEvent(passcode);
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center">
          <div
            className="mb-4 mx-auto animate-spin"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "4px solid var(--track)",
              borderTopColor: "var(--accent)",
            }}
          />
          <p style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>
            Joining event...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-md p-8 text-center"
        style={{
          background: "var(--card)",
          border: "var(--card-border)",
          borderRadius: "var(--radius)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        <h1
          className="mb-2"
          style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontStyle: "var(--hi-style)",
            fontSize: 24,
            letterSpacing: "var(--hi-spacing)",
            textTransform: "var(--case)" as React.CSSProperties["textTransform"],
            color: "var(--ink)",
          }}
        >
          Join Event
        </h1>
        <p className="mb-6" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>
          Code:{" "}
          <span
            style={{
              fontFamily: "var(--mono)",
              fontWeight: 700,
              color: "var(--accent2)",
              letterSpacing: ".12em",
            }}
          >
            {code}
          </span>
        </p>

        {needsPasscode ? (
          <form onSubmit={handlePasscodeSubmit} className="space-y-4">
            <div>
              <label
                className="block mb-1 text-left"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                Enter event passcode
              </label>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Passcode"
                className="w-full"
                style={{
                  fontFamily: "var(--body)",
                  fontSize: 15,
                  padding: "13px 16px",
                  border: "var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  outline: "none",
                }}
                required
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--accent)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!passcode || loading}
              className="w-full cursor-pointer transition-opacity disabled:opacity-50"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 15,
                padding: "14px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              {loading ? "Joining..." : "Join Event"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleGuestJoin} className="space-y-4">
            <div>
              <label
                className="block mb-1 text-left"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  color: "var(--muted)",
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                Enter your name to join
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Your display name"
                className="w-full"
                style={{
                  fontFamily: "var(--body)",
                  fontSize: 15,
                  padding: "13px 16px",
                  border: "var(--card-border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  outline: "none",
                }}
                required
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--accent)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!guestName}
              className="w-full cursor-pointer transition-opacity disabled:opacity-50"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 15,
                padding: "14px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              Join as Guest
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
