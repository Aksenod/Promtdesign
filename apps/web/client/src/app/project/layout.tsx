import { env } from '@/env';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { checkUserSubscriptionAccess } from '@/utils/subscription';
import { redirect } from 'next/navigation';
import { logAgentEvent } from '@/utils/agent-log';

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
        redirect(Routes.LOGIN);
    }

    // In local/dev environments allow opening projects without requiring a subscription.
    // Subscription gating is enforced in production.
    if (env.NODE_ENV !== 'production') {
        return <>{children}</>;
    }

    // Check if user has an active subscription
    const { hasActiveSubscription, hasLegacySubscription } = await checkUserSubscriptionAccess(
        session.user.id,
        session.user.email,
    );

    // If no subscription, redirect to demo page
    if (!hasActiveSubscription && !hasLegacySubscription) {
        logAgentEvent({
            location: 'apps/web/client/src/app/project/layout.tsx:Layout',
            message: 'No subscription; redirecting to demo',
            sessionId: 'debug-session',
            runId: 'run3',
            hypothesisId: 'G',
            data: {
                nodeEnv: env.NODE_ENV,
                hasActiveSubscription,
                hasLegacySubscription,
                hasEmail: Boolean(session.user.email),
            },
        });

        redirect(Routes.DEMO_ONLY);
    }

    return <>{children}</>;
}