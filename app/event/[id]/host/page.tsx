"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import { AppHeader } from "@/components/app-header";
import { RoomSwitcher } from "@/components/room-switcher";

interface EventData {
  id: string;
  name: string;
  accessCode: string;
  passcode?: string | null;
  moderationEnabled: boolean;
  createdAt: string;
  status: string;
  endedAt?: string | null;
  rooms: { id: string; name: string }[];
}

interface Question {
  id: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  voteCount: number;
  status: string;
  createdAt: string;
}

interface PollData {
  id: string;
  title: string;
  type: string;
  status: string;
  options: { id: string; text: string; order: number }[];
  totalResponses: number;
  timerSeconds: number;
  correctAnswer: string | null;
}

type Tab = "live" | "pending" | "archived" | "polls";

const btnStyle = (bg: string, color: string): React.CSSProperties => ({
  fontFamily: "var(--mono)",
  fontWeight: 700,
  fontSize: 11,
  padding: "6px 10px",
  borderRadius: "var(--radius-sm)",
  background: bg,
  color,
  border: "none",
  letterSpacing: ".02em",
  cursor: "pointer",
});

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--body)",
  fontSize: 14,
  padding: "10px 12px",
  border: "var(--card-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg)",
  color: "var(--ink)",
  outline: "none",
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "var(--mono)",
  fontSize: "10px",
  color: "var(--muted)",
  letterSpacing: ".06em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 4,
};

const STATUS_META: Record<string, { label: string; bg: string; fg: string; hint: string }> = {
  draft: { label: "Draft", bg: "var(--bg2)", fg: "var(--accent3)", hint: "Participants can't join yet — go live when you're ready." },
  live: { label: "Live", bg: "var(--accent2)", fg: "var(--on-accent)", hint: "Live now — share the code below." },
  ended: { label: "Ended", bg: "var(--bg2)", fg: "var(--accent)", hint: "Session ended — analytics are final." },
  archived: { label: "Archived", bg: "var(--bg2)", fg: "var(--muted)", hint: "Archived (read-only)." },
};

