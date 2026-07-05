// Next Imports
import { NextResponse } from 'next/server'

// Mock data for demo purpose
import { users } from './users'

export async function POST(req) {
  // Vars
  const { email, password } = await req.json()
  const user = users.find(u => u.email === email && u.password === password)
  let response = null

  if (user) {
    const { password: _, ...filteredUserData } = user

    response = {
      ...filteredUserData
    }

    return NextResponse.json(response)
  } else {
    return NextResponse.json(
      {
        message: ['Email or Password is invalid']
      },
      {
        status: 401,
        statusText: 'Unauthorized Access'
      }
    )
  }
}
