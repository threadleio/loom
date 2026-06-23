"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { RoomSwitcher } from "@/components/room-switcher";

interface Analytics {
  eventName: string;
  totalParticipants: number;
  totalQuestions: number;
  totalVotes: number;
  totalPollResponses: number;
  engagementRate: number;
  questions: {
    content: string;
    author: string;
    votes: number;
    status: string;
    isAnonymous: boolean;
    createdAt: string;
  }[];
  polls: {
    title: string;
    type: string;
    status: string;
    totalResponses: number;
    options: { text: string; responses: number }[];
  }[];
}

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Analytics | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [eventStatus, setEventStatus] = useState<string>("");
  const [endedAt, setEndedAt] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((event) => {
        setEventStatus(event.status || "");
        setEndedAt(event.endedAt || null);
        if (event.rooms?.length) {
          setRooms(event.rooms);
          if (!activeRoomId) setActiveRoomId(event.rooms[0].id);
        }
      });
  }, [id, activeRoomId]);

  const fetchAnalytics = useCallback(() => {
    if (!activeRoomId) return;
    const roomQuery = activeRoomId ? `?roomId=${activeRoomId}` : "";
    fetch(`/api/events/${id}/analytics${roomQuery}`)
      .then((r) => r.json())
      .then(setData);
  }, [id, activeRoomId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  function downloadCsv() {
    if (!data) return;

    let csv = "Type,Content,Author,Votes/Responses,Status,Created At\n";
    for (const q of data.questions) {
      csv += `Question,"${q.content.replace(/"/g, '""')}","${q.author}",${q.votes},${q.status},${q.createdAt}\n`;
    }
    for (const p of data.polls) {
      csv += `Poll,"${p.title.replace(/"/g, '""')}",,${p.totalResponses},${p.status},\n`;
      for (const o of p.options) {
        csv += `Poll Option,"${o.text.replace(/"/g, '""')}",,${o.responses},,\n`;
      }
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.eventName.replace(/\s+/g, "_")}_analytics.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  const stats = [
    { label: "Participants", value: data.totalParticipants, color: "var(--accent)" },
    { label: "Questions", value: data.totalQuestions, color: "var(--accent2)" },
    { label: "Total Votes", value: data.totalVotes, color: "var(--accent3)" },
    { label: "Poll Responses", value: data.totalPollResponses, color: "var(--ink)" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader showSkinSwitcher />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 28, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>
                {data.eventName}
              </h1>
              <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: ".06em" }}>ANALYTICS</span>
                {eventStatus === "live" ? (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".05em", padding: "2px 8px", borderRadius: 999, background: "var(--bg2)", color: "var(--accent3)" }}>LIVE &middot; IN PROGRESS</span>
                ) : eventStatus ? (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: ".05em", padding: "2px 8px", borderRadius: 999, background: "var(--bg2)", color: "var(--accent2)" }}>FINAL{endedAt ? ` · ${new Date(endedAt).toLocaleDateString()}` : ""}</span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadCsv} className="cursor-pointer transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "9px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                Export to CSV
              </button>
              <Link href={`/event/${id}/host`} className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg2)", border: "var(--card-border)", color: "var(--ink)", textDecoration: "none" }}>
                Back to Host
              </Link>
            </div>
          </div>

          {/* Room switcher */}
          {rooms.length > 1 && (
            <div className="mb-4">
              <RoomSwitcher
                rooms={rooms}
                activeRoomId={activeRoomId}
                onRoomChange={(roomId) => setActiveRoomId(roomId)}
                eventId={id}
              />
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} style={{ padding: 20, background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 36, lineHeight: 1, color: s.color }}>{s.value}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 6 }}>{s.label.toUpperCase()}</div>
              </div>
            ))}
          </div>

          {/* Engagement rate */}
          <div className="mb-8" style={{ padding: 22, background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: ".06em" }}>ENGAGEMENT RATE</span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 24, color: "var(--accent)" }}>{data.engagementRate}%</span>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${data.engagementRate}%`, background: "var(--accent)", borderRadius: 999, transition: "width .8s ease" }} />
            </div>
          </div>

          {/* Poll results */}
          {data.polls.length > 0 && (
            <div className="mb-8" style={{ background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
              <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: ".06em" }}>POLL RESULTS</span>
              </div>
              <div style={{ padding: 22 }} className="space-y-6">
                {data.polls.map((p, pi) => {
                  const maxResp = Math.max(...p.options.map((o) => o.responses), 1);
                  const accents = ["var(--accent)", "var(--accent2)", "var(--accent3)", "var(--ink)"];
                  return (
                    <div key={pi}>
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{p.title}</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--bg2)", color: "var(--muted)", letterSpacing: ".04em" }}>{p.type.replace("_", " ")}</span>
                      </div>
                      {p.options.map((o, oi) => {
                        const pct = p.totalResponses > 0 ? Math.round((o.responses / p.totalResponses) * 100) : 0;
                        return (
                          <div key={oi} className="flex items-center gap-3 mb-2">
                            <span style={{ fontFamily: "var(--body)", fontSize: 14, color: "var(--ink)", width: 140, flexShrink: 0 }}>{o.text}</span>
                            <div className="flex-1" style={{ height: 14, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: accents[oi % accents.length], borderRadius: 999, minWidth: o.responses > 0 ? 4 : 0 }} />
                            </div>
                            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 13, color: "var(--ink)", width: 50, textAlign: "right" }}>{pct}%</span>
                          </div>
                        );
                      })}
                      <p style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", marginTop: 4 }}>{p.totalResponses} total responses</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Questions summary */}
          <div style={{ background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: ".06em" }}>ALL QUESTIONS ({data.questions.length})</span>
            </div>
            <div style={{ padding: 22 }} className="space-y-3">
              {data.questions.length === 0 ? (
                <p className="text-center py-4" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>No questions submitted</p>
              ) : (
                data.questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3" style={{ padding: "12px 14px", borderRadius: "var(--radius-sm)", border: "var(--card-border)", background: "var(--surface)" }}>
                    <div className="text-center flex-none" style={{ minWidth: 40 }}>
                      <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 18, color: "var(--accent2)" }}>{q.votes}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontFamily: "var(--body)", fontSize: 14, color: "var(--ink)", margin: 0 }}>{q.content}</p>
                      <p style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", margin: 0, marginTop: 3 }}>— {q.author} &middot; {q.status}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
