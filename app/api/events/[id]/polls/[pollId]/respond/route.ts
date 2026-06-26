import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { pollId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poll = await prisma.poll.findUnique({ where: { id: pollId } });
  if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
  if (poll.status !== "active")
    return NextResponse.json({ error: "Poll is not active" }, { status: 400 });

  if (poll.type !== "word_cloud") {
    const existing = await prisma.pollResponse.findFirst({
      where: { pollId, userId: session.user.id },
    });
    if (existing)
      return NextResponse.json({ error: "Already responded" }, { status: 409 });
  }

  const body = await request.json();
  const { optionId, textValue } = body;

  let score = 0;
  if (poll.type === "quiz" && optionId) {
    const option = await prisma.pollOption.findUnique({ where: { id: optionId } });
    if (option && poll.correctAnswer === option.id) {
      const max = poll.points;
      if (poll.scoreMode === "flat") {
        // Flat: a correct answer is worth exactly the configured points.
        score = max;
      } else {
        // Speed-weighted: 50–100% of the points, scaled by time remaining.
        const totalMs = poll.timerSeconds * 1000;
        const elapsed = poll.activatedAt ? Date.now() - new Date(poll.activatedAt).getTime() : 0;
        const remaining = Math.max(0, Math.min(totalMs, totalMs - elapsed));
        score = Math.round(max * (0.5 + 0.5 * (remaining / totalMs)));
      }
    }
  }

  const response = await prisma.pollResponse.create({
    data: {
      pollId,
      optionId: optionId || null,
      textValue: textValue || null,
      userId: session.user.id,
      score,
    },
  });

  return NextResponse.json(
    { id: response.id, score, correct: poll.type === "quiz" ? score > 0 : undefined },
    { status: 201 }
  );
}
