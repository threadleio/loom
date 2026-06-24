"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

// What the row links to + what the call-to-action says, per lifecycle state.
function action(e: EventItem): { label: string; href: string } {
  if (e.status === "live") return { label: "Open Stage", href: `/event/${e.id}/present?control=1` };
  if (e.status === "draft") return { label: "Set up", href: `/event/${e.id}/host` };
  return { label: "Results", href: `/event/${e.id}/analytics` };
}

const ORDER = ["live", "draft", "ended", "archived"];
const SECTION_LABEL: Record<string, string> = {
  live: "Live",
  draft: "Drafts",
  ended: "Ended",
  archived: "Archived",
};

export default function EventsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/events")
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents);
  }, [status]);

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
      setCreating(false);
    }
  }

  async function deleteEvent(e: EventItem) {
    if (!window.confirm(`Delete "${e.name}"? This removes its polls, questions, and results, and cannot be undone.`)) return;
    const res = await fetch(`/api/events/${e.id}`, { method: "DELETE" });
    if (res.ok) setEvents((prev) => (prev || []).filter((x) => x.id !== e.id));
  }

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
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 28, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>My Events</h1>
              <p style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 4 }}>HOST DASHBOARD</p>
            </div>
            <button onClick={createEvent} disabled={creating} className="transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "10px 18px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", cursor: creating ? "default" : "pointer" }}>
              {creating ? "Creating…" : "+ Create Event"}
            </button>
          </div>

          {events === null ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-16 text-center" style={{ color: "var(--muted)" }}>
              <p className="text-lg" style={{ fontFamily: "var(--display)", fontWeight: 800 }}>No events yet</p>
              <p className="text-sm" style={{ fontFamily: "var(--body)" }}>Hit “Create Event” to start your first live room.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map((g) => (
                <div key={g.status}>
                  <h2 style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 10 }}>
                    {SECTION_LABEL[g.status]} ({g.items.length})
                  </h2>
                  <div className="space-y-2">
                    {g.items.map((e) => {
                      const a = action(e);
                      return (
                        <div key={e.id} className="flex items-stretch" style={{ background: "var(--card)", border: e.status === "live" ? "2px solid var(--accent2)" : "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
                          <Link href={a.href} className="flex items-center gap-4 flex-1 min-w-0 transition-opacity hover:opacity-90" style={{ padding: "14px 18px", textDecoration: "none" }}>
                            <div className="flex-1 min-w-0">
                              <div style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{e.name}</div>
                              <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", marginTop: 3 }}>{e.accessCode} &middot; {new Date(e.createdAt).toLocaleDateString()}</div>
                            </div>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 999, background: STATUS_META[e.status]?.bg, color: STATUS_META[e.status]?.fg }}>
                              {STATUS_META[e.status]?.label || e.status}
                            </span>
                            <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 12, color: "var(--accent)", flexShrink: 0 }}>{a.label} &rarr;</span>
                          </Link>
                          <button onClick={() => deleteEvent(e)} title={`Delete ${e.name}`} aria-label={`Delete ${e.name}`} className="transition-colors hover:opacity-100" style={{ flexShrink: 0, padding: "0 16px", border: "none", borderLeft: "1px solid var(--line)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 15 }}>
                            🗑
                          </button>
                        </div>
                      );
                    })}
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