export default function HostPanel() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [event, setEvent] = useState<EventData | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [passcodeDraft, setPasscodeDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("polls");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<PollData[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");

  // Poll creation form
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollTitle, setPollTitle] = useState("");
  const [pollType, setPollType] = useState("multiple_choice");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [pollTimer, setPollTimer] = useState(30);
  const [pollCorrectIdx, setPollCorrectIdx] = useState(0);
  const [pollImageUrl, setPollImageUrl] = useState("");

  const roomQuery = activeRoomId ? `?roomId=${activeRoomId}` : "";

  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/questions${roomQuery}`);
    if (res.ok) setQuestions(await res.json());
  }, [id, roomQuery]);

  const fetchPending = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/questions/pending${roomQuery}`);
    if (res.ok) setPendingQuestions(await res.json());
  }, [id, roomQuery]);

  const fetchPolls = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/polls${roomQuery}`);
    if (res.ok) setPolls(await res.json());
  }, [id, roomQuery]);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((res) => res.json())
      .then((data: EventData) => {
        setEvent(data);
        setPasscodeDraft(data.passcode || "");
        if (!activeRoomId && data.rooms?.length) {
          setActiveRoomId(data.rooms[0].id);
        }
      });
  }, [id, activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    fetchQuestions();
    fetchPending();
    fetchPolls();
  }, [activeRoomId, fetchQuestions, fetchPending, fetchPolls]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-event", id);
    socket.on("question:new", () => { fetchQuestions(); fetchPending(); });
    socket.on("question:vote", () => fetchQuestions());
    socket.on("poll:response", () => fetchPolls());
    socket.on("poll:activated", () => fetchPolls());
    socket.on("poll:closed", () => fetchPolls());
    socket.on("event:status", (data: { status: string }) => setEvent((prev) => (prev ? { ...prev, status: data.status } : prev)));
    return () => {
      socket.emit("leave-event", id);
      socket.off("question:new");
      socket.off("question:vote");
      socket.off("poll:response");
      socket.off("poll:activated");
      socket.off("poll:closed");
      socket.off("event:status");
    };
  }, [id, fetchQuestions, fetchPending, fetchPolls]);

  async function moderateQuestion(questionId: string, status: string) {
    const res = await fetch(`/api/events/${id}/questions/${questionId}/moderate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const socket = getSocket();
      socket.emit("question:status", { eventId: id, roomId: activeRoomId, questionId, status });
      fetchQuestions();
      fetchPending();
    }
  }

  async function createPoll(e: React.FormEvent) {
    e.preventDefault();
    const opts = pollType === "word_cloud" ? [] : pollOptions.filter((o) => o.trim());
    if (!pollTitle.trim()) return;

    const res = await fetch(`/api/events/${id}/polls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: pollTitle,
        type: pollType,
        options: opts,
        imageUrl: pollImageUrl || undefined,
        timerSeconds: pollType === "quiz" ? pollTimer : undefined,
        correctAnswer: pollType === "quiz" ? undefined : undefined,
        roomId: activeRoomId || undefined,
      }),
    });

    if (res.ok) {
      const poll = await res.json();
      if (pollType === "quiz" && poll.options[pollCorrectIdx]) {
        await fetch(`/api/events/${id}/polls/${poll.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "draft" }),
        });
        await prismaSetCorrectAnswer(poll.id, poll.options[pollCorrectIdx].id);
      }
      setPollTitle("");
      setPollOptions(["", ""]);
      setPollImageUrl("");
      setShowPollForm(false);
      fetchPolls();
    }
  }

  async function prismaSetCorrectAnswer(pollId: string, optionId: string) {
    await fetch(`/api/events/${id}/polls/${pollId}/correct`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctAnswer: optionId }),
    });
  }

  // Enter flows to the next option (adding one if needed) instead of
  // submitting the form; Backspace on an empty field removes it.
  function handleOptionKey(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === pollOptions.length - 1 && pollOptions[i].trim()) {
        setPollOptions([...pollOptions, ""]);
      }
      requestAnimationFrame(() => optionRefs.current[i + 1]?.focus());
    } else if (e.key === "Backspace" && !pollOptions[i] && pollOptions.length > 2) {
      e.preventDefault();
      setPollOptions(pollOptions.filter((_, idx) => idx !== i));
      requestAnimationFrame(() => optionRefs.current[Math.max(0, i - 1)]?.focus());
    }
  }

  async function setPollStatus(pollId: string, status: string) {
    const res = await fetch(`/api/events/${id}/polls/${pollId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const socket = getSocket();
      if (status === "active") socket.emit("poll:activated", { eventId: id, roomId: activeRoomId, pollId });
      if (status === "closed") socket.emit("poll:closed", { eventId: id, roomId: activeRoomId, pollId });
      fetchPolls();
    }
  }

  async function showLeaderboard(pollId: string) {
    const res = await fetch(`/api/events/${id}/polls/${pollId}/leaderboard`);
    if (res.ok) {
      const leaderboard = await res.json();
      const socket = getSocket();
      socket.emit("poll:leaderboard", { eventId: id, roomId: activeRoomId, pollId, leaderboard });
    }
  }

  async function setEventStatus(newStatus: string) {
    if (newStatus === "live" && polls.length === 0 && !window.confirm("This event has no polls yet. Go live anyway? You can still add them once you're live.")) return;
    if (newStatus === "ended" && !window.confirm("End the event for everyone? Participants will no longer be able to join or respond.")) return;
    if (newStatus === "archived" && !window.confirm("Archive this event?")) return;
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      const updated = await res.json();
      setEvent((prev) => (prev ? { ...prev, status: updated.status, endedAt: updated.endedAt } : prev));
      getSocket().emit("event:status", { eventId: id, status: updated.status });
    }
  }

  async function patchEvent(data: Record<string, unknown>) {
    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setEvent((prev) => (prev ? { ...prev, ...updated } : prev));
    }
  }

  async function saveName() {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === event?.name) return;
    await patchEvent({ name: trimmed });
  }

  async function savePasscode() {
    if ((passcodeDraft.trim() || null) === (event?.passcode || null)) return;
    await patchEvent({ passcode: passcodeDraft.trim() });
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${event.accessCode}`;
  function copyLink() { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  const archivedQuestions = questions.filter((q) => q.status === "archived");
  const liveQuestions = questions.filter((q) => q.status !== "archived");

  const hasPolls = polls.length > 0;
  // A brand-new draft with nothing built yet: lead the host to add content,
  // and dim the actions (stage/projector/analytics, go live) that go nowhere.
  const isFirstRun = event.status === "draft" && !hasPolls;
  const tabItems: { key: Tab; label: string; count: number }[] = [
    { key: "live", label: "Questions", count: liveQuestions.length },
    ...(event.moderationEnabled ? [{ key: "pending" as const, label: "Review", count: pendingQuestions.length }] : []),
    { key: "archived", label: "Archived", count: archivedQuestions.length },
    { key: "polls", label: "Polls", count: polls.length },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader joinCode={event.accessCode} showSkinSwitcher />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-5xl">
          {/* Title + nav buttons */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              {editingName ? (
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="Live session"
                  style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 28, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0, background: "var(--bg)", border: "1.5px solid var(--accent)", borderRadius: "var(--radius-sm)", padding: "2px 10px", outline: "none", maxWidth: 420 }}
                />
              ) : (
                <h1
                  onClick={() => { setNameDraft(event.name); setEditingName(true); }}
                  title="Click to rename"
                  style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 28, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0, cursor: "text", display: "inline-flex", alignItems: "center", gap: 9 }}
                >
                  {event.name}
                  <span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 600 }}>✎</span>
                </h1>
              )}
              <p style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 4 }}>HOST PANEL</p>
            </div>
            <div className="flex gap-2 transition-opacity" style={{ opacity: isFirstRun ? 0.45 : 1 }} title={isFirstRun ? "Add a poll first — there's nothing to present yet" : undefined}>
              <Link href={`/event/${id}/present?control=1`} className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}>▶ Open Stage</Link>
              <Link href={`/event/${id}/present`} className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--body)", fontWeight: 700, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--ink)", color: "var(--surface)", textDecoration: "none" }}>Projector</Link>
              <Link href={`/event/${id}/analytics`} className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--accent3)", color: "var(--on-accent)", textDecoration: "none" }}>Analytics</Link>
              <Link href={`/event/${id}`} className="transition-opacity hover:opacity-80" style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 13, padding: "9px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg2)", border: "var(--card-border)", color: "var(--ink)", textDecoration: "none" }}>Participant View</Link>
            </div>
          </div>

          {/* Lifecycle bar */}
          <div className="mb-6 flex items-center justify-between flex-wrap gap-3" style={{ padding: "14px 18px", background: "var(--card)", border: event.status === "live" ? "2px solid var(--accent2)" : "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center gap-3 min-w-0">
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "5px 12px", borderRadius: 999, background: STATUS_META[event.status]?.bg, color: STATUS_META[event.status]?.fg }}>
                {STATUS_META[event.status]?.label || event.status}
              </span>
              <span style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--muted)" }}>{STATUS_META[event.status]?.hint}</span>
            </div>
            <div className="flex gap-2 flex-none">
              {event.status === "draft" && (
                <>
                  <button onClick={() => setEventStatus("live")} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "9px 18px", borderRadius: "var(--radius-sm)", border: isFirstRun ? "var(--card-border)" : "none", background: isFirstRun ? "var(--bg2)" : "var(--accent2)", color: isFirstRun ? "var(--muted)" : "var(--on-accent)", cursor: "pointer" }}>▶ Go Live</button>
                  <button onClick={() => setEventStatus("archived")} style={{ ...btnStyle("var(--bg2)", "var(--muted)"), border: "var(--card-border)" }}>Discard</button>
                </>
              )}
              {event.status === "live" && (
                <button onClick={() => setEventStatus("ended")} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "9px 18px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", cursor: "pointer" }}>■ End Event</button>
              )}
              {event.status === "ended" && (
                <>
                  <button onClick={() => setEventStatus("live")} style={btnStyle("var(--accent2)", "var(--on-accent)")}>Reopen</button>
                  <button onClick={() => setEventStatus("archived")} style={{ ...btnStyle("var(--bg2)", "var(--ink)"), border: "var(--card-border)" }}>Archive</button>
                </>
              )}
              {event.status === "archived" && (
                <button onClick={() => setEventStatus("ended")} style={{ ...btnStyle("var(--bg2)", "var(--ink)"), border: "var(--card-border)" }}>Unarchive</button>
              )}
            </div>
          </div>

          {/* First-run: lead with the one thing that matters — building content */}
          {isFirstRun && (
            <div className="mb-6 flex flex-col items-center text-center" style={{ padding: "30px 22px", background: "var(--card)", border: "1.5px dashed var(--accent)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
              <p style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 21, color: "var(--ink)", margin: 0 }}>Let&rsquo;s build your event</p>
              <p style={{ fontFamily: "var(--body)", fontSize: 14, color: "var(--muted)", margin: "8px 0 18px", maxWidth: 440 }}>Add a poll, quiz, or word cloud — then go live and put it up on the big screen.</p>
              <button onClick={() => { setTab("polls"); setShowPollForm(true); }} className="cursor-pointer transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 16, padding: "14px 28px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                ＋ Add your first poll
              </button>
            </div>
          )}

          {/* Info cards */}
          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div style={{ padding: 22, background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
              <h2 style={{ ...labelStyle, marginBottom: 16 }}>Access Code</h2>
              <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 28, letterSpacing: ".18em", color: "var(--accent2)" }}>{event.accessCode}</div>
              {event.status === "draft" && (
                <p style={{ fontFamily: "var(--body)", fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Participants can join once you go live.</p>
              )}
              <div className="mt-4 flex gap-2">
                <button onClick={copyLink} className="cursor-pointer transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "9px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                  {copied ? "Copied!" : "Copy Share Link"}
                </button>
              </div>
              <p className="mt-2 break-all" style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)" }}>{shareUrl}</p>
            </div>

            <div style={{ padding: 22, background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
              <h2 style={{ ...labelStyle, marginBottom: 16 }}>Settings</h2>
              <dl className="space-y-4">
                <div className="flex items-center justify-between">
                  <dt style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".04em" }}>Question moderation</dt>
                  <dd style={{ margin: 0 }}>
                    <button onClick={() => patchEvent({ moderationEnabled: !event.moderationEnabled })} className="cursor-pointer transition-colors" style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, letterSpacing: ".04em", padding: "5px 14px", borderRadius: 999, border: "var(--card-border)", background: event.moderationEnabled ? "var(--accent3)" : "var(--bg2)", color: event.moderationEnabled ? "var(--on-accent)" : "var(--muted)" }}>
                      {event.moderationEnabled ? "ON" : "OFF"}
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".04em", flexShrink: 0 }}>Passcode</dt>
                  <dd style={{ margin: 0, flex: 1, maxWidth: 170 }}>
                    <input value={passcodeDraft} onChange={(e) => setPasscodeDraft(e.target.value)} onBlur={savePasscode} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="None" style={{ fontFamily: "var(--body)", fontSize: 13, padding: "6px 10px", width: "100%", textAlign: "right", border: "var(--card-border)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--ink)", outline: "none" }} />
                  </dd>
                </div>
                <div className="flex justify-between" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  <dt style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".04em" }}>Created</dt>
                  <dd style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 13, color: "var(--muted)", margin: 0 }}>{new Date(event.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Room switcher */}
          {event.rooms.length > 0 && (
            <div className="mb-4" style={{ padding: "4px 0" }}>
              <RoomSwitcher
                rooms={event.rooms}
                activeRoomId={activeRoomId}
                onRoomChange={(roomId) => setActiveRoomId(roomId)}
                eventId={id}
                canCreate
                onRoomCreated={(room) =>
                  setEvent((prev) =>
                    prev ? { ...prev, rooms: [...prev.rooms, room] } : prev
                  )
                }
              />
            </div>
          )}

          {/* Tabbed content */}
          <div style={{ background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", overflow: "hidden" }}>
            <div className="flex" style={{ borderBottom: "1px solid var(--line)" }}>
              {tabItems.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)} className="cursor-pointer transition-colors" style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, letterSpacing: ".04em", padding: "14px 22px", background: "none", border: "none", borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent", color: tab === t.key ? "var(--accent)" : "var(--muted)" }}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>

            <div style={{ padding: 22 }}>
              {/* LIVE QUESTIONS */}
              {tab === "live" && (
                <div className="space-y-3">
                  {liveQuestions.length === 0 ? <p className="text-center py-8" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>Audience questions will appear here once you&rsquo;re live.</p> : liveQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-4" style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: q.status === "highlighted" ? "2px solid var(--accent)" : "var(--card-border)", background: q.status === "highlighted" ? "var(--bg2)" : "var(--surface)" }}>
                      <div className="text-center" style={{ minWidth: 48 }}>
                        <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, color: "var(--accent2)" }}>{q.voteCount}</span>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "8.5px", color: "var(--muted)", letterSpacing: ".06em", margin: 0, marginTop: 2 }}>VOTES</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 15, color: "var(--ink)", margin: 0 }}>{q.content}</p>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", margin: 0, marginTop: 4 }}>— {q.authorName} &middot; {new Date(q.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="flex gap-1 flex-none">
                        {q.status !== "highlighted" && <button onClick={() => moderateQuestion(q.id, "highlighted")} style={btnStyle("var(--accent)", "var(--on-accent)")}>Highlight</button>}
                        {q.status === "highlighted" && <button onClick={() => moderateQuestion(q.id, "approved")} style={{ ...btnStyle("var(--bg2)", "var(--ink)"), border: "var(--card-border)" }}>Unhighlight</button>}
                        <button onClick={() => moderateQuestion(q.id, "archived")} style={btnStyle("var(--accent2)", "var(--on-accent)")}>Archive</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* PENDING */}
              {tab === "pending" && (
                <div className="space-y-3">
                  {pendingQuestions.length === 0 ? <p className="text-center py-8" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>No questions awaiting review</p> : pendingQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-4" style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--accent3)", background: "var(--bg2)" }}>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 15, color: "var(--ink)", margin: 0 }}>{q.content}</p>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", margin: 0, marginTop: 4 }}>— {q.authorName} &middot; {new Date(q.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="flex gap-2 flex-none">
                        <button onClick={() => moderateQuestion(q.id, "approved")} className="cursor-pointer" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-sm)", background: "var(--accent2)", color: "var(--on-accent)", border: "none" }}>Approve</button>
                        <button onClick={() => moderateQuestion(q.id, "rejected")} className="cursor-pointer" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "8px 14px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", border: "none" }}>Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ARCHIVED */}
              {tab === "archived" && (
                <div className="space-y-3">
                  {archivedQuestions.length === 0 ? <p className="text-center py-8" style={{ fontFamily: "var(--body)", color: "var(--muted)" }}>No archived questions</p> : archivedQuestions.map((q) => (
                    <div key={q.id} className="flex items-start gap-4" style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "var(--card-border)", background: "var(--surface)", opacity: 0.7 }}>
                      <div className="text-center" style={{ minWidth: 48 }}>
                        <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, color: "var(--muted)" }}>{q.voteCount}</span>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "8.5px", color: "var(--muted)", letterSpacing: ".06em", margin: 0, marginTop: 2 }}>VOTES</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 15, color: "var(--muted)", margin: 0 }}>{q.content}</p>
                        <p style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", margin: 0, marginTop: 4 }}>— {q.authorName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* POLLS */}
              {tab === "polls" && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em" }}>MANAGE POLLS &amp; QUIZZES</span>
                    <button onClick={() => setShowPollForm(!showPollForm)} className="cursor-pointer" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 13, padding: "8px 16px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                      {showPollForm ? "Cancel" : "+ Create Poll"}
                    </button>
                  </div>

                  {showPollForm && (
                    <form onSubmit={createPoll} className="mb-6" style={{ padding: 18, background: "var(--bg2)", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}>
                      <div className="space-y-3">
                        <div>
                          <label style={labelStyle}>Poll Title</label>
                          <input value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} placeholder="e.g. Which feature is most exciting?" style={inputStyle} required />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label style={labelStyle}>Type</label>
                            <select value={pollType} onChange={(e) => setPollType(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                              <option value="multiple_choice">Multiple Choice</option>
                              <option value="word_cloud">Word Cloud</option>
                              <option value="quiz">Quiz</option>
                            </select>
                          </div>
                          {pollType === "quiz" && (
                            <div>
                              <label style={labelStyle}>Timer (seconds)</label>
                              <input type="number" value={pollTimer} onChange={(e) => setPollTimer(+e.target.value)} min={5} max={120} style={inputStyle} />
                            </div>
                          )}
                        </div>
                        <div>
                          <label style={labelStyle}>Image URL (optional)</label>
                          <input value={pollImageUrl} onChange={(e) => setPollImageUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
                        </div>
                        {pollType !== "word_cloud" && (
                          <div>
                            <label style={labelStyle}>Options</label>
                            <div className="space-y-2">
                              {pollOptions.map((opt, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                  <input ref={(el) => { optionRefs.current[i] = el; }} value={opt} onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} onKeyDown={(e) => handleOptionKey(e, i)} placeholder={i < 2 ? `Option ${i + 1}` : "Option (Enter for next)"} style={inputStyle} />
                                  {pollType === "quiz" && (
                                    <button type="button" onClick={() => setPollCorrectIdx(i)} className="cursor-pointer flex-none" style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "6px 8px", borderRadius: "var(--radius-sm)", background: pollCorrectIdx === i ? "var(--accent2)" : "var(--bg)", border: "var(--card-border)", color: pollCorrectIdx === i ? "var(--on-accent)" : "var(--muted)" }}>
                                      {pollCorrectIdx === i ? "CORRECT" : "Mark"}
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button type="button" onClick={() => setPollOptions([...pollOptions, ""])} className="cursor-pointer" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", background: "none", border: "none", padding: "4px 0" }}>
                                + Add option
                              </button>
                            </div>
                          </div>
                        )}
                        <button type="submit" className="cursor-pointer w-full" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                          Save as Draft
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {polls.length === 0 && !showPollForm ? (
                      <div className="text-center" style={{ padding: "28px 0" }}>
                        <p style={{ fontFamily: "var(--body)", fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Polls, quizzes, and word clouds are the heart of your event.</p>
                        <button onClick={() => setShowPollForm(true)} className="cursor-pointer transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, padding: "12px 24px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>
                          ＋ Create your first poll
                        </button>
                      </div>
                    ) : (
                      polls.map((p) => (
                        <div key={p.id} className="flex items-center gap-4" style={{ padding: "14px 16px", borderRadius: "var(--radius-sm)", border: p.status === "active" ? "2px solid var(--accent)" : "var(--card-border)", background: p.status === "active" ? "var(--bg2)" : "var(--surface)" }}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{p.title}</span>
                              <span style={{ fontFamily: "var(--mono)", fontSize: 10, padding: "2px 7px", borderRadius: 999, background: p.status === "active" ? "var(--accent)" : p.status === "closed" ? "var(--muted)" : "var(--bg2)", color: p.status === "active" ? "var(--on-accent)" : p.status === "closed" ? "var(--surface)" : "var(--muted)", letterSpacing: ".04em" }}>
                                {p.status.toUpperCase()}
                              </span>
                            </div>
                            <p style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", margin: 0, marginTop: 4 }}>
                              {p.type.replace("_", " ")} &middot; {p.totalResponses} responses
                              {p.options.length > 0 && ` · ${p.options.length} options`}
                            </p>
                          </div>
                          <div className="flex gap-1 flex-none">
                            {p.status === "draft" && (
                              <button onClick={() => setPollStatus(p.id, "active")} style={btnStyle("var(--accent)", "var(--on-accent)")}>Launch</button>
                            )}
                            {p.status === "active" && (
                              <button onClick={() => setPollStatus(p.id, "closed")} style={btnStyle("var(--accent2)", "var(--on-accent)")}>Close</button>
                            )}
                            {p.type === "quiz" && (p.status === "active" || p.status === "closed") && (
                              <button onClick={() => showLeaderboard(p.id)} style={btnStyle("var(--accent3)", "var(--on-accent)")}>Leaderboard</button>
                            )}
                            {p.status === "closed" && (
                              <button onClick={() => setPollStatus(p.id, "active")} style={{ ...btnStyle("var(--bg2)", "var(--ink)"), border: "var(--card-border)" }}>Reopen</button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
