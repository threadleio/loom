"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { EventQR } from "@/components/event-qr";
import { getSocket } from "@/lib/socket";

interface Question {
  id: string;
  content: string;
  authorName: string;
  voteCount: number;
  status: string;
}

interface PollData {
  id: string;
  title: string;
  type: string;
  options: { id: string; text: string; responseCount: number }[];
  totalResponses: number;
  wordCloudEntries?: { text: string; count: number }[];
  timerSeconds?: number;
  activatedAt?: string | null;
  correctAnswer?: string | null;
  imageUrl?: string | null;
}

interface EventData {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  createdBy: string;
  rooms: { id: string; name: string }[];
}

export default function PresentViewPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const [event, setEvent] = useState<EventData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [polls, setPolls] = useState<{ id: string; title: string; type: string; status: string }[]>([]);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [controlParam, setControlParam] = useState(false);
  const [focusedQuestion, setFocusedQuestion] = useState<Question | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
  const [leaderboardTitle, setLeaderboardTitle] = useState("Overall");
  // The "results" beat: after a poll is live, Next closes it and parks here,
  // showing the final bars (+ revealed answer + scores for a quiz). A second
  // Next advances to the following poll. resultsPoll holds that closed poll.
  const [resultsPoll, setResultsPoll] = useState<PollData | null>(null);
  const [resultsScores, setResultsScores] = useState<{ name: string; score: number }[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [pollTimeLeft, setPollTimeLeft] = useState<number | null>(null);
  const lbPollIdRef = useRef<string | null>(null);
  const lbShowingRef = useRef(false);
  const activeRoomIdRef = useRef<string>("");

  const roomQuery = activeRoomId ? `?roomId=${activeRoomId}` : "";

  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/questions${roomQuery}`);
    if (res.ok) {
      const data: Question[] = await res.json();
      setQuestions(data.filter((q) => q.status !== "archived" && q.status !== "pending"));
    }
  }, [id, roomQuery]);

  const fetchActivePoll = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/polls/active${roomQuery}`);
    if (res.ok) {
      const data = await res.json();
      setActivePoll(data);
    } else {
      setActivePoll(null);
    }
  }, [id, roomQuery]);

  const fetchLeaderboard = useCallback(async (pollId: string) => {
    const res = await fetch(`/api/events/${id}/polls/${pollId}/leaderboard${roomQuery}`);
    if (res.ok) setLeaderboard(await res.json());
  }, [id, roomQuery]);

  const fetchPolls = useCallback(async () => {
    const res = await fetch(`/api/events/${id}/polls${roomQuery}`);
    if (res.ok) setPolls(await res.json());
  }, [id, roomQuery]);

  // The host drives the stage when ?control=1 and they own the event.
  const controlMode = controlParam && !!event && session?.user?.id === event.createdBy;

  // Deck position. Each poll has two beats: live (answering), then results
  // (closed, revealed). activePoll drives the live beat; resultsPoll the
  // results beat. At most one is set. 0 = Q&A.
  const currentPoll = activePoll ?? resultsPoll;
  const currentIdx = currentPoll ? polls.findIndex((p) => p.id === currentPoll.id) : -1;
  const deckPos = currentIdx >= 0 ? currentIdx + 1 : 0;
  const inResults = !!resultsPoll && !activePoll;
  // Linear beat number: Q&A=0, then per poll i (0-based): live=2i+1, results=2i+2.
  const beat = currentIdx >= 0 ? currentIdx * 2 + (inResults ? 2 : 1) : 0;
  const lastBeat = polls.length * 2;
  const hasQuiz = polls.some((p) => p.type === "quiz");

  async function activatePoll(pollId: string) {
    const res = await fetch(`/api/events/${id}/polls/${pollId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) });
    if (res.ok) getSocket().emit("poll:activated", { eventId: id, roomId: activeRoomId, pollId });
  }
  // Close the live poll and park on its results: capture the final bars while
  // it's still active, lock answering server-side, pull this question's scores
  // for a quiz, then broadcast it all so every screen shows the same results.
  async function enterResults() {
    if (!activePoll) return;
    const poll = activePoll;
    let snapshot: PollData = poll;
    try {
      const r = await fetch(`/api/events/${id}/polls/active${roomQuery}`);
      if (r.ok) { const d = await r.json(); if (d && d.id === poll.id) snapshot = d; }
    } catch { /* fall back to the last-known snapshot */ }

    let scores: { name: string; score: number }[] = [];
    if (poll.type === "quiz") {
      const sp = `${roomQuery ? "&" : "?"}single=1`;
      const lr = await fetch(`/api/events/${id}/polls/${poll.id}/leaderboard${roomQuery}${sp}`);
      if (lr.ok) scores = await lr.json();
    }

    // Lock answering before revealing — otherwise the answer is on screen
    // while the API still accepts (and scores) late submissions.
    await fetch(`/api/events/${id}/polls/${poll.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
    getSocket().emit("poll:results", { eventId: id, roomId: activeRoomId, poll: snapshot, scores });
  }

  function goNext() {
    if (activePoll) { enterResults(); return; }            // live → results
    if (resultsPoll) {                                      // results → next poll
      const idx = polls.findIndex((p) => p.id === resultsPoll.id);
      if (idx >= 0 && idx + 1 < polls.length) activatePoll(polls[idx + 1].id);
      return;
    }
    if (polls.length) activatePoll(polls[0].id);           // Q&A → first poll
  }
  async function goPrev() {
    if (resultsPoll) { activatePoll(resultsPoll.id); return; }  // results → re-open live
    if (!activePoll) return;
    const idx = polls.findIndex((p) => p.id === activePoll.id);
    if (idx <= 0) {
      // First poll → back to Q&A. Await the close before emitting so the
      // round-tripped poll:closed doesn't re-fetch a still-active poll.
      const res = await fetch(`/api/events/${id}/polls/${activePoll.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "closed" }) });
      if (res.ok) getSocket().emit("poll:closed", { eventId: id, roomId: activeRoomId, pollId: activePoll.id });
    } else {
      activatePoll(polls[idx - 1].id);                          // live → previous poll (live)
    }
  }
  // Cumulative standings across every quiz — a non-destructive overlay the host
  // can raise at any beat (e.g. the finale). Hiding it returns to the beat.
  async function showOverall() {
    const quizId = activePoll?.type === "quiz" ? activePoll.id : polls.find((p) => p.type === "quiz")?.id;
    if (!quizId) return;
    const res = await fetch(`/api/events/${id}/polls/${quizId}/leaderboard${roomQuery}`);
    if (res.ok) getSocket().emit("poll:leaderboard", { eventId: id, roomId: activeRoomId, pollId: quizId, leaderboard: await res.json(), title: "Overall" });
  }
  function hideLeaderboard() {
    getSocket().emit("poll:leaderboard", { eventId: id, roomId: activeRoomId, leaderboard: [], hide: true });
  }
  async function endEventAction() {
    if (!window.confirm("End the event for everyone?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ended" }) });
    if (res.ok) getSocket().emit("event:status", { eventId: id, status: "ended" });
  }

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
    setControlParam(new URLSearchParams(window.location.search).get("control") === "1");
  }, []);

  useEffect(() => {
    if (!activeRoomId) return;
    fetchQuestions();
    fetchActivePoll();
    fetchPolls();
  }, [activeRoomId, fetchQuestions, fetchActivePoll, fetchPolls]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-event", id);

    socket.on("question:new", (data: { _roomId?: string }) => {
      if (data?._roomId && data._roomId !== activeRoomIdRef.current) return;
      fetchQuestions();
    });
    socket.on("question:vote", (data: { roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      fetchQuestions();
    });
    socket.on("question:status", (data: { questionId: string; status: string; roomId?: string }) => {
      if (data.roomId && data.roomId !== activeRoomIdRef.current) return;
      if (data.status === "highlighted") {
        setQuestions((prev) => {
          const q = prev.find((qq) => qq.id === data.questionId);
          if (q) {
            setFocusedQuestion({ ...q, status: "highlighted" });
          } else {
            fetch(`/api/events/${id}/questions${roomQuery}`)
              .then((r) => (r.ok ? r.json() : []))
              .then((all: Question[]) => {
                const fq = all.find((x) => x.id === data.questionId);
                if (fq) setFocusedQuestion({ ...fq, status: "highlighted" });
                setQuestions(all.filter((x) => x.status !== "archived" && x.status !== "pending"));
              });
          }
          return prev.map((qq) =>
            qq.id === data.questionId ? { ...qq, status: data.status } : qq
          );
        });
      } else {
        if (focusedQuestion?.id === data.questionId) setFocusedQuestion(null);
        fetchQuestions();
      }
    });

    socket.on("poll:activated", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      setShowLeaderboard(false);
      lbShowingRef.current = false;
      setResultsPoll(null);
      fetchActivePoll();
    });
    socket.on("poll:response", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      if (lbShowingRef.current && lbPollIdRef.current) {
        fetchLeaderboard(lbPollIdRef.current);
      } else {
        fetchActivePoll();
      }
    });
    socket.on("poll:closed", (data: { pollId?: string; roomId?: string }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      setShowLeaderboard(false);
      lbShowingRef.current = false;
      setResultsPoll(null);
      fetchActivePoll();
    });
    // The results beat: park on a closed poll's final bars (+ scores for a quiz).
    socket.on("poll:results", (data: { roomId?: string; poll: PollData; scores?: { name: string; score: number }[] }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      setShowLeaderboard(false);
      lbShowingRef.current = false;
      setActivePoll(null);
      setResultsPoll(data.poll);
      setResultsScores(data.scores || []);
    });
    // Overall standings overlay. Non-destructive: it sits on top of the current
    // beat (active/results/Q&A) and `hide` returns to it without changing it.
    socket.on("poll:leaderboard", (data: { pollId?: string; roomId?: string; leaderboard: { name: string; score: number }[]; title?: string; hide?: boolean }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      if (data.hide) {
        setShowLeaderboard(false);
        lbShowingRef.current = false;
        return;
      }
      setLeaderboard(data.leaderboard);
      setLeaderboardTitle(data.title || "Overall");
      setShowLeaderboard(true);
      lbShowingRef.current = true;
      lbPollIdRef.current = data.pollId ?? null;
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
      socket.off("poll:response");
      socket.off("poll:closed");
      socket.off("poll:results");
      socket.off("poll:leaderboard");
      socket.off("event:status");
    };
  }, [id, fetchQuestions, fetchActivePoll, fetchLeaderboard, focusedQuestion?.id]);

  useEffect(() => {
    if (activePoll?.type === "quiz" && activePoll.activatedAt && activePoll.timerSeconds) {
      const start = new Date(activePoll.activatedAt).getTime();
      const total = activePoll.timerSeconds;
      const tick = () => setPollTimeLeft(Math.max(0, total - Math.floor((Date.now() - start) / 1000)));
      tick();
      const iv = setInterval(tick, 250);
      return () => clearInterval(iv);
    }
    setPollTimeLeft(null);
  }, [activePoll?.id, activePoll?.type, activePoll?.activatedAt, activePoll?.timerSeconds]);

  if (!event) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div
          className="animate-spin"
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            border: "4px solid var(--track)",
            borderTopColor: "var(--accent)",
          }}
        />
      </div>
    );
  }

  if (event.status !== "live") {
    const ended = event.status === "ended" || event.status === "archived";
    return (
      <div className="h-screen flex flex-col items-center justify-center" style={{ background: "var(--bg)", position: "relative" }}>
        <div style={{ position: "absolute", top: 24, right: 40, textAlign: "right" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: ".06em" }}>JOIN CODE</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 700, color: "var(--accent2)", letterSpacing: ".18em" }}>{event.accessCode}</div>
        </div>
        <div className="text-center">
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: ended ? "var(--accent)" : "var(--accent3)", margin: "0 auto 24px", animation: ended ? "none" : "loomPulse 1.6s ease-in-out infinite" }} />
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 52, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>
            {ended ? "That's a wrap" : "Get ready…"}
          </h1>
          <p style={{ fontFamily: "var(--body)", fontSize: 22, color: "var(--muted)", marginTop: 16 }}>
            {ended ? "This session has ended." : "Join with the code above to take part."}
          </p>
        </div>
        {controlMode && (
          <div className="flex gap-3" style={{ marginTop: 40 }}>
            <Link href={`/event/${id}/host`} className="transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 15, padding: "12px 22px", borderRadius: "var(--radius-sm)", background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}>← Back to host</Link>
            {ended && (
              <Link href={`/event/${id}/analytics`} className="transition-opacity hover:opacity-90" style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 15, padding: "12px 22px", borderRadius: "var(--radius-sm)", background: "var(--bg2)", border: "var(--card-border)", color: "var(--ink)", textDecoration: "none" }}>View results →</Link>
            )}
          </div>
        )}
      </div>
    );
  }

  const accents = ["var(--accent)", "var(--accent2)", "var(--accent3)", "var(--ink)"];

  // Choice/quiz bars, shared by the live beat and the results beat. When
  // `reveal` is on (timer up, or the results beat), a quiz greens its correct
  // option and dims the rest; otherwise the leading option is highlighted.
  function pollBars(poll: PollData, reveal: boolean) {
    return (
      <div className="flex flex-col gap-4 flex-1 justify-center">
        {poll.options.map((opt, i) => {
          const pct = poll.totalResponses > 0 ? Math.round((opt.responseCount / poll.totalResponses) * 100) : 0;
          const maxCount = Math.max(...poll.options.map((o) => o.responseCount), 1);
          const isLeading = opt.responseCount === maxCount && opt.responseCount > 0;
          const revealQuiz = reveal && poll.type === "quiz" && !!poll.correctAnswer;
          const isCorrect = revealQuiz && opt.id === poll.correctAnswer;
          const dimmed = revealQuiz && !isCorrect;
          const highlight = isLeading && !revealQuiz;
          const barColor = isCorrect ? "var(--ok)" : accents[i % accents.length];
          return (
            <div key={opt.id} className="flex items-center gap-4" style={{ animation: `loomRise .3s ease-out ${i * 0.08}s both`, opacity: dimmed ? 0.4 : 1, transition: "opacity .4s ease" }}>
              <div
                style={{
                  flex: "none",
                  width: 46,
                  height: 46,
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--display)",
                  fontWeight: 800,
                  fontSize: 20,
                  background: isCorrect ? "var(--ok)" : highlight ? accents[i % accents.length] : "var(--bg2)",
                  color: isCorrect || highlight ? "var(--on-accent)" : "var(--ink)",
                }}
              >
                {isCorrect ? "✓" : String.fromCharCode(65 + i)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-2">
                  <span style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 20, color: isCorrect ? "var(--ok)" : "var(--ink)" }}>
                    {opt.text}
                    {isCorrect && <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 12, letterSpacing: ".08em", color: "var(--ok)", marginLeft: 10 }}>CORRECT</span>}
                  </span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{pct}%</span>
                </div>
                <div style={{ height: 20, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: barColor,
                      borderRadius: 999,
                      transition: "width .6s cubic-bezier(.2,.8,.2,1)",
                      minWidth: pct > 0 ? 8 : 0,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function pollCloud(poll: PollData) {
    if (!poll.wordCloudEntries) return null;
    return (
      <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" style={{ padding: "20px 0" }}>
        {poll.wordCloudEntries
          .slice()
          .sort((a, b) => b.count - a.count)
          .map((w, i) => {
            const maxW = Math.max(...poll.wordCloudEntries!.map((e) => e.count), 1);
            const minW = Math.min(...poll.wordCloudEntries!.map((e) => e.count), 1);
            const norm = maxW === minW ? 1 : (w.count - minW) / (maxW - minW);
            const size = 20 + norm * 48;
            return (
              <span
                key={w.text}
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 400 + Math.round(norm * 4) * 100,
                  fontStyle: "var(--hi-style)",
                  fontSize: size,
                  lineHeight: 1,
                  color: accents[i % 3],
                  opacity: 0.55 + norm * 0.45,
                  letterSpacing: "var(--hi-spacing)",
                  animation: `loomPop .4s ease-out ${i * 0.04}s both`,
                }}
              >
                {w.text}
              </span>
            );
          })}
      </div>
    );
  }

  // Compact ranked list for the results beat's score column.
  function scoreList(rows: { name: string; score: number }[]) {
    const top = rows[0]?.score || 1;
    return (
      <div className="flex flex-col gap-2">
        {rows.slice(0, 8).map((p, i) => (
          <div key={i} className="flex items-center gap-3" style={{ padding: "10px 14px", background: "var(--card)", border: "var(--card-border)", borderRadius: "var(--radius-sm)", animation: `loomRise .4s ease-out ${i * 0.05}s both` }}>
            <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 18, color: "var(--accent)", width: 24, textAlign: "center" }}>{i + 1}</span>
            <span style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 16, color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <div className="hidden md:block" style={{ width: 80, height: 8, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((p.score / top) * 100)}%`, background: accents[i % accents.length], borderRadius: 999, transition: "width .6s ease" }} />
            </div>
            <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 16, color: "var(--ink)", width: 56, textAlign: "right" }}>{p.score}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg)", position: "relative" }}
    >
      {/* Slim, near-chrome-free top strip */}
      <header className="flex-none flex items-center justify-between" style={{ padding: "12px 36px" }}>
        <div className="flex items-center gap-4">
          {controlMode && (
            <Link href={`/event/${id}/host`} className="transition-opacity hover:opacity-100" style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--ink)", letterSpacing: ".04em", textDecoration: "none", padding: "5px 12px", borderRadius: 999, border: "var(--card-border)", background: "var(--bg2)", opacity: 0.8 }}>← Host</Link>
          )}
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", letterSpacing: ".06em", textTransform: "uppercase" }}>{event.name}</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end" style={{ gap: 1 }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", letterSpacing: ".06em" }}>SCAN OR ENTER CODE</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 700, color: "var(--accent2)", letterSpacing: ".16em" }}>{event.accessCode}</span>
          </div>
          {typeof window !== "undefined" && (
            <EventQR url={`${window.location.origin}/join/${event.accessCode}`} size={68} />
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden" style={{ padding: controlMode ? "28px 48px 104px" : "28px 48px" }}>
        {/* Leaderboard view */}
        {showLeaderboard && leaderboard.length > 0 && (
          <div className="flex flex-col items-center justify-center h-full" style={{ animation: "loomRise .4s ease-out" }}>
            <h2
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontStyle: "var(--hi-style)",
                fontSize: 36,
                letterSpacing: "var(--hi-spacing)",
                textTransform: "var(--case)" as React.CSSProperties["textTransform"],
                color: "var(--ink)",
                marginBottom: 8,
              }}
            >
              Leaderboard
            </h2>
            <p style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", margin: "0 0 30px" }}>{leaderboardTitle}</p>
            <div className="w-full max-w-2xl space-y-3">
              {leaderboard.slice(0, 10).map((p, i) => {
                const maxScore = leaderboard[0]?.score || 1;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-4"
                    style={{
                      padding: "14px 20px",
                      background: "var(--card)",
                      border: "var(--card-border)",
                      borderRadius: "var(--radius)",
                      boxShadow: "var(--card-shadow)",
                      animation: `loomRise .4s ease-out ${i * 0.05}s both`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--display)",
                        fontWeight: 800,
                        fontSize: 24,
                        color: "var(--accent)",
                        width: 36,
                        textAlign: "center",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--body)",
                        fontWeight: 600,
                        fontSize: 20,
                        color: "var(--ink)",
                        flex: 1,
                      }}
                    >
                      {p.name}
                    </span>
                    <div className="flex-1 max-w-xs h-3" style={{ borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.round((p.score / maxScore) * 100)}%`,
                          background: accents[i % accents.length],
                          borderRadius: 999,
                          transition: "width .6s ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--mono)",
                        fontWeight: 700,
                        fontSize: 18,
                        color: "var(--ink)",
                        width: 70,
                        textAlign: "right",
                      }}
                    >
                      {p.score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active poll view */}
        {!showLeaderboard && !focusedQuestion && activePoll && (
          <div className="flex flex-col h-full" style={{ animation: "loomRise .4s ease-out" }}>
            <div className="flex items-start justify-between mb-8">
              <div>
                <div
                  className="inline-flex items-center gap-2 mb-4"
                  style={{
                    padding: "5px 11px",
                    border: "var(--chip-border)",
                    borderRadius: 999,
                  }}
                >
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>LIVE</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)" }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>
                    {activePoll.type.replace("_", " ")}
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 800,
                    fontStyle: "var(--hi-style)",
                    fontSize: 42,
                    lineHeight: 1.04,
                    letterSpacing: "var(--hi-spacing)",
                    textTransform: "var(--case)" as React.CSSProperties["textTransform"],
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  {activePoll.title}
                </h2>
              </div>
              <div className="flex items-start gap-8 flex-none">
                {pollTimeLeft !== null && (
                  <div className="text-right">
                    <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: pollTimeLeft <= 0 ? 26 : 40, lineHeight: pollTimeLeft <= 0 ? 1.5 : 1, color: pollTimeLeft <= 0 ? "var(--ok)" : pollTimeLeft <= 5 ? "var(--accent)" : "var(--ink)" }}>
                      {pollTimeLeft <= 0 ? "TIME'S UP" : `${pollTimeLeft}s`}
                    </div>
                    {pollTimeLeft > 0 && (
                      <div style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".05em", marginTop: 4 }}>
                        TIME LEFT
                      </div>
                    )}
                  </div>
                )}
                <div className="text-right">
                  <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: "var(--accent)" }}>
                    {activePoll.totalResponses}
                  </div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".05em", marginTop: 4 }}>
                    RESPONSES
                  </div>
                </div>
              </div>
            </div>

            {activePoll.imageUrl && (
              <div className="flex-none flex justify-center" style={{ margin: "4px 0 22px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activePoll.imageUrl} alt="" style={{ maxHeight: "34vh", maxWidth: "100%", objectFit: "contain", borderRadius: "var(--radius)" }} />
              </div>
            )}

            {/* Multiple choice / quiz bars — reveal the answer once time's up. */}
            {(activePoll.type === "multiple_choice" || activePoll.type === "quiz") &&
              pollBars(activePoll, pollTimeLeft !== null && pollTimeLeft <= 0)}

            {/* Word cloud */}
            {activePoll.type === "word_cloud" && pollCloud(activePoll)}
          </div>
        )}

        {/* Results beat — the closed poll's final state. For a quiz: revealed
            bars on the left, this-question scores on the right. */}
        {!showLeaderboard && resultsPoll && (() => {
          const isQuiz = resultsPoll.type === "quiz";
          return (
            <div className="flex flex-col h-full" style={{ animation: "loomRise .4s ease-out" }}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="inline-flex items-center gap-2 mb-4" style={{ padding: "5px 11px", border: "var(--chip-border)", borderRadius: 999 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--ok)" }}>RESULTS</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)" }} />
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em", textTransform: "uppercase" }}>{resultsPoll.type.replace("_", " ")}</span>
                  </div>
                  <h2 style={{ fontFamily: "var(--display)", fontWeight: 800, fontStyle: "var(--hi-style)", fontSize: 40, lineHeight: 1.04, letterSpacing: "var(--hi-spacing)", textTransform: "var(--case)" as React.CSSProperties["textTransform"], color: "var(--ink)", margin: 0 }}>{resultsPoll.title}</h2>
                </div>
                <div className="text-right flex-none">
                  <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: "var(--accent)" }}>{resultsPoll.totalResponses}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".05em", marginTop: 4 }}>RESPONSES</div>
                </div>
              </div>

              <div className={isQuiz && resultsScores.length > 0 ? "grid gap-10 flex-1 min-h-0" : "flex flex-col flex-1 min-h-0"} style={isQuiz && resultsScores.length > 0 ? { gridTemplateColumns: "1.2fr 1fr" } : undefined}>
                {/* Left / main: the question outcome */}
                <div className="flex flex-col min-h-0 justify-center">
                  {(resultsPoll.type === "multiple_choice" || resultsPoll.type === "quiz") && pollBars(resultsPoll, true)}
                  {resultsPoll.type === "word_cloud" && pollCloud(resultsPoll)}
                </div>
                {/* Right: this question's scoreboard (quiz only) */}
                {isQuiz && resultsScores.length > 0 && (
                  <div className="flex flex-col min-h-0 justify-center">
                    <p style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--accent)", margin: "0 0 14px" }}>This question</p>
                    {scoreList(resultsScores)}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Focused question */}
        {!showLeaderboard && !resultsPoll && focusedQuestion && (
          <div className="flex items-center justify-center h-full" style={{ animation: "loomPop .4s ease-out" }}>
            <div
              className="max-w-3xl w-full text-center"
              style={{
                padding: "48px 56px",
                background: "var(--card)",
                border: `2px solid var(--accent)`,
                borderRadius: "var(--radius)",
                boxShadow: "var(--card-shadow)",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--display)",
                  fontWeight: 800,
                  fontStyle: "var(--hi-style)",
                  fontSize: 38,
                  lineHeight: 1.15,
                  letterSpacing: "var(--hi-spacing)",
                  textTransform: "var(--case)" as React.CSSProperties["textTransform"],
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {focusedQuestion.content}
              </p>
              <p
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 13,
                  color: "var(--muted)",
                  marginTop: 16,
                }}
              >
                — {focusedQuestion.authorName} &middot; {focusedQuestion.voteCount} votes
              </p>
            </div>
          </div>
        )}

        {/* Default: top questions */}
        {!showLeaderboard && !resultsPoll && !focusedQuestion && !activePoll && (
          <div className="h-full flex flex-col">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div
                  className="inline-flex items-center gap-2 mb-4"
                  style={{
                    padding: "5px 11px",
                    border: "var(--chip-border)",
                    borderRadius: 999,
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
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>LIVE</span>
                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--muted)" }} />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: ".05em" }}>OPEN Q&A</span>
                </div>
                <h2
                  style={{
                    fontFamily: "var(--display)",
                    fontWeight: 800,
                    fontStyle: "var(--hi-style)",
                    fontSize: 42,
                    lineHeight: 1.04,
                    letterSpacing: "var(--hi-spacing)",
                    textTransform: "var(--case)" as React.CSSProperties["textTransform"],
                    color: "var(--ink)",
                    margin: 0,
                  }}
                >
                  Top Questions
                </h2>
              </div>
              <div className="text-right flex-none">
                <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: "var(--accent)" }}>
                  {questions.length}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".05em", marginTop: 4 }}>
                  QUESTIONS
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden space-y-3">
              {questions.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p style={{ fontFamily: "var(--body)", fontSize: 20, color: "var(--muted)" }}>
                    Waiting for questions...
                  </p>
                </div>
              ) : (
                questions.slice(0, 6).map((q, i) => (
                  <div
                    key={q.id}
                    className="flex items-stretch gap-4"
                    style={{
                      padding: "18px 22px",
                      background: q.status === "highlighted" ? "var(--bg2)" : "var(--card)",
                      border: q.status === "highlighted" ? `2px solid var(--accent)` : "var(--card-border)",
                      borderRadius: "var(--radius)",
                      boxShadow: "var(--card-shadow)",
                      animation: `loomRise .3s ease-out ${i * 0.06}s both`,
                    }}
                  >
                    <div
                      className="flex-none flex flex-col items-center justify-center"
                      style={{
                        minWidth: 56,
                        paddingRight: 18,
                        borderRight: "1px solid var(--line)",
                      }}
                    >
                      <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 26, lineHeight: 1, color: "var(--accent2)" }}>
                        {q.voteCount}
                      </span>
                      <span style={{ fontFamily: "var(--mono)", fontSize: "9px", color: "var(--muted)", letterSpacing: ".06em", marginTop: 2 }}>
                        VOTES
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center">
                      <p
                        style={{
                          fontFamily: "var(--body)",
                          fontWeight: 500,
                          fontSize: 19,
                          lineHeight: 1.3,
                          color: "var(--ink)",
                          margin: 0,
                        }}
                      >
                        {q.content}
                      </p>
                    </div>
                    <div className="flex-none flex items-center">
                      <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>— {q.authorName}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Presenter control rail (host driving the stage) */}
      {controlMode && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, padding: "12px 24px", background: "var(--surface)", borderTop: "var(--card-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, boxShadow: "0 -8px 24px -16px rgba(0,0,0,.6)" }}>
          <div className="flex items-center gap-2">
            <button onClick={goPrev} disabled={beat <= 0} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "var(--card-border)", cursor: beat <= 0 ? "default" : "pointer", background: "var(--bg2)", color: "var(--ink)", opacity: beat <= 0 ? 0.4 : 1 }}>◀ Prev</button>
            <button onClick={goNext} disabled={beat >= lastBeat} title={activePoll ? "Close the poll and show its results" : resultsPoll ? "Move on to the next question" : "Open the first poll"} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 20px", borderRadius: "var(--radius-sm)", border: "none", cursor: beat >= lastBeat ? "default" : "pointer", background: "var(--accent)", color: "var(--on-accent)", opacity: beat >= lastBeat ? 0.4 : 1 }}>
              {activePoll ? "Results ▶" : resultsPoll ? "Next ▶" : polls.length ? "Start ▶" : "Next ▶"}
            </button>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", marginLeft: 10, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {deckPos === 0 ? "Q&A — audience questions" : `${currentPoll?.title ?? ""} · ${inResults ? "results" : "live"} · ${deckPos}/${polls.length}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showLeaderboard ? (
              <button onClick={hideLeaderboard} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 16px", borderRadius: "var(--radius-sm)", border: "var(--card-border)", cursor: "pointer", background: "var(--bg2)", color: "var(--ink)" }}>Hide board</button>
            ) : (
              <button onClick={showOverall} disabled={!hasQuiz} title="Cumulative scores across all questions" style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "var(--card-border)", cursor: hasQuiz ? "pointer" : "default", background: "var(--bg2)", color: "var(--ink)", opacity: hasQuiz ? 1 : 0.4 }}>🏆 Overall</button>
            )}
            <button onClick={endEventAction} style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 14, padding: "10px 18px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--accent2)", cursor: "pointer", background: "transparent", color: "var(--accent2)" }}>■ End</button>
          </div>
        </div>
      )}
    </div>
  );
}
