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
