import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

import { isValidEmail, passwordIssue } from '@/utils/credentials';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { username, email, password } = await request.json();
    const trimmedEmail = String(email || '').trim();
    const trimmedName = String(username || '').trim();

    if (!trimmedEmail || !password || !trimmedName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (trimmedName.length < 2) {
      return NextResponse.json({ error: 'Username must be at least 2 characters.' }, { status: 400 });
    }
    if (!isValidEmail(trimmedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    const issue = passwordIssue(password);
    if (issue) {
      return NextResponse.json({ error: issue }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail }
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
        name: trimmedName,
        email: trimmedEmail,
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
