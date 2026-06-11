import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';

const prisma = new PrismaClient();

// GET: Fetch User Data
export async function GET(request) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, supportPin: true, name: true }
    });

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}

// PATCH: Update Email
export async function PATCH(request) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newEmail } = await request.json();

  if (!newEmail) {
    return NextResponse.json({ error: "New email is required" }, { status: 400 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { email: newEmail }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    // Prisma code P2002 means unique constraint failed (email already in use)
    if (error.code === 'P2002') {
        return NextResponse.json({ error: "Email is already in use by another account" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
  }
}
