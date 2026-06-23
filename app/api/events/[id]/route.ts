import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: { rooms: true, host: { select: { displayName: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

const EVENT_TRANSITIONS: Record<string, string[]> = {
  draft: ["live", "archived"],
  live: ["ended"],
  ended: ["live", "archived"],
  archived: ["ended"],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.createdBy !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status } = await request.json();
  const allowed = EVENT_TRANSITIONS[event.status] || [];
  if (!status || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `Cannot move event from "${event.status}" to "${status}"` },
      { status: 400 }
    );
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      status,
      endedAt:
        status === "ended" ? new Date() : status === "live" ? null : event.endedAt,
    },
  });

  return NextResponse.json(updated);
}
