import { trackEvent } from '@/utils/analytics/server';
import { callUserWebhook } from '@/utils/n8n/webhook';
import { Routes } from '@/utils/constants';
import { env } from '@/env';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { db } from '@onlook/db/src/client';
import { users } from '@onlook/db';
import { extractNames } from '@onlook/utility';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    // Get correct origin from headers or use env variable
    const headersList = await headers();
    const origin = headersList.get('origin') 
        ?? headersList.get('x-forwarded-host') 
            ? `https://${headersList.get('x-forwarded-host')}`
            : env.NEXT_PUBLIC_SITE_URL;

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

            // Check if user already exists using admin client to bypass RLS
            const adminSupabase = createAdminClient();
            const { data: existingUserData } = await adminSupabase
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .single();
            
            const existingUser = existingUserData ?? null;

            const userData = {
                id: authUser.id,
                firstName: firstName,
                lastName: lastName,
                displayName: displayName ?? '',
                email: authUser.email ?? undefined,
                avatarUrl: authUser.user_metadata.avatar_url ?? authUser.user_metadata.avatarUrl ?? undefined,
            };

            // Upsert user using admin client to bypass RLS
            // This is safe because we've already verified the user through OAuth
            const { data: upsertedUser, error: upsertError } = await adminSupabase
                .from('users')
                .upsert(userData, {
                    onConflict: 'id',
                })
                .select()
                .single();

            if (upsertError || !upsertedUser) {
                console.error('Auth callback: Failed to upsert user:', {
                    error: upsertError,
                    userId: authUser.id,
                });
                throw new Error(upsertError?.message ?? 'Failed to upsert user');
            }

            const user = upsertedUser;

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
