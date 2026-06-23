import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateAccessCode } from "@/lib/generate-code";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "host") {
    return NextResponse.json(
      { error: "Only hosts can create events" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, startDate, endDate, passcode, moderationEnabled } = body;

  if (!name || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Name, start date, and end date are required" },
      { status: 400 }
    );
  }

  let accessCode = generateAccessCode();
  let exists = await prisma.event.findUnique({ where: { accessCode } });
  while (exists) {
    accessCode = generateAccessCode();
    exists = await prisma.event.findUnique({ where: { accessCode } });
  }

  const event = await prisma.event.create({
    data: {
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      accessCode,
      passcode: passcode || null,
      moderationEnabled: moderationEnabled || false,
      createdBy: session.user.id,
      rooms: {
        create: { name: "Main" },
      },
    },
    include: { rooms: true },
  });

  return NextResponse.json(event, { status: 201 });
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { createdBy: session.user.id },
    include: { rooms: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(events);
}
