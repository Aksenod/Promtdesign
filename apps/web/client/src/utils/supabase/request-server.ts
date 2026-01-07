import { env } from '@/env';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest } from 'next/server';

type SupabaseCookie = {
    name: string;
    value: string;
};

const parseCookieHeader = (cookieHeader: string | null): SupabaseCookie[] => {
    if (!cookieHeader) {
        return [];
    }

    return cookieHeader
        .split(';')
        .map((cookie) => cookie.trim())
        .filter(Boolean)
        .map((cookie) => {
            const separatorIndex = cookie.indexOf('=');
            if (separatorIndex === -1) {
                return {
                    name: cookie,
                    value: '',
                };
            }

            const name = cookie.slice(0, separatorIndex).trim();
            const value = cookie.slice(separatorIndex + 1);

            return {
                name,
                value,
            };
        });
};

const getRequestCookies = (request: NextRequest): SupabaseCookie[] => {
    const requestCookies = request.cookies?.getAll?.();
    if (requestCookies && requestCookies.length > 0) {
        return requestCookies;
    }

    return parseCookieHeader(request.headers.get('cookie'));
};

export async function createClient(request: NextRequest) {
    // Persist cookies read from the header to allow Supabase to access them even
    // when NextRequest.cookies is empty (can happen in standalone builds).
    const headerCookieStore = new Map<string, string>(
        getRequestCookies(request).map(({ name, value }) => [name, value]),
    );

    const snapshotCookies = (): SupabaseCookie[] => {
        // Try to read cookies from NextRequest first.
        const liveCookies = getRequestCookies(request);
        if (liveCookies.length > 0) {
            return liveCookies;
        }

        // Fall back to the header snapshot (includes any cookies we have set
        // earlier in this request lifecycle).
        return Array.from(headerCookieStore.entries()).map(([name, value]) => ({
            name,
            value,
        }));
    };

    const cacheCookie = (name: string, value: string) => {
        headerCookieStore.set(name, value);
    };

    return createServerClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return snapshotCookies();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        try {
                            // NextRequest cookies are read-only in some runtimes,
                            // so guard against setters not being available.
                            request.cookies?.set?.(name, value);
                        } catch {
                            // Ignore setter failures – we still cache the cookie
                            // locally so that subsequent reads within this
                            // request see the updated value.
                        }

                        cacheCookie(name, value);
                    });
                },
            },
        },
    );
}
