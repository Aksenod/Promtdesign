import { trackEvent } from '@/utils/analytics/server';
import { callUserWebhook } from '@/utils/n8n/webhook';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { db } from '@onlook/db/src/client';
import { users } from '@onlook/db';
import { extractNames } from '@onlook/utility';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        console.error('Auth callback: No code provided in request');
        return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=no_code`);
    }

    try {
        const supabase = await createClient();
        const { error, data } = await supabase.auth.exchangeCodeForSession(code);
        
        if (error) {
            console.error('Auth callback: Error exchanging code for session:', {
                error: error.message,
                status: error.status,
                details: error,
            });
            return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=exchange_failed&error=${encodeURIComponent(error.message)}`);
        }

        if (!data?.user) {
            console.error('Auth callback: No user data after code exchange');
            return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=no_user_data`);
        }

        try {
            // Extract user name data (same logic as in user.upsert)
            const authUser = data.user;
            const displayName: string | undefined = authUser.user_metadata.name ?? authUser.user_metadata.display_name ?? authUser.user_metadata.full_name ?? authUser.user_metadata.first_name ?? authUser.user_metadata.last_name ?? authUser.user_metadata.given_name ?? authUser.user_metadata.family_name;
            const { firstName, lastName } = extractNames(displayName ?? '');

            // Check if user already exists
            const existingUser = await db.query.users.findFirst({
                where: eq(users.id, authUser.id),
            });

            const userData = {
                id: authUser.id,
                firstName: firstName,
                lastName: lastName,
                displayName: displayName ?? '',
                email: authUser.email ?? undefined,
                avatarUrl: authUser.user_metadata.avatar_url ?? authUser.user_metadata.avatarUrl ?? undefined,
            };

            // Upsert user directly in database
            const [user] = await db
                .insert(users)
                .values(userData)
                .onConflictDoUpdate({
                    target: [users.id],
                    set: {
                        ...userData,
                        updatedAt: new Date(),
                    },
                })
                .returning();

            if (!user) {
                console.error(`Auth callback: Failed to create user for id: ${authUser.id}`, { user });
                return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=user_creation_failed`);
            }

            // Track first signup event if this is a new user (non-blocking)
            if (!existingUser) {
                try {
                    await trackEvent({
                        distinctId: authUser.id,
                        event: 'user_first_signup',
                        properties: {
                            email: userData.email,
                            firstName: userData.firstName,
                            lastName: userData.lastName,
                            displayName: userData.displayName,
                            source: 'web beta',
                        },
                    });

                    await callUserWebhook({
                        email: userData.email ?? '',
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        source: 'web beta',
                        subscribed: false,
                    });
                } catch (trackError) {
                    console.warn('Auth callback: Failed to track first signup event (non-critical):', trackError);
                }
            }

            // Track sign-in event (non-blocking, don't fail if this errors)
            try {
                await trackEvent({
                    distinctId: authUser.id,
                    event: 'user_signed_in',
                    properties: {
                        name: authUser.user_metadata.name,
                        email: authUser.email,
                        avatar_url: authUser.user_metadata.avatar_url,
                        $set_once: {
                            signup_date: new Date().toISOString(),
                        }
                    }
                });
            } catch (trackError) {
                console.warn('Auth callback: Failed to track event (non-critical):', trackError);
            }

            // Always use the request origin to prevent open redirect via X-Forwarded-Host header manipulation
            return NextResponse.redirect(`${origin}${Routes.AUTH_REDIRECT}`);
        } catch (upsertError) {
            console.error('Auth callback: Error in user upsert:', {
                userId: data.user.id,
                error: upsertError instanceof Error ? upsertError.message : String(upsertError),
                stack: upsertError instanceof Error ? upsertError.stack : undefined,
            });
            return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=upsert_error&error=${encodeURIComponent(upsertError instanceof Error ? upsertError.message : String(upsertError))}`);
        }
    } catch (error) {
        console.error('Auth callback: Unexpected error:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=unexpected_error&error=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
    }
}
