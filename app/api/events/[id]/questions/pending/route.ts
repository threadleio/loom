import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomIdParam = searchParams.get("roomId");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true },
  });

  if (!event || event.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mainRoom = roomIdParam
    ? event.rooms.find((r) => r.id === roomIdParam)
    : event.rooms[0];
  if (!mainRoom) {
    return NextResponse.json({ error: "No room found" }, { status: 404 });
  }

  const questions = await prisma.question.findMany({
    where: { roomId: mainRoom.id, status: "pending" },
    include: {
      author: { select: { displayName: true } },
      _count: { select: { votes: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const formatted = questions.map((q) => ({
    id: q.id,
    content: q.content,
    authorName: q.isAnonymous ? "Anonymous" : q.author.displayName,
    isAnonymous: q.isAnonymous,
    voteCount: q._count.votes,
    status: q.status,
    createdAt: q.createdAt,
  }));

  return NextResponse.json(formatted);
}
