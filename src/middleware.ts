import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const want = pathname.startsWith('/api/files') ? 'any' : pathname.startsWith('/officer') || pathname.startsWith('/api/officer') ? 'officer' : 'importer';
  const token = req.cookies.get('eodc_session')?.value;
  let role: string | undefined;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET || ''));
      role = payload.role as string;
    } catch {}
  }
  if (role && (want === 'any' || role === want)) return NextResponse.next();
  if (pathname.startsWith('/api')) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  return NextResponse.redirect(new URL('/', req.url));
}

export const config = { matcher: ['/api/files', '/importer/:path*', '/officer/:path*', '/api/importer/:path*', '/api/officer/:path*'] };
