import { PrismaClient } from '@prisma/client'

import { FEATURE_KEYS, FEATURE_META, getFeatureModes } from '@/libs/entitlement'
import { serializeError } from '@/utils/serializeError'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'pricingCopy' } })
    const featureModes = await getFeatureModes()
    const features = FEATURE_KEYS.map(key => ({
      key,
      label: FEATURE_META[key]?.label || key,
      group: FEATURE_META[key]?.group || 'Other',
      mode: featureModes[key],
      pricing: FEATURE_META[key]?.pricing !== false
    })).filter(feature => feature.mode !== 'off' && feature.pricing)

    return Response.json({ success: true, pricing: setting ? JSON.parse(setting.value) : null, features, modes: featureModes })
  } catch (error) {
    return Response.json({ success: false, error: serializeError(error) }, { status: 500 })
  }
}
