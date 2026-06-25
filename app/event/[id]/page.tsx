"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { AppHeader } from "@/components/app-header";
import { RoomSwitcher } from "@/components/room-switcher";

interface Question {
  id: string;
  content: string;
  authorName: string;
  isAnonymous: boolean;
  voteCount: number;
  hasVoted: boolean;
  status: string;
  isOwn?: boolean;
  createdAt: string;
}

interface EventData {
  id: string;
  name: string;
  accessCode: string;
  moderationEnabled: boolean;
  status: string;
  rooms: { id: string; name: string }[];
}

interface ActivePoll {
  id: string;
  title: string;
  type: string;
  status: string;
  imageUrl?: string | null;
  timerSeconds: number;
  activatedAt?: string | null;
  correctAnswer?: string | null;
  options: { id: string; text: string; responseCount: number }[];
  totalResponses: number;
  wordCloudEntries?: { text: string; count: number }[];
}

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [event, setEvent] = useState<EventData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string>("");

  // Poll state
  const [activePoll, setActivePoll] = useState<ActivePoll | null>(null);
  const [pollAnswered, setPollAnswered] = useState(false);
  const [pollResult, setPollResult] = useState<{ correct?: boolean; score?: number } | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<{ rank: number; total: number } | null>(null);
  const [wordInput, setWordInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const currentPollIdRef = useRef<string | null>(null);
  const activeRoomIdRef = useRef<string>("");

  const roomQuery = activeRoomId ? `?roomId=${activeRoomId}` : "";

  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/questions${roomQuery}`);
    if (res.ok) setQuestions(await res.json());
    setLoadingQuestions(false);
  }, [id, roomQuery]);

  const fetchMyRank = useCallback(async (pollId: string) => {
    if (!session?.user?.id) return;
    const res = await fetch(`/api/events/${id}/polls/${pollId}/leaderboard${roomQuery}`);
    if (!res.ok) return;
    const board: { userId: string; name: string; score: number }[] = await res.json();
    const idx = board.findIndex((e) => e.userId === session.user.id);
    if (idx >= 0) setMyRank({ rank: idx + 1, total: board.length });
  }, [id, roomQuery, session?.user?.id]);

  const fetchActivePoll = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/polls/active${roomQuery}`);
    if (res.ok) {
      const data = await res.json();
      const pollKey = data ? `${data.id}:${data.activatedAt ?? ""}` : null;
      const isNewPoll = currentPollIdRef.current !== pollKey;
      currentPollIdRef.current = pollKey;
      setActivePoll(data);
      if (isNewPoll) {
        setPollAnswered(false);
        setPollResult(null);
        setSelectedOptionId(null);
        setMyRank(null);
        if (timerRef.current) clearInterval(timerRef.current);
        if (data?.type === "quiz") {
          const startMs = data.activatedAt ? new Date(data.activatedAt).getTime() : Date.now();
          pollStartRef.current = startMs;
          const initialRemaining = Math.max(0, data.timerSeconds - Math.floor((Date.now() - startMs) / 1000));
          setTimeLeft(initialRemaining);
          if (initialRemaining <= 0) {
            setPollAnswered(true);
          } else {
            timerRef.current = setInterval(() => {
              const remaining = Math.max(0, data.timerSeconds - Math.floor((Date.now() - pollStartRef.current) / 1000));
              setTimeLeft(remaining);
              if (remaining <= 0 && timerRef.current) {
                clearInterval(timerRef.current);
                setPollAnswered(true);
              }
            }, 200);
          }
        }
      }
    } else {
      currentPollIdRef.current = null;
      setActivePoll(null);
      setPollAnswered(false);
      setPollResult(null);
      setSelectedOptionId(null);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [id, roomQuery]);

  useEffect(() => {
    fetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((data: EventData) => {
        setEvent(data);
        if (!activeRoomId && data.rooms?.length) {
          setActiveRoomId(data.rooms[0].id);
        }
      });
  }, [id, activeRoomId]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    if (!activeRoomId) return;
    setLoadingQuestions(true);
    fetchQuestions();
    fetchActivePoll();
  }, [activeRoomId, fetchQuestions, fetchActivePoll]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-event", id);

    socket.on("question:new", (question: Question & { _roomId?: string }) => {
      if (question._roomId && question._roomId !== activeRoomIdRef.current) return;
      setQuestions((prev) => {
        if (prev.find((q) => q.id === question.id)) return prev;
        return [...prev, question].sort((a, b) => b.voteCount - a.voteCount);
      });
    });
    socket.on("question:vote", (data: { questionId: string; voteCount: number; roomId?: string }) => {
      if (data.roomId && data.roomId !== activeRoomIdRef.current) return;
      setQuestions((prev) => prev.map((q) => q.id === data.questionId ? { ...q, voteCount: data.voteCount } : q).sort((a, b) => b.voteCount - a.voteCount));
    });
    socket.on("question:status", (data: { questionId: string; status: string; roomId?: string }) => {
      if (data.roomId && data.roomId !== activeRoomIdRef.current) return;
      setQuestions((prev) => prev.map((q) => q.id === data.questionId ? { ...q, status: data.status } : q));
    });
    socket.on("poll:activated", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      fetchActivePoll();
    });
    socket.on("poll:closed", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      if (timerRef.current) clearInterval(timerRef.current);
      fetchActivePoll();
    });
    socket.on("poll:response", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      fetchActivePoll();
    });
    socket.on("event:status", (data: { status: string }) => {
      setEvent((prev) => (prev ? { ...prev, status: data.status } : prev));
      if (data.status === "live") { fetchQuestions(); fetchActivePoll(); }
    });

    return () => {
      socket.emit("leave-event", id);
      socket.off("question:new");
      socket.off("question:vote");
      socket.off("question:status");
      socket.off("poll:activated");
      socket.off("poll:closed");
      socket.off("poll:response");
      socket.off("event:status");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, fetchQuestions, fetchActivePoll]);

  async function handleSubmitQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/events/${id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newQuestion, isAnonymous, roomId: activeRoomId || undefined }),
    });
    if (res.ok) {
      const question = await res.json();
      getSocket().emit("question:new", { eventId: id, roomId: activeRoomId, question });
      setNewQuestion("");
      setIsAnonymous(false);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 2500);
      fetchQuestions();
    }
    setSubmitting(false);
  }

  async function handleVote(questionId: string) {
    const res = await fetch(`/api/events/${id}/questions/${questionId}/vote`, { method: "POST" });
    if (res.ok) {
      const { voted, voteCount } = await res.json();
      setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, hasVoted: voted, voteCount } : q).sort((a, b) => b.voteCount - a.voteCount));
      getSocket().emit("question:vote", { eventId: id, roomId: activeRoomId, questionId, voteCount });
    }
  }

  async function submitPollResponse(optionId?: string, textValue?: string) {
    if (pollAnswered || !activePoll) return;
    const res = await fetch(`/api/events/${id}/polls/${activePoll.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId, textValue }),
    });
    if (res.ok) {
      const data = await res.json();
      if (activePoll.type !== "word_cloud") {
        if (optionId) setSelectedOptionId(optionId);
        setPollAnswered(true);
        setPollResult(data);
        if (activePoll.type === "quiz") fetchMyRank(activePoll.id);
      }
      getSocket().emit("poll:response", { eventId: id, roomId: activeRoomId, pollId: activePoll.id });
    } else if (res.status === 409) {
      setPollAnswered(true);
    }
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="animate-spin" style={{ width: 32, height: 32, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (event.status !== "live") {
    const ended = event.status === "ended" || event.status === "archived";
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        <AppHeader joinCode={event.accessCode} showSkinSwitcher />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center" style={{ maxWidth: 420, padding: "48px 40px", background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: ended ? "var(--accent)" : "var(--accent3)", margin: "0 auto 18px", animation: ended ? "none" : "loomPulse 1.6s ease-in-out infinite" }} />
            <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 26, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>
              {ended ? "This session has ended" : "Waiting for the host to start"}
            </h2>
            <p style={{ fontFamily: "var(--body)", fontSize: 15, color: "var(--muted)", marginTop: 12 }}>
              {ended ? "Thanks for taking part!" : "Hang tight — this will begin shortly."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <AppHeader joinCode={event.accessCode} showSkinSwitcher />

      <div className="flex-none" style={{ padding: "12px 26px", background: "var(--bg2)", borderBottom: "1px solid var(--line)" }}>
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 18, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>{event.name}</h2>
          {session && <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)" }}>{session.user.name}</span>}
        </div>
      </div>

      <main className="mx-auto max-w-3xl w-full p-4 flex-1">
        {/* Room switcher */}
        {event.rooms && event.rooms.length > 1 && (
          <div className="mb-4">
            <RoomSwitcher
              rooms={event.rooms}
              activeRoomId={activeRoomId}
              onRoomChange={(roomId) => setActiveRoomId(roomId)}
              eventId={id}
            />
          </div>
        )}

        {/* Active Poll Banner */}
        {activePoll && (
          <div className="mb-6" style={{ padding: 20, background: "var(--card)", border: `2px solid var(--accent)`, borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", animation: "loomPop .3s ease-out" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "loomPulse 1.6s ease-in-out infinite" }} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: ".05em" }}>LIVE POLL</span>
              </div>
              {activePoll.type === "quiz" && timeLeft > 0 && !pollAnswered && (
                <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 16, color: timeLeft <= 5 ? "var(--accent)" : "var(--ink)" }}>{timeLeft}s</span>
              )}
            </div>
            <h3 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 20, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0, marginBottom: 14 }}>{activePoll.title}</h3>
            {activePoll.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activePoll.imageUrl} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: "var(--radius-sm)", marginBottom: 14, background: "var(--bg)" }} />
            )}

            {/* Multiple choice / Quiz options */}
            {(activePoll.type === "multiple_choice" || activePoll.type === "quiz") && !pollAnswered && (
              <div className="space-y-2">
                {activePoll.options.map((opt, i) => (
                  <button key={opt.id} onClick={() => submitPollResponse(opt.id)} disabled={pollAnswered || (activePoll.type === "quiz" && timeLeft <= 0)} className="w-full cursor-pointer transition-all" style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", fontFamily: "var(--body)", fontWeight: 600, fontSize: 14, textAlign: "left", background: "var(--bg)", color: "var(--ink)", border: "1.5px solid var(--line)" }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontWeight: 800, fontSize: 12, background: "var(--bg2)", color: "var(--ink)" }}>{String.fromCharCode(65 + i)}</span>
                    <span className="flex-1">{opt.text}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Word cloud input */}
            {activePoll.type === "word_cloud" && !pollAnswered && (
              <div className="flex gap-2">
                <input value={wordInput} onChange={(e) => setWordInput(e.target.value)} placeholder="Type your word..." maxLength={30} className="flex-1" style={{ fontFamily: "var(--body)", fontSize: 15, padding: "11px 13px", border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--ink)", outline: "none" }} />
                <button onClick={() => { if (wordInput.trim()) { submitPollResponse(undefined, wordInput.trim()); setWordInput(""); } }} className="cursor-pointer" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "0 16px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)" }}>Send</button>
              </div>
            )}

            {/* Word cloud — grows live on your phone */}
            {activePoll.type === "word_cloud" && activePoll.wordCloudEntries && activePoll.wordCloudEntries.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1" style={{ marginTop: 16 }}>
                {[...activePoll.wordCloudEntries].sort((a, b) => b.count - a.count).slice(0, 24).map((w, i) => {
                  const max = Math.max(...activePoll.wordCloudEntries!.map((e) => e.count), 1);
                  const size = 15 + (w.count / max) * 21;
                  return (
                    <span key={w.text} style={{ fontFamily: "var(--display)", fontWeight: 700, fontStyle: "var(--hi-style)", fontSize: size, lineHeight: 1.1, color: i % 3 === 0 ? "var(--accent)" : i % 3 === 1 ? "var(--accent2)" : "var(--accent3)" }}>{w.text}</span>
                  );
                })}
              </div>
            )}

            {/* Quiz reveal (answered or time up) */}
            {activePoll.type === "quiz" && pollAnswered && (
              <div className="space-y-2">
                {activePoll.options.map((opt, i) => {
                  const isCorrect = activePoll.correctAnswer === opt.id;
                  const isMine = selectedOptionId === opt.id;
                  const bg = isCorrect ? "var(--ok)" : isMine ? "var(--accent2)" : "var(--bg)";
                  const fg = isCorrect || isMine ? "var(--on-accent)" : "var(--ink)";
                  return (
                    <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: "var(--radius-sm)", fontFamily: "var(--body)", fontWeight: 600, fontSize: 14, background: bg, color: fg, border: "1.5px solid var(--line)" }}>
                      <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--display)", fontWeight: 800, fontSize: 12, background: "var(--bg2)", color: "var(--ink)" }}>{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{opt.text}</span>
                      {isCorrect && <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>✓</span>}
                      {isMine && !isCorrect && <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700 }}>✗</span>}
                    </div>
                  );
                })}
                <div className="text-center" style={{ paddingTop: 8 }}>
                  <p style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 20, color: pollResult?.correct ? "var(--ok)" : "var(--accent2)", margin: 0 }}>
                    {pollResult ? (pollResult.correct ? `Correct! +${pollResult.score} pts` : "Not quite!") : "Time's up!"}
                  </p>
                  {myRank && (
                    <p style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>
                      Your rank: <span style={{ color: "var(--accent)" }}>#{myRank.rank}</span> of {myRank.total}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Multiple choice submitted — alive, not a dead receipt */}
            {activePoll.type === "multiple_choice" && pollAnswered && (
              <div className="text-center" style={{ padding: "8px 0" }}>
                <p style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 20, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--accent2)", margin: 0 }}>You&rsquo;re in ✓</p>
                <p style={{ fontFamily: "var(--mono)", fontSize: 14, color: "var(--ink)", marginTop: 8 }}>
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>{activePoll.totalResponses}</span> {activePoll.totalResponses === 1 ? "response" : "responses"} so far
                </p>
                <p style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--muted)", marginTop: 8 }}>Results are up on the big screen ☝️</p>
              </div>
            )}
          </div>
        )}

        {/* Ask question form */}
        <form onSubmit={handleSubmitQuestion} className="mb-6" style={{ padding: 18, background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)" }}>
          <textarea value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="Ask a question..." maxLength={300} rows={3} className="w-full resize-none" style={{ fontFamily: "var(--body)", fontSize: 15, padding: 12, border: "1.5px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--bg)", color: "var(--ink)", outline: "none" }} />
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2" style={{ fontFamily: "var(--body)", fontSize: 13, color: "var(--muted)" }}>
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
              Ask anonymously
            </label>
            <div className="flex items-center gap-3">
              {justSubmitted && (
                <span className="flex items-center gap-1" style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 700, color: "var(--accent2)", animation: "loomPop .3s ease-out" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  Question sent
                </span>
              )}
              <span style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)" }}>{newQuestion.length}/300</span>
              <button type="submit" disabled={submitting || !newQuestion.trim()} className="transition-colors" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "9px 18px", border: "none", borderRadius: "var(--radius-sm)", background: newQuestion.trim() ? "var(--accent)" : "var(--bg2)", color: newQuestion.trim() ? "var(--on-accent)" : "var(--muted)", cursor: newQuestion.trim() ? "pointer" : "default" }}>
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </form>

        {event.moderationEnabled && (
          <p className="mb-4" style={{ fontFamily: "var(--body)", fontSize: 13, padding: "10px 16px", borderRadius: "var(--radius-sm)", background: "var(--bg2)", border: "1px solid var(--line)", color: "var(--accent3)" }}>
            Moderation is enabled. Your question will be visible after host approval.
          </p>
        )}

        {/* Question list header */}
        {!loadingQuestions && questions.length > 0 && (
          <div className="mb-3 flex items-baseline justify-between">
            <h3 style={{ fontFamily: "var(--mono)", fontSize: "11px", fontWeight: 700, color: "var(--ink)", letterSpacing: ".06em", textTransform: "uppercase", margin: 0 }}>
              Questions ({questions.length})
            </h3>
            <span style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--muted)", letterSpacing: ".04em" }}>Sorted by votes</span>
          </div>
        )}

        {/* Question list */}
        <div className="space-y-3">
          {loadingQuestions ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin" style={{ width: 28, height: 28, borderRadius: "50%", border: "4px solid var(--track)", borderTopColor: "var(--accent)" }} />
            </div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
              <p className="text-lg" style={{ fontFamily: "var(--display)", fontWeight: 800 }}>No questions yet</p>
              <p className="text-sm" style={{ fontFamily: "var(--body)" }}>Be the first to ask!</p>
            </div>
          ) : (
            questions.map((q) => {
              const isPending = q.status === "pending";
              return (
                <div key={q.id} className="flex items-stretch gap-[14px] transition-all" style={{ padding: "16px 18px", background: "var(--card)", border: q.status === "highlighted" ? "2px solid var(--accent)" : "var(--card-border)", borderRadius: "var(--radius)", boxShadow: "var(--card-shadow)", opacity: isPending ? 0.65 : 1 }}>
                  {isPending ? (
                    <div className="flex-none" style={{ minWidth: 58, paddingRight: 14, borderRight: "1px solid var(--line)" }} />
                  ) : (
                    <button onClick={() => handleVote(q.id)} className="flex-none flex flex-col items-center justify-center cursor-pointer" style={{ minWidth: 58, paddingRight: 14, paddingTop: 6, paddingBottom: 6, background: "none", border: "none", borderRight: "1px solid var(--line)", touchAction: "manipulation" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={q.hasVoted ? "var(--accent2)" : "none"} stroke={q.hasVoted ? "var(--accent2)" : "var(--muted)"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 15l7-7 7 7" /></svg>
                      <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 22, lineHeight: 1, color: q.hasVoted ? "var(--accent2)" : "var(--ink)", marginTop: 2 }}>{q.voteCount}</span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "8.5px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 2 }}>VOTES</span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    {isPending && (
                      <span className="inline-block mb-2" style={{ fontFamily: "var(--mono)", fontSize: "9.5px", fontWeight: 700, color: "var(--accent3)", letterSpacing: ".05em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, background: "var(--bg2)", border: "1px solid var(--accent3)" }}>
                        Pending review
                      </span>
                    )}
                    <p style={{ fontFamily: "var(--body)", fontWeight: 500, fontSize: 16, lineHeight: 1.4, color: "var(--ink)", margin: 0 }}>{q.content}</p>
                    <p style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--muted)", margin: 0, marginTop: 6 }}>— {q.authorName} &middot; {new Date(q.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
