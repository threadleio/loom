import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    path: "/api/socketio",
    addTrailingSlash: false,
  });

  io.on("connection", (socket) => {
    socket.on("join-event", (eventId: string) => {
      socket.join(`event:${eventId}`);
    });

    socket.on("leave-event", (eventId: string) => {
      socket.leave(`event:${eventId}`);
    });

    socket.on("question:new", (data: { eventId: string; roomId?: string; question: unknown }) => {
      io.to(`event:${data.eventId}`).emit("question:new", { ...(data.question as object), _roomId: data.roomId });
    });

    socket.on("question:vote", (data: { eventId: string; roomId?: string; questionId: string; voteCount: number }) => {
      io.to(`event:${data.eventId}`).emit("question:vote", {
        questionId: data.questionId,
        voteCount: data.voteCount,
        roomId: data.roomId,
      });
    });

    socket.on("question:status", (data: { eventId: string; roomId?: string; questionId: string; status: string }) => {
      io.to(`event:${data.eventId}`).emit("question:status", {
        questionId: data.questionId,
        status: data.status,
        roomId: data.roomId,
      });
    });

    socket.on("question:answered", (data: { eventId: string; roomId?: string; questionId: string; answer: string | null }) => {
      io.to(`event:${data.eventId}`).emit("question:answered", {
        questionId: data.questionId,
        answer: data.answer,
        roomId: data.roomId,
      });
    });

    socket.on("poll:activated", (data: { eventId: string; roomId?: string; pollId: string }) => {
      io.to(`event:${data.eventId}`).emit("poll:activated", { pollId: data.pollId, roomId: data.roomId });
    });

    socket.on("poll:response", (data: { eventId: string; roomId?: string; pollId: string }) => {
      io.to(`event:${data.eventId}`).emit("poll:response", { pollId: data.pollId, roomId: data.roomId });
    });

    socket.on("poll:closed", (data: { eventId: string; roomId?: string; pollId: string }) => {
      io.to(`event:${data.eventId}`).emit("poll:closed", { pollId: data.pollId, roomId: data.roomId });
    });

    // The results beat: a closed poll's final bars (+ this-question scores).
    socket.on("poll:results", (data: { eventId: string; roomId?: string; poll: unknown; scores?: { name: string; score: number }[] }) => {
      io.to(`event:${data.eventId}`).emit("poll:results", { poll: data.poll, scores: data.scores, roomId: data.roomId });
    });

    socket.on("poll:leaderboard", (data: { eventId: string; roomId?: string; pollId?: string; leaderboard: { name: string; score: number }[]; title?: string; hide?: boolean }) => {
      io.to(`event:${data.eventId}`).emit("poll:leaderboard", { leaderboard: data.leaderboard, roomId: data.roomId, pollId: data.pollId, title: data.title, hide: data.hide });
    });

    socket.on("event:status", (data: { eventId: string; status: string }) => {
      io.to(`event:${data.eventId}`).emit("event:status", { status: data.status });
    });
  });

  (globalThis as unknown as Record<string, unknown>).io = io;

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
