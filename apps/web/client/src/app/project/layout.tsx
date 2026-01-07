import { env } from "@/env";
import { Routes } from "@/utils/constants";
import { createClient } from "@/utils/supabase/server";
import { checkUserSubscriptionAccess } from "@/utils/subscription";
import { redirect } from "next/navigation";

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
        // #region agent log
        fetch('http://127.0.0.1:7246/ingest/bf1eea7e-6a5f-4bef-99eb-bf72873bd188', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'run3',
                hypothesisId: 'G',
                location: 'apps/web/client/src/app/project/layout.tsx:Layout',
                message: 'No subscription; redirecting to demo',
                data: {
                    nodeEnv: env.NODE_ENV,
                    hasActiveSubscription,
                    hasLegacySubscription,
                    hasEmail: Boolean(session.user.email),
                },
                timestamp: Date.now(),
            }),
        }).catch(() => {});
        // #endregion agent log

        redirect(Routes.DEMO_ONLY);
    }

    return <>{children}</>;
}