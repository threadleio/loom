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

  const body = await request.json();
  const { status, name, passcode, moderationEnabled, allowAnonymous } = body;
  const data: Record<string, unknown> = {};

  // Status changes still go through the lifecycle state machine.
  if (status !== undefined) {
    const allowed = EVENT_TRANSITIONS[event.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot move event from "${event.status}" to "${status}"` },
        { status: 400 }
      );
    }
    data.status = status;
    data.endedAt =
      status === "ended" ? new Date() : status === "live" ? null : event.endedAt;
  }

  // Inline-editable settings (rename, passcode, moderation).
  if (name !== undefined) {
    data.name = (typeof name === "string" && name.trim()) || "Live session";
  }
  if (passcode !== undefined) {
    data.passcode = (typeof passcode === "string" && passcode.trim()) || null;
  }
  if (moderationEnabled !== undefined) {
    data.moderationEnabled = !!moderationEnabled;
  }
  if (allowAnonymous !== undefined) {
    data.allowAnonymous = !!allowAnonymous;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.event.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(
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

  // Rooms → polls/questions → options/responses/votes all cascade from here.
  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
