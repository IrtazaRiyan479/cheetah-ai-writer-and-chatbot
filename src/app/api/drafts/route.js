import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from '@/libs/auth'

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    const { title, content, outline, status, targetSite } = await request.json();

    let finalTitle = title || "Untitled Draft";

    const existingArticles = await prisma.article.findMany({
      where: {
        userId: user.id,
        title: { startsWith: finalTitle }
      }
    });

    if (existingArticles.length > 0) {
      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`^${escapeRegExp(finalTitle)}(?: \\((\\d+)\\))?$`);

      let maxNum = 0;
      let hasExactMatch = false;

      existingArticles.forEach(article => {
        const match = article.title.match(regex);
        if (match) {
          hasExactMatch = true;
          if (match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          } else {
            if (maxNum < 1) maxNum = 1;
          }
        }
      });

      if (hasExactMatch) {
        finalTitle = `${finalTitle} (${maxNum + 1})`;
      }
    }

    const newArticle = await prisma.article.create({
      data: {
        userId: user.id,
        title: finalTitle,
        content: content || "",
        outline: outline || null,
        status: status || "draft",
        targetSite: targetSite || null,
      }
    });

    return NextResponse.json({ success: true, article: newArticle });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save article" }, { status: 500 });
  }
}

// Fetch user's drafts
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });

    const articles = await prisma.article.findMany({
      where: { userId: user.id, status: 'draft' },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch articles" }, { status: 500 });
  }
}

// Delete a draft
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
       return NextResponse.json({ error: "Article ID is required" }, { status: 400 });
    }

    await prisma.article.deleteMany({
      where: {
        id: id,
        userId: user.id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete article" }, { status: 500 });
  }
}
