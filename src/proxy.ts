import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy runs in Edge Runtime (not Node.js runtime)
 * Edge Runtime limitations:
 * - Cannot use Node.js modules (crypto, fs, etc.)
 * - Cannot use MongoDB directly
 * - Only lightweight operations allowed
 *
 * Actual permission validation happens in:
 * 1. API routes (/api/auth/verify-permission) - Node.js runtime
 * 2. Server components - Node.js runtime
 * 3. Client-side checks in layout.tsx
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasFileExtension = /\.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot|css|js|json|xml|txt)$/i.test(pathname);

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/static') ||
    hasFileExtension
  ) {
    return NextResponse.next();
  }

  const publicPaths = ['/signin', '/signup', '/terms-and-conditions', '/refund-policy', '/privacy-policy'];
  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  const userId = request.cookies.get('userId')?.value ||
    request.cookies.get('userId_client')?.value;

  if (!userId) {
    const signInUrl = new URL('/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
