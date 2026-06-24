"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { SkinOverlay } from "@/components/skin-overlay";
import { useTheme } from "@/components/theme-provider";
import { RoomSwitcher } from "@/components/room-switcher";

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
}

interface EventData {
  id: string;
  name: string;
  accessCode: string;
  status: string;
  rooms: { id: string; name: string }[];
}

export default function PresentViewPage() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const [event, setEvent] = useState<EventData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activePoll, setActivePoll] = useState<PollData | null>(null);
  const [focusedQuestion, setFocusedQuestion] = useState<Question | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number }[]>([]);
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
    fetchQuestions();
    fetchActivePoll();
  }, [activeRoomId, fetchQuestions, fetchActivePoll]);

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
      fetchActivePoll();
    });
    socket.on("poll:leaderboard", (data: { pollId?: string; roomId?: string; leaderboard: { name: string; score: number }[] }) => {
      if (data?.roomId && data.roomId !== activeRoomIdRef.current) return;
      setLeaderboard(data.leaderboard);
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
      </div>
    );
  }

  const accents = ["var(--accent)", "var(--accent2)", "var(--accent3)", "var(--ink)"];

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg)", position: "relative" }}
    >
      {/* Minimal header */}
      <header
        className="flex-none flex items-center justify-between"
        style={{
          padding: "16px 40px",
          background: "var(--surface)",
          borderBottom: "var(--card-border)",
        }}
      >
        <div className="flex items-center gap-[14px]">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "calc(var(--radius-sm) * .8)",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--logo-shadow)",
            }}
          >
            <div
              style={{
                width: 17,
                height: 17,
                border: "3px solid var(--on-accent)",
                borderRadius: 6,
              }}
            />
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontStyle: "var(--hi-style)",
                fontSize: 22,
                letterSpacing: "var(--hi-spacing)",
                textTransform: "var(--case)" as React.CSSProperties["textTransform"],
                color: "var(--ink)",
                lineHeight: 1,
              }}
            >
              {event.name}
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: "10.5px",
                color: "var(--muted)",
                letterSpacing: ".04em",
                marginTop: 3,
              }}
            >
              Loom &middot; live rooms
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          {event.rooms && event.rooms.length > 1 && (
            <RoomSwitcher
              rooms={event.rooms}
              activeRoomId={activeRoomId}
              onRoomChange={(roomId) => setActiveRoomId(roomId)}
              eventId={id}
            />
          )}
          <div className="text-right">
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                color: "var(--muted)",
                letterSpacing: ".06em",
              }}
            >
              JOIN CODE
            </div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--accent2)",
                letterSpacing: ".18em",
              }}
            >
              {event.accessCode}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 relative overflow-hidden" style={{ padding: "40px 48px" }}>
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
                marginBottom: 32,
              }}
            >
              Leaderboard
            </h2>
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
                    <div style={{ fontFamily: "var(--display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: pollTimeLeft <= 5 ? "var(--accent)" : "var(--ink)" }}>
                      {pollTimeLeft}s
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: "10.5px", color: "var(--muted)", letterSpacing: ".05em", marginTop: 4 }}>
                      TIME LEFT
                    </div>
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

            {/* Multiple choice / quiz bars */}
            {(activePoll.type === "multiple_choice" || activePoll.type === "quiz") && (
              <div className="flex flex-col gap-4 flex-1 justify-center">
                {activePoll.options.map((opt, i) => {
                  const pct = activePoll.totalResponses > 0 ? Math.round((opt.responseCount / activePoll.totalResponses) * 100) : 0;
                  const maxCount = Math.max(...activePoll.options.map((o) => o.responseCount), 1);
                  const isLeading = opt.responseCount === maxCount && opt.responseCount > 0;
                  return (
                    <div key={opt.id} className="flex items-center gap-4" style={{ animation: `loomRise .3s ease-out ${i * 0.08}s both` }}>
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
                          background: isLeading ? accents[i % accents.length] : "var(--bg2)",
                          color: isLeading ? "var(--on-accent)" : "var(--ink)",
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-2">
                          <span style={{ fontFamily: "var(--body)", fontWeight: 600, fontSize: 20, color: "var(--ink)" }}>{opt.text}</span>
                          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: 18, color: "var(--ink)" }}>{pct}%</span>
                        </div>
                        <div style={{ height: 20, borderRadius: 999, background: "var(--track)", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: accents[i % accents.length],
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
            )}

            {/* Word cloud */}
            {activePoll.type === "word_cloud" && activePoll.wordCloudEntries && (
              <div className="flex-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2" style={{ padding: "20px 0" }}>
                {activePoll.wordCloudEntries
                  .sort((a, b) => b.count - a.count)
                  .map((w, i) => {
                    const maxW = Math.max(...activePoll.wordCloudEntries!.map((e) => e.count), 1);
                    const minW = Math.min(...activePoll.wordCloudEntries!.map((e) => e.count), 1);
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
            )}
          </div>
        )}

        {/* Focused question */}
        {!showLeaderboard && focusedQuestion && (
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
        {!showLeaderboard && !focusedQuestion && !activePoll && (
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
    </div>
  );
}
