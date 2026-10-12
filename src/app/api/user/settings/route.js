import { NextResponse } from 'next/server';

import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/libs/auth';
import { planTier } from '@/libs/entitlement';
import { isValidEmail } from '@/utils/credentials';

const prisma = new PrismaClient();

export async function GET(request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        supportPin: true,
        name: true,
        role: true,
        plan: true,
        subscriptionStatus: true,
        wordsUsed: true,
        wordsLimit: true,
        wordsLimitCustomized: true,
        stripeCustomerId: true
      }
    })

    const tier = planTier(user)
    const paid = tier === 'pro' || tier === 'max' || tier === 'admin'
    const isMax = tier === 'max' || tier === 'admin'
    const capSetting = await prisma.appSetting.findUnique({ where: { key: 'globalFreeWordCap' } }).catch(() => null)
    const globalCap = capSetting ? Math.max(0, Number(capSetting.value) || 0) : 5000
    const wordsLimit = user?.wordsLimitCustomized ? user.wordsLimit : globalCap
    const flags = await prisma.featureFlag.findMany().catch(() => [])
    const featureModes = {}
    flags.forEach(flag => {
      if (flag.mode === 'off' || flag.enabled === false) featureModes[flag.key] = 'off'
      else if (flag.mode) featureModes[flag.key] = flag.mode
      else featureModes[flag.key] = flag.free ? 'free' : 'pro'
    })

    return NextResponse.json({
      user: user
        ? {
            id: user.id,
            email: user.email,
            supportPin: user.supportPin,
            name: user.name,
            role: user.role,
            plan: user.plan,
            tier,
            subscriptionStatus: user.subscriptionStatus,
            wordsUsed: user.wordsUsed,
            wordsLimit,
            paid,
            isMax,
            hasStripeCustomer: Boolean(user.stripeCustomerId)
          }
        : null,
      featureModes
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newEmail } = await request.json();

  if (!isValidEmail(newEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: { email: newEmail }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);

    if (error.code === 'P2002') {
        return NextResponse.json({ error: "Email is already in use by another account" }, { status: 400 });
    }


return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
  }
}
