import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { status } = body;

  const validStatuses = ["approved", "rejected", "highlighted", "archived", "pending"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  if (status === "highlighted") {
    const target = await prisma.question.findUnique({
      where: { id: questionId },
      select: { roomId: true },
    });
    if (target) {
      await prisma.question.updateMany({
        where: { roomId: target.roomId, status: "highlighted", NOT: { id: questionId } },
        data: { status: "approved" },
      });
    }
  }

  const question = await prisma.question.update({
    where: { id: questionId },
    data: { status },
  });

  return NextResponse.json(question);
}
