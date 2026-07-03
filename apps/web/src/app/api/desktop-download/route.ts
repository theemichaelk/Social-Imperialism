import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Legacy route — desktop downloads are auth-gated on the Express API. */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'Sign in and use /api/desktop/download-url for a secure installer link',
      requiresAuth: true,
    },
    { status: 401 },
  );
}