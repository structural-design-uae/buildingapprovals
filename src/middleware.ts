import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');

  // Redirect only the real apex domain to www. Do not rewrite Hostinger
  // preview domains or internal health-check hosts.
  if (host === 'buildingapprovals.ae') {
    const url = request.nextUrl.clone();
    url.host = 'www.buildingapprovals.ae';
    return NextResponse.redirect(url, 301); // 301 = Permanent redirect
  }

  return NextResponse.next();
}

// Apply middleware to all routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
