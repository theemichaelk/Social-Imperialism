import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Pass current path to server components for per-page tracking injection. */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|hero/|mobile/).*)',
  ],
};