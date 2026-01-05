import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { env } from '~/env';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

/**
 * This wraps the `createTRPCContext` helper and provides the required context for the tRPC API when
 * handling a HTTP request (e.g. when you make requests from Client Components).
 */
const createContext = async (req: NextRequest) => {
    return createTRPCContext({
        headers: req.headers,
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
