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
  const [creating, setCreating] = useState(false);

  const isHost = (session?.user as { role?: string } | undefined)?.role === "host";

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
      const result = await signIn("guest", { displayName: guestName, redirect: false });
      if (result?.error) {
        setError("Failed to create guest session");
        setLoading(false);
        return;
      }
    }

    await doJoin();
    setLoading(false);
  }

  // One click → a live room. Configure later, in place.
  async function createEvent() {
    setCreating(true);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.ok) {
      const ev = await res.json();
      router.push(`/event/${ev.id}/host`);
    } else {
      setError("Could not create an event. Are you signed in as a host?");
      setCreating(false);
    }
  }

  // The submit is "waiting" (neutral) until the current step's field is filled,
  // rather than rendering as a washed-out accent that reads as broken.
  const fieldEmpty =
    (step === "code" && !code) ||
    (step === "name" && !guestName) ||
    (step === "passcode" && !passcode);

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "11px",
    color: "var(--muted)",
    letterSpacing: ".06em",
    textTransform: "uppercase",
  };
  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--body)",
    padding: "14px 20px",
    border: "var(--card-border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg)",
    color: "var(--ink)",
    outline: "none",
  };

  const joinCard = (
    <div
      className="w-full max-w-md p-8"
      style={{ background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}
    >
      <form onSubmit={handleJoin} className="space-y-4">
        {step === "code" && (
          <div>
            <label className="block mb-1" style={labelStyle}>Enter event code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC123"
              className="w-full text-center text-2xl font-bold tracking-widest"
              style={{ ...inputStyle, fontFamily: "var(--mono)", padding: "16px 20px" }}
              maxLength={8}
              required
            />
          </div>
        )}

        {step === "name" && !session && (
          <div>
            <label className="block mb-1" style={labelStyle}>Your display name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full text-center text-xl"
              style={inputStyle}
              required
              autoFocus
            />
            <button type="button" onClick={() => setStep("code")} className="mt-2 text-sm cursor-pointer" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>
              &larr; Back to code
            </button>
          </div>
        )}

        {step === "passcode" && (
          <div>
            <label className="block mb-1" style={labelStyle}>Event passcode</label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className="w-full text-center text-xl"
              style={inputStyle}
              required
              autoFocus
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-center" style={{ color: "var(--accent2)" }}>{error}</p>
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

      {session && !isHost && (
        <p className="mt-3 text-center text-sm" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>
          Joining as <span style={{ fontWeight: 600, color: "var(--ink)" }}>{session.user.name}</span>
        </p>
      )}
    </div>
  );

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
              fontSize: 44,
              letterSpacing: "var(--hi-spacing)",
              textTransform: "var(--case)" as React.CSSProperties["textTransform"],
              color: "var(--ink)",
              lineHeight: 1.05,
            }}
          >
            Ask your room anything.
          </h1>
          <p className="mt-3" style={{ fontFamily: "var(--body)", fontSize: 17, color: "var(--muted)" }}>
            Live polls, quizzes, and Q&amp;A — on the big screen, from every phone.
          </p>
        </div>

        {isHost ? (
          <div className="w-full max-w-md flex flex-col items-center">
            <button
              onClick={createEvent}
              disabled={creating}
              className="w-full transition-opacity hover:opacity-90"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 18,
                padding: "16px",
                border: "none",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "var(--on-accent)",
                cursor: creating ? "default" : "pointer",
                boxShadow: "var(--card-shadow)",
              }}
            >
              {creating ? "Creating…" : "＋ Create Event"}
            </button>

            <Link href="/events" className="mt-3 transition-opacity hover:opacity-80" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
              My Events
            </Link>

            {error && <p className="mt-3 text-sm text-center" style={{ color: "var(--accent2)" }}>{error}</p>}

            <details className="mt-10 w-full max-w-md">
              <summary className="cursor-pointer text-center" style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", letterSpacing: ".04em" }}>
                Joining a session instead? Enter a code
              </summary>
              <div className="mt-4 flex justify-center">{joinCard}</div>
            </details>
          </div>
        ) : (
          <>
            {joinCard}
            <div className="mt-8 text-sm">
              <Link href="/login" className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: "var(--radius-sm)", background: "var(--surface)", border: "var(--card-border)", boxShadow: "var(--card-shadow)", color: "var(--accent)", textDecoration: "none" }}>
                Host? Sign in to create events
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
