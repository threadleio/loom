"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

export default function CreateEventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [passcode, setPasscode] = useState("");
  const [moderationEnabled, setModerationEnabled] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="animate-spin"
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "4px solid var(--track)",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center">
          <p className="mb-4" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>
            You must be signed in to create events.
          </p>
          <Link
            href="/login"
            style={{ fontFamily: "var(--display)", fontWeight: 700, color: "var(--accent)" }}
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate, passcode, moderationEnabled }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create event");
      setLoading(false);
      return;
    }

    const event = await res.json();
    router.push(`/event/${event.id}/host`);
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--body)",
    fontSize: 15,
    padding: "11px 14px",
    border: "var(--card-border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
    marginTop: 4,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--mono)",
    fontSize: "11px",
    color: "var(--muted)",
    letterSpacing: ".06em",
    textTransform: "uppercase",
    display: "block",
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader showSkinSwitcher />

      <div className="flex flex-1 items-center justify-center p-4">
        <div
          className="w-full max-w-lg p-8"
          style={{
            background: "var(--card)",
            border: "var(--card-border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <h1
            className="mb-6"
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
            Create New Event
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label style={labelStyle}>Event Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q2 All Hands"
                style={inputStyle}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Start Date</label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>End Date</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Passcode (optional)</label>
              <input
                type="text"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Leave empty for no passcode"
                style={inputStyle}
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <input
                type="checkbox"
                id="moderation"
                checked={moderationEnabled}
                onChange={(e) => setModerationEnabled(e.target.checked)}
                style={{ accentColor: "var(--accent)", width: 16, height: 16 }}
              />
              <label
                htmlFor="moderation"
                style={{
                  fontFamily: "var(--body)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--ink)",
                }}
              >
                Enable question moderation
              </label>
            </div>

            {error && (
              <p className="text-sm" style={{ color: "var(--accent)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full cursor-pointer transition-opacity disabled:opacity-50"
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 15,
                padding: "12px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
