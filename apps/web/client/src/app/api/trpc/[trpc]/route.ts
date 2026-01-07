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
 * Uses createClient(request) which reads cookies from request.cookies directly.
 * This is the correct way to read cookies in API routes, as cookies() from next/headers
 * does not work in API routes (it only works in Server Components and Server Actions).
 */
const createContext = async (req: NextRequest) => {
    try {
        // Use createClient(request) which reads cookies from request.cookies
        // This is the only way to read cookies in API routes
        const supabase = await createSupabaseClient(req);
        
        // Use getUser() to check authentication via token
        // This is more reliable in API routes than getSession()
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
            // Don't throw here - let the procedure handle auth errors
            // This allows protectedProcedure to return 401 instead of 502
        }

        return createTRPCContext({
            headers: req.headers,
            supabase,
            user: user ?? null,
        });
    } catch (error: unknown) {
        // Handle database connection errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        // Check if it's a database connection error
        // More specific checks to avoid false positives
        const isDbError = 
            errorMessage.includes('SUPABASE_DATABASE_URL') ||
            errorMessage.includes('Database connection') ||
            errorMessage.includes('ECONNREFUSED') ||
            errorMessage.includes('connection refused') ||
            errorMessage.includes('ETIMEDOUT') ||
            errorMessage.includes('connect timeout') ||
            (errorMessage.includes('timeout') && errorMessage.toLowerCase().includes('database'));
        
        if (isDbError) {
            console.error('❌ Database connection error in tRPC context:', {
                message: errorMessage,
                path: req.nextUrl.pathname,
                stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
            });
            // Throw a TRPCError that will be caught by the handler and converted to 503
            throw new Error('DATABASE_CONNECTION_ERROR');
        }
        
        // Handle Supabase client errors
        const isSupabaseError = errorMessage.includes('supabase') ||
                               errorMessage.includes('auth');
        
        if (isSupabaseError) {
            console.error('❌ Supabase client error in tRPC context:', {
                message: errorMessage,
                path: req.nextUrl.pathname,
            });
            // Re-throw to be handled as auth error (401)
            throw error;
        }
        
        // Log unexpected errors
        console.error('❌ Unexpected error in tRPC context:', {
            message: errorMessage,
            path: req.nextUrl.pathname,
            stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        });
        
        throw error;
    }
};

const handler = async (req: NextRequest) => {
    try {
        return await fetchRequestHandler({
            endpoint: '/api/trpc',
            req,
            router: appRouter,
            createContext: () => createContext(req),
            onError: ({ path, error }) => {
                // Check if it's a database connection error
                const isDbError = error.message.includes('DATABASE_CONNECTION_ERROR') ||
                                 error.message.includes('SUPABASE_DATABASE_URL') ||
                                 error.cause?.toString().includes('database') ||
                                 error.cause?.toString().includes('ECONNREFUSED');
                
                if (isDbError) {
                    console.error(`❌ Database connection error on ${path ?? '<no-path>'}:`, {
                        message: error.message,
                        code: error.code,
                    });
                    // Don't log stack in production for DB errors
                    return;
                }

                // Check if it's a server error (502/503/504)
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

                // Log other errors (auth errors, validation errors, etc.)
                // Auth errors should return 401, not be logged as errors
                if (error.code === 'UNAUTHORIZED') {
                    // Don't log auth errors as errors - they're expected
                    return;
                }

                console.error(`❌ tRPC failed on ${path ?? '<no-path>'}: ${error.message}`, {
                    code: error.code,
                    cause: error.cause,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                });
            },
            responseMeta({ type, errors }) {
                // Handle database connection errors - return 503 instead of 502
                const hasDbError = errors.some(
                    (err) => err.message.includes('DATABASE_CONNECTION_ERROR') ||
                            err.message.includes('SUPABASE_DATABASE_URL')
                );
                
                if (hasDbError) {
                    return {
                        status: 503, // Service Unavailable
                    };
                }
                
                // Auth errors should return 401
                const hasAuthError = errors.some(
                    (err) => err.code === 'UNAUTHORIZED'
                );
                
                if (hasAuthError) {
                    return {
                        status: 401, // Unauthorized
                    };
                }
                
                return {};
            },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        // Check if it's a database connection error
        const isDbError = errorMessage.includes('DATABASE_CONNECTION_ERROR') ||
                         errorMessage.includes('SUPABASE_DATABASE_URL');
        
        console.error('❌ tRPC handler error:', {
            message: errorMessage,
            isDbError,
            stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
        });
        
        return new Response(
            JSON.stringify({
                error: isDbError ? 'Database service unavailable' : 'Internal server error',
                message: errorMessage,
            }),
            {
                status: isDbError ? 503 : 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

export { handler as GET, handler as POST };
