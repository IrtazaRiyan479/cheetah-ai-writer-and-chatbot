import { NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/libs/auth'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

function usableUrl(value) {
  const url = String(value || '')
    .trim()
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(new RegExp('&' + 'amp;', 'gi'), '&')

  if (!url || url.startsWith('data:') || url.length > 4000) return ''
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return ''

  return url
}

function imageFromSrcChunk(chunk) {
  const raw = String(chunk || '')
  const end = raw.search(/["']/)
  const url = end === -1 ? raw : raw.slice(0, end)

  return usableUrl(url)
}

function textPreview(chunk) {
  const text = String(chunk || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/affigenie-outline:[A-Za-z0-9+/=\s]+/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(new RegExp('&' + 'amp;', 'gi'), '&')
    .replace(new RegExp('&' + 'apos;|&#39;', 'gi'), "'")
    .replace(new RegExp('&' + 'quot;', 'gi'), '"')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text || /^[A-Za-z0-9+/=\s]{40,}$/.test(text)) return ''

  return text.length > 320 ? `${text.slice(0, 300)}...` : text
}

function outlinePreview(outlineHead) {
  const texts = []
  const pattern = /"text"\s*:\s*"((?:\\.|[^"\\])*)"/g
  let match = pattern.exec(String(outlineHead || ''))

  while (match && texts.length < 4) {
    const text = match[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\s+/g, ' ')
      .trim()

    if (text && text.length <= 180) texts.push(text)
    match = pattern.exec(String(outlineHead || ''))
  }

  return texts.join(' · ')
}

function toListItem(row) {
  const isOutline = row.status === 'outline'
  const image = usableUrl(row.outlineHero) || imageFromSrcChunk(row.imgChunk)
  const preview = isOutline ? outlinePreview(row.outlineHead) || textPreview(row.textChunk) : textPreview(row.textChunk)

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    targetSite: row.targetSite,
    createdAt: row.createdAt,
    image,
    preview
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    const { title, content, outline, status, targetSite } = await request.json()

    let finalTitle = title || 'Untitled Draft'

    const existingArticles = await prisma.article.findMany({
      where: {
        userId: user.id,
        title: { startsWith: finalTitle }
      }
    })

    if (existingArticles.length > 0) {
      const escapeRegExp = string => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`^${escapeRegExp(finalTitle)}(?: \\((\\d+)\\))?$`)

      let maxNum = 0
      let hasExactMatch = false

      existingArticles.forEach(article => {
        const match = article.title.match(regex)

        if (match) {
          hasExactMatch = true

          if (match[1]) {
            const num = parseInt(match[1], 10)

            if (num > maxNum) maxNum = num
          } else {
            if (maxNum < 1) maxNum = 1
          }
        }
      })

      if (hasExactMatch) {
        finalTitle = `${finalTitle} (${maxNum + 1})`
      }
    }

    const newArticle = await prisma.article.create({
      data: {
        userId: user.id,
        title: finalTitle,
        content: content || '',
        outline: outline || null,
        status: status || 'draft',
        targetSite: targetSite || null
      }
    })

    return NextResponse.json({ success: true, article: newArticle })
  } catch (error) {
    console.error(error)

    return NextResponse.json({ error: 'Failed to save article' }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    const id = new URL(request.url).searchParams.get('id')

    if (id) {
      const article = await prisma.article.findFirst({
        where: { id, userId: user.id }
      })

      if (!article) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      return NextResponse.json({ article })
    }

    const rows = await prisma.$queryRaw`
      SELECT \`id\`, \`title\`, \`status\`, \`targetSite\`, \`createdAt\`,
        CASE
          WHEN LOCATE('"heroImage":"', IFNULL(\`outline\`, '')) > 0
          THEN LEFT(
            SUBSTRING_INDEX(
              SUBSTRING(\`outline\`, LOCATE('"heroImage":"', \`outline\`) + 13, 4200),
              '"',
              1
            ),
            4000
          )
          ELSE ''
        END AS outlineHero,
        CASE
          WHEN LOCATE('src="http', IFNULL(\`content\`, '')) > 0
          THEN SUBSTRING(\`content\`, LOCATE('src="http', \`content\`) + 5, 4200)
          WHEN LOCATE('src=''http', IFNULL(\`content\`, '')) > 0
          THEN SUBSTRING(\`content\`, LOCATE('src=''http', \`content\`) + 5, 4200)
          ELSE ''
        END AS imgChunk,
        CASE
          WHEN \`status\` = 'outline' AND LOCATE('"outline":[', IFNULL(\`outline\`, '')) > 0
          THEN SUBSTRING(\`outline\`, LOCATE('"outline":[', \`outline\`), 8000)
          WHEN \`status\` = 'outline' AND \`outline\` IS NOT NULL
          THEN LEFT(\`outline\`, 8000)
          ELSE ''
        END AS outlineHead,
        CASE
          WHEN LOCATE('<p', IFNULL(\`content\`, '')) > 0
          THEN SUBSTRING(\`content\`, LOCATE('<p', \`content\`), 1200)
          ELSE ''
        END AS textChunk
      FROM \`Article\`
      WHERE \`userId\` = ${user.id} AND \`status\` IN ('draft', 'outline')
      ORDER BY \`createdAt\` DESC
    `

    return NextResponse.json({ articles: rows.map(toListItem) })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    await prisma.article.deleteMany({
      where: {
        id: id,
        userId: user.id
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
