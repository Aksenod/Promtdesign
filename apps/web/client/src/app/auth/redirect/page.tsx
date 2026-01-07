'use client';

import { LocalForageKeys, Routes } from '@/utils/constants';
import { sanitizeReturnUrl } from '@/utils/url';
import localforage from 'localforage';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api } from '@/trpc/react';

export default function AuthRedirect() {
    const router = useRouter();
    const { data: subscription, isLoading: subscriptionLoading, error: subscriptionError } = api.subscription.get.useQuery();
    const { data: legacySubscription, isLoading: legacyLoading, error: legacyError } = api.subscription.getLegacySubscriptions.useQuery();

    useEffect(() => {
        const handleRedirect = async () => {
            // Small delay to ensure cookies are set after redirect
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Wait for both subscription queries to complete
            if (subscriptionLoading || legacyLoading) {
                return;
            }

            // If there are errors (like 502), don't redirect to demo-only
            // Instead, redirect to home or return URL
            if (subscriptionError || legacyError) {
                // Check if errors are 502/503/504 (server issues)
                const getErrorStatus = (error: unknown): number | null => {
                    if (error && typeof error === 'object') {
                        if ('data' in error) {
                            const data = error.data as { httpStatus?: number };
                            return data?.httpStatus ?? null;
                        }
                        if ('message' in error && typeof error.message === 'string') {
                            const match = error.message.match(/\b(502|503|504)\b/);
                            return match ? Number.parseInt(match[1] ?? '', 10) : null;
                        }
                    }
                    return null;
                };

                const subscriptionStatus = subscriptionError ? getErrorStatus(subscriptionError) : null;
                const legacyStatus = legacyError ? getErrorStatus(legacyError) : null;
                const isServerError = subscriptionStatus ? [502, 503, 504].includes(subscriptionStatus) : 
                                      legacyStatus ? [502, 503, 504].includes(legacyStatus) : false;

                // Only log non-server errors or in development
                if (!isServerError || process.env.NODE_ENV === 'development') {
                    console.warn('Auth redirect: Subscription queries failed, redirecting to home', {
                        subscriptionError: isServerError ? { status: subscriptionStatus } : subscriptionError,
                        legacyError: isServerError ? { status: legacyStatus } : legacyError,
                    });
                }

                const returnUrl = await localforage.getItem<string>(LocalForageKeys.RETURN_URL);
                await localforage.removeItem(LocalForageKeys.RETURN_URL);
                const sanitizedUrl = sanitizeReturnUrl(returnUrl);
                router.replace(sanitizedUrl);
                return;
            }

            const storedReturnUrl = await localforage.getItem<string>(LocalForageKeys.RETURN_URL);
            await localforage.removeItem(LocalForageKeys.RETURN_URL);

            // Decide target URL when there is no subscription
            if (!subscription && !legacySubscription) {
                const target = storedReturnUrl ?? Routes.PROJECTS;
                const sanitizedTarget = sanitizeReturnUrl(target);
                router.replace(sanitizedTarget);
                return;
            }

            // Otherwise, redirect to their intended destination
            const sanitizedUrl = sanitizeReturnUrl(storedReturnUrl);
            router.replace(sanitizedUrl);
        };
        handleRedirect();
    }, [router, subscription, subscriptionLoading, subscriptionError, legacySubscription, legacyLoading, legacyError]);

    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <div className="text-center">
                <h1 className="text-2xl font-semibold mb-4">Redirecting...</h1>
                <p className="text-foreground-secondary">Please wait while we redirect you back.</p>
            </div>
        </div>
    );
} 