import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { pollId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status } = body;

  if (!["draft", "active", "closed"].includes(status))
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { room: true },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

  if (status === "active") {
    await prisma.poll.updateMany({
      where: { roomId: poll.roomId, status: "active" },
      data: { status: "closed" },
    });
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: { status, ...(status === "active" ? { activatedAt: new Date() } : {}) },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { pollId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { room: { include: { event: true } } },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (poll.room.event.createdBy !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Options and responses cascade from the poll.
  await prisma.poll.delete({ where: { id: pollId } });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { pollId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: { room: { include: { event: true } } },
  });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (poll.room.event.createdBy !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // A launched poll has responses tied to its options — editing those would
  // corrupt the results, so only drafts can be edited.
  if (poll.status !== "draft")
    return NextResponse.json({ error: "Only draft polls can be edited" }, { status: 400 });

  const body = await request.json();
  const { title, type, options, imageUrl, timerSeconds, correctOptionIndex } = body;
  if (!title || !type)
    return NextResponse.json({ error: "Title and type required" }, { status: 400 });

  // Drafts have no responses, so the options can be replaced wholesale.
  const [, updated] = await prisma.$transaction([
    prisma.pollOption.deleteMany({ where: { pollId } }),
    prisma.poll.update({
      where: { id: pollId },
      data: {
        title,
        type,
        imageUrl: imageUrl || null,
        timerSeconds: timerSeconds || 30,
        correctAnswer: null,
        options: {
          create: (options || []).map((text: string, i: number) => ({ text, order: i })),
        },
      },
      include: { options: { orderBy: { order: "asc" } } },
    }),
  ]);

  if (type === "quiz" && typeof correctOptionIndex === "number" && updated.options[correctOptionIndex]) {
    await prisma.poll.update({
      where: { id: pollId },
      data: { correctAnswer: updated.options[correctOptionIndex].id },
    });
  }

  return NextResponse.json(updated);
}
