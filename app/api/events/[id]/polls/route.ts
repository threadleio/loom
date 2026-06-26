import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Keep configurable quiz points sane: a positive integer, generously capped.
function clampPoints(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1000;
  return Math.min(100000, Math.max(1, n));
}

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

  const polls = await prisma.poll.findMany({
    where: { roomId: mainRoom.id },
    include: {
      options: { orderBy: { order: "asc" } },
      _count: { select: { responses: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    polls.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      imageUrl: p.imageUrl,
      timerSeconds: p.timerSeconds,
      points: p.points,
      scoreMode: p.scoreMode,
      correctAnswer: p.correctAnswer,
      options: p.options.map((o) => ({ id: o.id, text: o.text, order: o.order })),
      totalResponses: p._count.responses,
      createdAt: p.createdAt,
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const body = await request.json();
  const { title, type, options, imageUrl, timerSeconds, correctAnswer, roomId, points, scoreMode } = body;
  const mainRoom = roomId
    ? event.rooms.find((r: { id: string }) => r.id === roomId)
    : event.rooms[0];
  if (!mainRoom)
    return NextResponse.json({ error: "No room found" }, { status: 404 });

  if (!title || !type)
    return NextResponse.json({ error: "Title and type required" }, { status: 400 });

  const pollOrder = await prisma.poll.count({ where: { roomId: mainRoom.id } });
  const poll = await prisma.poll.create({
    data: {
      roomId: mainRoom.id,
      title,
      type,
      imageUrl: imageUrl || null,
      timerSeconds: timerSeconds || 30,
      points: clampPoints(points),
      scoreMode: scoreMode === "flat" ? "flat" : "speed",
      correctAnswer: correctAnswer || null,
      order: pollOrder,
      options: {
        create: (options || []).map((text: string, i: number) => ({
          text,
          order: i,
        })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(poll, { status: 201 });
}
