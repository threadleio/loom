import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const body = await request.json();
  const { email, password, displayName } = body;

  if (!email || !password || !displayName) {
    return NextResponse.json(
      { error: "Email, password, and display name are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "User with this email already exists" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      displayName,
      isGuest: false,
      role: "host",
    },
  });

  return NextResponse.json({ id: user.id, displayName: user.displayName });
}
