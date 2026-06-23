import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const mainRoom = roomId
    ? event.rooms.find((r) => r.id === roomId)
    : event.rooms[0];
  if (!mainRoom) {
    return NextResponse.json({ error: "No room found" }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const baseVisible = event.moderationEnabled
    ? { status: { in: ["approved", "highlighted"] } }
    : { status: { not: "rejected" } };

  const where = userId
    ? {
        roomId: mainRoom.id,
        OR: [baseVisible, { authorId: userId, status: "pending" }],
      }
    : { roomId: mainRoom.id, ...baseVisible };

  const questions = await prisma.question.findMany({
    where,
    include: {
      author: { select: { displayName: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  let userVotes: string[] = [];
  if (userId) {
    const votes = await prisma.vote.findMany({
      where: { userId, questionId: { in: questions.map((q) => q.id) } },
      select: { questionId: true },
    });
    userVotes = votes.map((v) => v.questionId);
  }

  const formatted = questions.map((q) => ({
    id: q.id,
    content: q.content,
    authorName: q.isAnonymous ? "Anonymous" : q.author.displayName,
    isAnonymous: q.isAnonymous,
    voteCount: q._count.votes,
    hasVoted: userVotes.includes(q.id),
    status: q.status,
    isOwn: q.authorId === userId,
    createdAt: q.createdAt,
  }));

  formatted.sort((a, b) => b.voteCount - a.voteCount);

  return NextResponse.json(formatted);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { content, isAnonymous, roomId } = body;

  if (!content || content.length > 300) {
    return NextResponse.json(
      { error: "Content is required and must be 300 characters or less" },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const mainRoom = roomId
    ? event.rooms.find((r: { id: string }) => r.id === roomId)
    : event.rooms[0];
  if (!mainRoom) {
    return NextResponse.json({ error: "No room found" }, { status: 404 });
  }

  const question = await prisma.question.create({
    data: {
      content,
      isAnonymous: isAnonymous || false,
      status: event.moderationEnabled ? "pending" : "approved",
      roomId: mainRoom.id,
      authorId: session.user.id,
    },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { votes: true } },
    },
  });

  return NextResponse.json(
    {
      id: question.id,
      content: question.content,
      authorName: question.isAnonymous ? "Anonymous" : question.author.displayName,
      isAnonymous: question.isAnonymous,
      voteCount: question._count.votes,
      hasVoted: false,
      status: question.status,
      createdAt: question.createdAt,
    },
    { status: 201 }
  );
}
