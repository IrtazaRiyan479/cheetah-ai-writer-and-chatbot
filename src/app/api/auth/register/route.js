import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();

    // 1. Validate inputs
    if (!email || !password || !username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // 3. Hash the password securely
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Generate a random 4-digit Support PIN
    const supportPin = Math.floor(1000 + Math.random() * 9000).toString();

    // 5. Save the new user to the database
    await prisma.user.create({
      data: {
        name: username,
        email: email,
        password: hashedPassword,
        supportPin: supportPin, // <-- Save the generated PIN
      }
    });

    return NextResponse.json({ success: true, message: 'User created successfully' });
  } catch (error) {
    console.error('Registration Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
