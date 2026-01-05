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
                console.warn('Auth redirect: Subscription queries failed, redirecting to home', {
                    subscriptionError,
                    legacyError,
                });
                const returnUrl = await localforage.getItem<string>(LocalForageKeys.RETURN_URL);
                await localforage.removeItem(LocalForageKeys.RETURN_URL);
                const sanitizedUrl = sanitizeReturnUrl(returnUrl);
                router.replace(sanitizedUrl);
                return;
            }

            const returnUrl = await localforage.getItem<string>(LocalForageKeys.RETURN_URL);
            await localforage.removeItem(LocalForageKeys.RETURN_URL);

            // If user has no active subscription or legacy subscription, redirect to demo-only page
            if (!subscription && !legacySubscription) {
                router.replace(Routes.DEMO_ONLY);
                return;
            }

            // Otherwise, redirect to their intended destination
            const sanitizedUrl = sanitizeReturnUrl(returnUrl);
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