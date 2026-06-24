"use client";

import { useSession, signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState<"code" | "name" | "passcode">("code");
  const [loading, setLoading] = useState(false);

  async function doJoin(): Promise<boolean> {
    const res = await fetch("/api/events/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), passcode: passcode.trim() || undefined }),
    });

    if (res.ok) {
      const { eventId } = await res.json();
      router.push(`/event/${eventId}`);
      return true;
    }

    const data = await res.json();
    if (data.requiresPasscode) {
      setStep("passcode");
      setError(passcode ? "Incorrect passcode" : "");
      return false;
    }
    setError(data.error || "Event not found");
    return false;
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!session && step === "code") {
      setStep("name");
      setLoading(false);
      return;
    }

    if (!session && step === "name") {
      const result = await signIn("guest", {
        displayName: guestName,
        redirect: false,
      });

      if (result?.error) {
        setError("Failed to create guest session");
        setLoading(false);
        return;
      }
    }

    await doJoin();
    setLoading(false);
  }

  // The submit is "waiting" (neutral) until the current step's field is filled,
  // rather than rendering as a washed-out accent that reads as broken.
  const fieldEmpty =
    (step === "code" && !code) ||
    (step === "name" && !guestName) ||
    (step === "passcode" && !passcode);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader showSkinSwitcher />

      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="mb-8 text-center">
          <h1
            style={{
              fontFamily: "var(--display)",
              fontWeight: 800,
              fontStyle: "var(--hi-style)",
              fontSize: 48,
              letterSpacing: "var(--hi-spacing)",
              textTransform: "var(--case)" as React.CSSProperties["textTransform"],
              color: "var(--ink)",
              lineHeight: 1,
            }}
          >
            Loom
          </h1>
          <p
            className="mt-3"
            style={{
              fontFamily: "var(--body)",
              fontSize: 17,
              color: "var(--muted)",
            }}
          >
            Interactive audience engagement for your meetings
          </p>
        </div>

        <div
          className="w-full max-w-md p-8"
          style={{
            background: "var(--card)",
            border: "var(--card-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <form onSubmit={handleJoin} className="space-y-4">
            {step === "code" && (
              <div>
                <label
                  className="block mb-1"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  Enter event code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC123"
                  className="w-full text-center text-2xl font-bold tracking-widest"
                  style={{
                    fontFamily: "var(--mono)",
                    padding: "16px 20px",
                    border: "var(--card-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    outline: "none",
                  }}
                  maxLength={8}
                  required
                />
              </div>
            )}

            {step === "name" && !session && (
              <div>
                <label
                  className="block mb-1"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  Your display name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full text-center text-xl"
                  style={{
                    fontFamily: "var(--body)",
                    padding: "14px 20px",
                    border: "var(--card-border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    outline: "none",
                  }}
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setStep("code")}
                  className="mt-2 text-sm cursor-pointer"
                  style={{ fontFamily: "var(--body)", color: "var(--muted)" }}
                >
                  &larr; Back to code
                </button>
              </div>
            )}

            {step === "passcode" && (
              <div>
                <label
                  className="block mb-1"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "11px",
                    color: "var(--muted)",
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                  }}
                >
                  Event passcode
                </label>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode"
                  className="w-full text-center text-xl"
                  style={{
                    fontFamily: "var(--body)",
                    padding: "14px 20px",
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
            )}

            {error && (
              <p className="text-sm text-center" style={{ color: "var(--accent2)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || fieldEmpty}
              className="w-full transition-colors"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 16,
                padding: "14px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: fieldEmpty ? "var(--bg2)" : "var(--accent)",
                color: fieldEmpty ? "var(--muted)" : "var(--on-accent)",
                cursor: fieldEmpty ? "default" : "pointer",
              }}
            >
              {loading ? "Joining..." : step === "code" && !session ? "Next" : "Join Event"}
            </button>
          </form>

          {session && (
            <p
              className="mt-3 text-center text-sm"
              style={{ fontFamily: "var(--body)", color: "var(--muted)" }}
            >
              Joining as{" "}
              <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                {session.user.name}
              </span>
            </p>
          )}
        </div>

        <div className="mt-8 flex gap-4 text-sm">
          {session ? (
            <>
              <Link
                href="/create"
                className="transition-opacity hover:opacity-80"
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "10px 20px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)",
                  border: "var(--card-border)",
                  boxShadow: "var(--card-shadow)",
                  color: "var(--accent)",
                }}
              >
                Create Event
              </Link>
              <Link
                href="/events"
                className="transition-opacity hover:opacity-80"
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "10px 20px",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface)",
                  border: "var(--card-border)",
                  boxShadow: "var(--card-shadow)",
                  color: "var(--ink)",
                }}
              >
                My Events
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="transition-opacity hover:opacity-80"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: 14,
                padding: "10px 20px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface)",
                border: "var(--card-border)",
                boxShadow: "var(--card-shadow)",
                color: "var(--accent)",
              }}
            >
              Sign in to create events
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
