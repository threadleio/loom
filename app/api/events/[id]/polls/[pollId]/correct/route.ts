import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; pollId: string }> }
) {
  const { pollId } = await params;
  const body = await request.json();
  const { correctAnswer } = body;

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: { correctAnswer },
  });

  return NextResponse.json(updated);
}
