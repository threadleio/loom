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

  const poll = await prisma.poll.findFirst({
    where: { roomId: mainRoom.id, status: "active" },
    include: {
      options: {
        orderBy: { order: "asc" },
        include: { _count: { select: { responses: true } } },
      },
      responses: {
        select: { textValue: true },
      },
      _count: { select: { responses: true } },
    },
  });

  if (!poll) return NextResponse.json(null, { status: 404 });

  const wordCloudEntries =
    poll.type === "word_cloud"
      ? Object.entries(
          poll.responses.reduce<Record<string, number>>((acc, r) => {
            const word = (r.textValue || "").trim().toLowerCase();
            if (word) acc[word] = (acc[word] || 0) + 1;
            return acc;
          }, {})
        ).map(([text, count]) => ({ text, count }))
      : undefined;

  return NextResponse.json({
    id: poll.id,
    title: poll.title,
    type: poll.type,
    status: poll.status,
    imageUrl: poll.imageUrl,
    timerSeconds: poll.timerSeconds,
    activatedAt: poll.activatedAt,
    correctAnswer: poll.correctAnswer,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      responseCount: o._count.responses,
    })),
    totalResponses: poll._count.responses,
    wordCloudEntries,
    createdAt: poll.createdAt,
  });
}
