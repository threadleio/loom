import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rooms = await prisma.room.findMany({
    where: { eventId: id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(rooms);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name } = body;

  if (!name?.trim())
    return NextResponse.json({ error: "Name required" }, { status: 400 });

  const room = await prisma.room.create({
    data: { eventId: id, name: name.trim() },
  });

  return NextResponse.json(room, { status: 201 });
}
