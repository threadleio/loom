import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  if (!mainRoom) return NextResponse.json({ error: "No room" }, { status: 404 });

  const questions = await prisma.question.findMany({
    where: { roomId: mainRoom.id },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { votes: true } },
    },
  });

  const totalVotes = await prisma.vote.count({
    where: { question: { roomId: mainRoom.id } },
  });

  const polls = await prisma.poll.findMany({
    where: { roomId: mainRoom.id },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { _count: { select: { responses: true } } },
      },
      responses: {
        include: { user: { select: { displayName: true } } },
      },
      _count: { select: { responses: true } },
    },
  });

  const totalPollResponses = polls.reduce((sum, p) => sum + p._count.responses, 0);
  const uniqueParticipantIds = new Set<string>();
  questions.forEach((q) => uniqueParticipantIds.add(q.authorId));
  polls.forEach((p) => p.responses.forEach((r) => uniqueParticipantIds.add(r.userId)));

  // Quiz leaderboard: total score per participant across all quiz polls.
  const quizScores = new Map<string, { name: string; score: number }>();
  for (const p of polls) {
    if (p.type !== "quiz") continue;
    for (const r of p.responses) {
      const current = quizScores.get(r.userId) ?? { name: r.user.displayName, score: 0 };
      current.score += r.score;
      quizScores.set(r.userId, current);
    }
  }
  const leaderboard = [...quizScores.values()].sort((a, b) => b.score - a.score);

  const totalParticipants = uniqueParticipantIds.size;
  const engagementRate =
    totalParticipants > 0
      ? Math.round(
          ((questions.length + totalVotes + totalPollResponses) /
            (totalParticipants * 3)) *
            100
        )
      : 0;

  return NextResponse.json({
    eventName: event.name,
    totalParticipants,
    totalQuestions: questions.length,
    totalVotes,
    totalPollResponses,
    engagementRate: Math.min(engagementRate, 100),
    leaderboard,
    questions: questions.map((q) => ({
      content: q.content,
      author: q.isAnonymous ? "Anonymous" : q.author.displayName,
      votes: q._count.votes,
      status: q.status,
      isAnonymous: q.isAnonymous,
      createdAt: q.createdAt,
    })),
    polls: polls.map((p) => ({
      title: p.title,
      type: p.type,
      status: p.status,
      totalResponses: p._count.responses,
      options: p.options.map((o) => ({
        text: o.text,
        responses: o._count.responses,
      })),
    })),
  });
}
