import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const { questionId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingVote = await prisma.vote.findUnique({
    where: {
      questionId_userId: {
        questionId,
        userId: session.user.id,
      },
    },
  });

  if (existingVote) {
    await prisma.vote.delete({ where: { id: existingVote.id } });
    const count = await prisma.vote.count({ where: { questionId } });
    return NextResponse.json({ voted: false, voteCount: count });
  } else {
    await prisma.vote.create({
      data: {
        questionId,
        userId: session.user.id,
      },
    });
    const count = await prisma.vote.count({ where: { questionId } });
    return NextResponse.json({ voted: true, voteCount: count });
  }
}
