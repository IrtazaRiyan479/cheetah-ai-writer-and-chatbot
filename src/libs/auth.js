// Third-party Imports
import CredentialProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs' // Added bcrypt for password comparison

const prisma = new PrismaClient()

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
          image: user.image
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },

  pages: {
    signIn: '/login'
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name
      }
      return session
    }
  }
}
