import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getServerSession } from "next-auth/next"
import { authOptions } from '@/libs/auth'
import { ensureAiMetaFunctions } from '@/libs/wpThemeFunctions'
import { effectiveWebsiteLimit, getWebsiteLimitDefaults } from '@/libs/entitlement'

const prisma = new PrismaClient()

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const [sites, defaults] = await Promise.all([
      prisma.customWPSite.findMany({ where: { userId: user.id } }),
      getWebsiteLimitDefaults()
    ])
    const websiteLimit = effectiveWebsiteLimit(user, defaults)

    return NextResponse.json({
      sites,
      websiteLimit,
      unlimited: websiteLimit == null,
      websitesUsed: sites.length
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const body = await request.json()
    const { name, url, username, password } = body

    if (!name || !url || !username || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const defaults = await getWebsiteLimitDefaults()
    const websiteLimit = effectiveWebsiteLimit(user, defaults)

    if (websiteLimit != null) {
      const saved = await prisma.customWPSite.count({ where: { userId: user.id } })

      if (saved >= websiteLimit) {
        return NextResponse.json(
          {
            error: `This plan can save ${websiteLimit} website${websiteLimit === 1 ? '' : 's'}. Only the Max plan can add unlimited websites.`
          },
          { status: 403 }
        )
      }
    }

    const newSite = await prisma.customWPSite.create({
      data: {
        userId: user.id,
        name,
        url,
        username,
        password
      }
    })

    const functionsPhp = await ensureAiMetaFunctions({ siteUrl: url, username, password })

    return NextResponse.json({ success: true, site: newSite, functionsPhp, websiteLimit, unlimited: websiteLimit == null })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Failed to save site" }, { status: 500 })
  }
}