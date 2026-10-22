import { NextResponse } from 'next/server'
import { sql } from '@/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await sql`select 1`
  } catch {
    return NextResponse.json({ status: 'error', database: 'unreachable' }, { status: 503 })
  }

  return NextResponse.json({
    status: 'ok',
    database: 'ok',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
  })
}
