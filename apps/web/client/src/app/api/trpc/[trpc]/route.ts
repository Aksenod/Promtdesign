import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { env } from '~/env';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';
import { createClient as createSupabaseClient } from '@/utils/supabase/request-server';

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 * 
 * Uses request-based Supabase client to properly handle cookies from the request,
 * which is critical after login when cookies may not be fully synchronized yet.
 */
const createContext = async (req: NextRequest) => {
    // Use request-based Supabase client for API routes to properly handle cookies from the request
    // This is important after login when cookies may not be fully synchronized yet
    const supabase = await createSupabaseClient(req);
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

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
        user: user ?? null,
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
