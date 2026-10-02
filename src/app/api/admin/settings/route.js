import { PrismaClient } from '@prisma/client'

import { requireAdmin } from '../_auth'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const setting = await prisma.appSetting.findUnique({ where: { key: 'pricingCopy' } })
    return Response.json({ success: true, pricing: setting ? JSON.parse(setting.value) : null })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const gate = await requireAdmin(request)

    if (gate.error) return gate.error

    const { pricing } = await request.json()
    if (!Array.isArray(pricing)) return Response.json({ success: false, error: 'Pricing copy must be a list of plans.' }, { status: 400 })

    const safePricing = pricing.map(plan => ({
      key: String(plan.key || '').slice(0, 80),
      name: String(plan.name || '').slice(0, 120),
      badge: String(plan.badge || '').slice(0, 120),
      interval: String(plan.interval || '').slice(0, 60),
      bullets: Array.isArray(plan.bullets) ? plan.bullets.map(item => String(item).slice(0, 300)).slice(0, 30) : [],
      cta: String(plan.cta || '').slice(0, 120),
      footnote: String(plan.footnote || '').slice(0, 300),
      displayAmount: plan.displayAmount === '' || plan.displayAmount == null ? null : String(plan.displayAmount).slice(0, 40)
    }))

    await prisma.appSetting.upsert({
      where: { key: 'pricingCopy' },
      create: { key: 'pricingCopy', value: JSON.stringify(safePricing) },
      update: { value: JSON.stringify(safePricing) }
    })

    return Response.json({ success: true, pricing: safePricing })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}
