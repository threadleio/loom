import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const roomIdParam = searchParams.get("roomId");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const mainRoom = roomIdParam
    ? event.rooms.find((r) => r.id === roomIdParam)
    : event.rooms[0];
  if (!mainRoom) return NextResponse.json([], { status: 200 });

  const quizPolls = await prisma.poll.findMany({
    where: { roomId: mainRoom.id, type: "quiz" },
    select: { id: true },
  });

  const responses = await prisma.pollResponse.findMany({
    where: { pollId: { in: quizPolls.map((p) => p.id) } },
    include: { user: { select: { displayName: true } } },
  });

  const scores: Record<string, { userId: string; name: string; score: number }> = {};
  for (const r of responses) {
    if (!scores[r.userId]) {
      scores[r.userId] = { userId: r.userId, name: r.user.displayName, score: 0 };
    }
    scores[r.userId].score += r.score;
  }

  const leaderboard = Object.values(scores).sort((a, b) => b.score - a.score);

  return NextResponse.json(leaderboard);
}
