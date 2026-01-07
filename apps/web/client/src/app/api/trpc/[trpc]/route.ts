import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { env } from '~/env';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';
import { createClient } from '@/utils/supabase/server';

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 * 
 * Uses cookies() from next/headers to properly read cookies that were set by server actions.
 * This is critical after login when cookies are set by the login server action.
 * Uses getSession() instead of getUser() to check session via cookies, which is more reliable after login.
 */
const createContext = async (req: NextRequest) => {
    // Use cookies() from next/headers instead of request.cookies
    // This ensures we can read cookies that were set by server actions (like login)
    // cookies() works in API routes and reads from the actual request cookies
    const supabase = await createClient();
    
    // Use getSession() instead of getUser() to check session via cookies
    // This is more reliable after login when cookies are just set
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    // Log auth errors for debugging (including in production)
    if (error) {
        console.error('Auth error in API route context:', {
            message: error.message,
            status: error.status,
            path: req.nextUrl.pathname,
        });
    }

    return createTRPCContext({
        headers: req.headers,
        supabase,
        user: session?.user ?? null,
    });
};

const handler = async (req: NextRequest) => {
    try {
        return await fetchRequestHandler({
            endpoint: '/api/trpc',
            req,
            router: appRouter,
            createContext: () => createContext(req),
            onError: ({ path, error }) => {
                // Don't log 502/503/504 errors as they're server issues, not application errors
                const isServerError = error.code === 'INTERNAL_SERVER_ERROR' && 
                                     (error.message.includes('502') || 
                                      error.message.includes('503') || 
                                      error.message.includes('504') ||
                                      error.cause?.toString().includes('502') ||
                                      error.cause?.toString().includes('503') ||
                                      error.cause?.toString().includes('504'));

                if (isServerError && process.env.NODE_ENV === 'production') {
                    // Silently skip logging server errors in production
                    return;
                }

                if (isServerError) {
                    // In development, log server errors with less verbosity
                    console.warn(`⚠️ tRPC server error on ${path ?? '<no-path>'}: ${error.message}`);
                    return;
                }

                console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`, {
                    code: error.code,
                    cause: error.cause,
                    stack: error.stack,
                });
            },
        });
    } catch (error) {
        console.error('❌ tRPC handler error:', error);
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export { handler as GET, handler as POST };
