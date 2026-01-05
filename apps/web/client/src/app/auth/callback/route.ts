import { trackEvent } from '@/utils/analytics/server';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { api } from '~/trpc/server';

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
            const user = await api.user.upsert({
                id: data.user.id,
            });

            if (!user) {
                console.error(`Auth callback: Failed to create user for id: ${data.user.id}`, { user });
                return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=user_creation_failed`);
            }

            // Track event (non-blocking, don't fail if this errors)
            try {
                await trackEvent({
                    distinctId: data.user.id,
                    event: 'user_signed_in',
                    properties: {
                        name: data.user.user_metadata.name,
                        email: data.user.email,
                        avatar_url: data.user.user_metadata.avatar_url,
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
            console.error('Auth callback: Error in user.upsert:', {
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
