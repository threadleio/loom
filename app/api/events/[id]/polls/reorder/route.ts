import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Rewrites the deck order: each poll's `order` becomes its index in the
// provided list. Owner-only; applied in a single transaction.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.createdBy !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { orderedIds } = await request.json();
  if (!Array.isArray(orderedIds))
    return NextResponse.json({ error: "orderedIds array required" }, { status: 400 });

  await prisma.$transaction(
    orderedIds.map((pollId: string, index: number) =>
      prisma.poll.update({ where: { id: pollId }, data: { order: index } })
    )
  );

  return NextResponse.json({ ok: true });
}
