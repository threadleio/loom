import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Host writes (or clears) a written answer for a question. Owner-only.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id, questionId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.createdBy !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { answer } = await request.json();
  const trimmed = typeof answer === "string" ? answer.trim().slice(0, 1000) : "";

  const updated = await prisma.question.update({
    where: { id: questionId },
    data: {
      answer: trimmed || null,
      answeredAt: trimmed ? new Date() : null,
    },
  });

  return NextResponse.json({ id: updated.id, answer: updated.answer, answeredAt: updated.answeredAt });
}
