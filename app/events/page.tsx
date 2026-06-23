"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";

interface EventItem {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  live: { label: "Live", bg: "var(--accent2)", fg: "var(--on-accent)" },
  draft: { label: "Draft", bg: "var(--bg2)", fg: "var(--accent3)" },
  ended: { label: "Ended", bg: "var(--bg2)", fg: "var(--accent)" },
  archived: { label: "Archived", bg: "var(--bg2)", fg: "var(--muted)" },
};

const ORDER = ["live", "draft", "ended", "archived"];
const SECTION_LABEL: Record<string, string> = {
  live: "Live",
  draft: "Drafts",
  ended: "Ended",
  archived: "Archived",
};

export default function EventsPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<EventItem[] | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents);
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <AppHeader showSkinSwitcher />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p style={{ fontFamily: "var(--body)", fontSize: 16, color: "var(--muted)", marginBottom: 16 }}>Sign in to see your events.</p>
            <Link href="/login" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 20px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}>Sign In</Link>
          </div>
        </div>
      </div>
    );
  }

  const grouped = ORDER.map((s) => ({
    status: s,
    items: (events || []).filter((e) => e.status === s),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader showSkinSwitcher />
      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 28, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>My Events</h1>
              <p style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 4 }}>HOST DASHBOARD</p>
            </div>
            <Link href="/create" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "10px 18px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}>+ Create Event</Link>
          </div>

          {events === null ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted)" }}>
              <p className="text-lg" style={{ fontFamily: "var(--display)", fontWeight: 800 }}>No events yet</p>
              <p className="text-sm" style={{ fontFamily: "var(--body)" }}>Create your first event to get started.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map((g) => (
                <div key={g.status}>
                  <h2 style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
                    {SECTION_LABEL[g.status]} ({g.items.length})
                  </h2>
                  <div className="space-y-2">
                    {g.items.map((e) => (
                      <Link key={e.id} href={`/event/${e.id}/host`} className="flex items-center gap-4 transition-opacity hover:opacity-90" style={{ padding: "14px 18px", background: "var(--card)", border: e.status === "live" ? "2px solid var(--accent2)" : "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", textDecoration: "none" }}>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{e.name}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", marginTop: 3 }}>{e.accessCode} &middot; {new Date(e.createdAt).toLocaleDateString()}</div>
                        </div>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: STATUS_META[e.status]?.bg, color: STATUS_META[e.status]?.fg }}>
                          {STATUS_META[e.status]?.label || e.status}
                        </span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>Open &rarr;</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
