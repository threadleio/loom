import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { code, passcode } = body;

  if (!code) {
    return NextResponse.json({ error: "Access code is required" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { accessCode: code.toUpperCase().trim() },
    include: { rooms: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== "live") {
    const ended = event.status === "ended" || event.status === "archived";
    return NextResponse.json(
      {
        error: ended ? "This session has ended" : "This session hasn't started yet",
        eventStatus: event.status,
      },
      { status: 403 }
    );
  }

  if (event.passcode) {
    if (!passcode) {
      return NextResponse.json(
        { error: "Passcode required", requiresPasscode: true },
        { status: 401 }
      );
    }
    if (passcode.trim() !== event.passcode) {
      return NextResponse.json(
        { error: "Incorrect passcode", requiresPasscode: true },
        { status: 401 }
      );
    }
  }

  return NextResponse.json({ eventId: event.id, name: event.name });
}
