import { httpBatchStreamLink, loggerLink } from '@trpc/client';
import SuperJSON from 'superjson';

export function getBaseUrl() {
    if (typeof window !== 'undefined') return window.location.origin;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
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
