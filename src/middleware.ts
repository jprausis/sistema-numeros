import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Origens do app Android do instalador (Capacitor) e do servidor de desenvolvimento dele
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost:5173'];

export async function middleware(request: NextRequest) {
    const origin = request.headers.get('origin');
    const isAppApi = !!origin && APP_ORIGINS.includes(origin) && request.nextUrl.pathname.startsWith('/api/');

    if (!isAppApi) return await updateSession(request)

    const corsHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 204, headers: corsHeaders });
    }

    // O app autentica por token (Authorization: Bearer), sem cookies de sessão
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
