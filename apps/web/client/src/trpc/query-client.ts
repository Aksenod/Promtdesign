import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import SuperJSON from 'superjson';

/**
 * Extracts HTTP status code from various error formats.
 * tRPC and React Query errors can have different structures.
 */
const getHttpStatus = (error: unknown): number | null => {
    if (!error || typeof error !== 'object') {
        return null;
    }

    // Check for tRPC error structure: error.data.httpStatus
    if ('data' in error) {
        const data = error.data as { httpStatus?: number; status?: number };
        if (typeof data?.httpStatus === 'number') {
            return data.httpStatus;
        }
        if (typeof data?.status === 'number') {
            return data.status;
        }
    }

    // Check for Fetch/Response error structure: error.status
    if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
        return (error as { status: number }).status;
    }

    // Check for error message containing status codes
    if ('message' in error && typeof error.message === 'string') {
        const message = error.message;
        const statusMatch = message.match(/\b(502|503|504)\b/);
        if (statusMatch) {
            return Number.parseInt(statusMatch[1] ?? '', 10);
        }
    }

    return null;
};

/**
 * Determines if an error should trigger a retry.
 * 502/503 errors indicate server issues and shouldn't be retried aggressively.
 */
const shouldRetry = (failureCount: number, error: unknown): boolean => {
    // Don't retry if we've already tried 2 times
    if (failureCount >= 2) {
        return false;
    }

    const status = getHttpStatus(error);

    // Don't retry on 502 (Bad Gateway), 503 (Service Unavailable), or 504 (Gateway Timeout)
    // These indicate server-side issues that won't be resolved by retrying
    if (status === 502 || status === 503 || status === 504) {
        return false;
    }

    // For other errors, allow one retry
    return failureCount < 1;
};

export const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                // With SSR, we usually want to set some default staleTime
                // above 0 to avoid refetching immediately on the client
                staleTime: 30 * 1000,
                // Limit retries to prevent infinite loops on server errors
                retry: shouldRetry,
                // Don't refetch on window focus if there was an error
                refetchOnWindowFocus: (query) => {
                    // Don't refetch if the query has an error (especially 502/503/504)
                    if (query.state.error) {
                        const status = getHttpStatus(query.state.error);
                        if (status === 502 || status === 503 || status === 504) {
                            return false;
                        }
                    }
                    return true;
                },
            },
            dehydrate: {
                serializeData: SuperJSON.serialize,
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
            },
            hydrate: {
                deserializeData: SuperJSON.deserialize,
            },
        },
    });
