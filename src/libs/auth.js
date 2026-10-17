import CredentialProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') global.prisma = prisma

const userCache = new Map()
const USER_CACHE_MS = 60 * 1000

async function loadDbUser(email) {
  if (!email) return null
  const key = String(email).toLowerCase()
  const hit = userCache.get(key)
  if (hit && Date.now() - hit.at < USER_CACHE_MS) return hit.user

  const dbUser = await prisma.user.findUnique({ where: { email } })
  if (dbUser) userCache.set(key, { at: Date.now(), user: dbUser })
  return dbUser
}

function applyDbUser(token, dbUser) {
  if (!dbUser) return
  token.id = dbUser.id
  token.name = dbUser.name
  token.email = dbUser.email || token.email
  token.role = dbUser.role
  token.plan = dbUser.plan
  token.image = dbUser.image
  token.wordsUsed = dbUser.wordsUsed
  token.wordsLimit = dbUser.wordsLimit
}

function applyToken(session, token) {
  if (!session?.user) return session
  session.user.name = token.name || session.user.name
  session.user.email = token.email || session.user.email
  session.user.image = token.image || session.user.image
  if (token.id) session.user.id = token.id
  if (token.role) session.user.role = token.role
  if (token.plan) session.user.plan = token.plan
  if (token.wordsUsed != null) session.user.wordsUsed = token.wordsUsed
  if (token.wordsLimit != null) session.user.wordsLimit = token.wordsLimit
  return session
}

export const authOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    CredentialProvider({
      name: 'Credentials',
      type: 'credentials',
      credentials: {},
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password')
        }

        // 1. Check if user exists in the database
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        })

        // 2. If no user, or if they signed up via Google (no password), reject
        if (!user || !user.password) {
          throw new Error('No user found or invalid login method')
        }

        // 3. Compare the provided password with the hashed password
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error('Invalid email or password')
        }

        // 4. Return the user object to NextAuth session
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          plan: user.plan,
          wordsUsed: user.wordsUsed,
          wordsLimit: user.wordsLimit,
          remember: credentials.remember === 'true' || credentials.remember === true
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60
  },

  pages: {
    signIn: '/login'
  },

  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.name = user.name
          token.id = user.id
          token.email = user.email || token.email
          token.role = user.role
          token.plan = user.plan
          token.image = user.image
          if (user.wordsUsed != null) token.wordsUsed = user.wordsUsed
          if (user.wordsLimit != null) token.wordsLimit = user.wordsLimit
          if (user.remember === true || user.remember === 'true') token.remember = true
          else if (user.remember === false || user.remember === 'false') token.remember = false
          else if (token.remember === undefined) token.remember = true
        }
        if (token.remember === false) {
          token.exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60
        }
        if (token.exp && token.exp * 1000 < Date.now()) {
          return {}
        }
        if (token.email) {
          try {
            applyDbUser(token, await loadDbUser(token.email))
          } catch (error) {
            console.warn('[auth] kept cached session; database lookup failed:', error?.message || error)
          }
        }
        return token
      } catch (error) {
        console.warn('[auth] jwt callback kept existing token:', error?.message || error)
        return token
      }
    },
    async session({ session, token }) {
      try {
        if (!token?.id && !token?.email && !token?.name) {
          return { ...session, user: null, expires: new Date(0).toISOString() }
        }
        return applyToken(session, token)
      } catch (error) {
        console.warn('[auth] session callback kept token session:', error?.message || error)
        return session
      }
    }
  }
}
