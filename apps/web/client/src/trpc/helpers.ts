import { httpBatchStreamLink, loggerLink } from '@trpc/client';
import SuperJSON from 'superjson';

export function getBaseUrl() {
    // In the browser, use the current origin
    if (typeof window !== 'undefined') return window.location.origin;
    
    // In server-side rendering, determine the base URL from environment variables
    // Priority: NEXT_PUBLIC_SITE_URL > Render.com > Vercel > localhost
    
    // Use NEXT_PUBLIC_SITE_URL if available (works for all platforms including Render.com)
    // This is set in env.ts and should be available at runtime
    if (process.env.NEXT_PUBLIC_SITE_URL) {
        return process.env.NEXT_PUBLIC_SITE_URL;
    }
    
    // Render.com provides RENDER_EXTERNAL_URL (external service URL)
    if (process.env.RENDER_EXTERNAL_URL) {
        return process.env.RENDER_EXTERNAL_URL;
    }
    
    // Vercel provides VERCEL_URL
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    
    // Fallback to localhost for development
    return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const links = [
    loggerLink({
        enabled: (op) => {
            // Always log in development
            if (process.env.NODE_ENV === 'development') {
                return true;
            }

            // In production, only log errors that aren't server errors (502/503/504)
            if (op.direction === 'down' && op.result instanceof Error) {
                const errorMessage = op.result.message || String(op.result);
                const isServerError = errorMessage.includes('502') || 
                                     errorMessage.includes('503') || 
                                     errorMessage.includes('504');
                return !isServerError;
            }

            return false;
        },
    }),
    httpBatchStreamLink({
        transformer: SuperJSON,
        url: getBaseUrl() + '/api/trpc',
        headers: () => {
            const headers = new Headers();
            headers.set('x-trpc-source', 'vanilla-client');
            return headers;
        },
    }),
];
