import { PrismaClient } from '@prisma/client'

import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()
if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'pricingCopy' } })
    return Response.json({ success: true, pricing: setting ? JSON.parse(setting.value) : null })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}
