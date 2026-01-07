'use server';

import { env } from '@/env';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { SEED_USER } from '@onlook/db';
import { SignInMethod } from '@onlook/models';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Helper to safely handle redirects in server actions.
 * Next.js redirect() throws a special NEXT_REDIRECT error that should not be caught.
 * In Next.js, redirect() always throws an error with digest property to signal redirect.
 */
function safeRedirect(url: string): never {
    try {
        redirect(url);
    } catch (error: unknown) {
        // Next.js redirect() throws a special error that should propagate
        // Check for NEXT_REDIRECT in message OR digest property (more reliable)
        const isRedirectError = 
            (error instanceof Error && error.message === 'NEXT_REDIRECT') ||
            (error && typeof error === 'object' && 'digest' in error && 
             typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT'));
        
        if (isRedirectError) {
            throw error; // Propagate redirect error
        }
        // If it's a different error, log it and rethrow
        console.error('Unexpected error during redirect:', error);
        throw error;
    }
}

export async function emailPasswordLogin(email: string, password: string) {
    try {
        const supabase = await createClient();

        // If already session, redirect
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            safeRedirect(Routes.AUTH_REDIRECT);
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('Email/password sign-in error:', {
                error: error.message,
                code: error.status,
                details: error,
                email: email, // Log email for debugging (without password)
            });
            throw error;
        }

        if (!data?.user) {
            const errorMessage = 'No user data returned from sign-in';
            console.error('Email/password sign-in failed:', {
                message: errorMessage,
                email: email,
            });
            throw new Error(errorMessage);
        }

        safeRedirect(Routes.AUTH_REDIRECT);
    } catch (error: unknown) {
        // Re-throw NEXT_REDIRECT errors (these are expected and should propagate)
        const isRedirectError = 
            (error instanceof Error && error.message === 'NEXT_REDIRECT') ||
            (error && typeof error === 'object' && 'digest' in error && 
             typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT'));
        
        if (isRedirectError) {
            throw error;
        }
        // Log and rethrow all other errors so they reach the client
        console.error('Error in emailPasswordLogin:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

export async function emailPasswordSignUp(email: string, password: string) {
    try {
        const supabase = await createClient();

        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session) {
            safeRedirect(Routes.AUTH_REDIRECT);
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error('Email/password sign-up error:', {
                error: error.message,
                code: error.status,
                details: error,
                email: email, // Log email for debugging (without password)
            });
            throw error;
        }

        if (!data?.user) {
            const errorMessage = 'No user data returned from sign-up';
            console.error('Email/password sign-up failed:', {
                message: errorMessage,
                email: email,
            });
            throw new Error(errorMessage);
        }

        safeRedirect(Routes.AUTH_REDIRECT);
    } catch (error: unknown) {
        // Re-throw NEXT_REDIRECT errors (these are expected and should propagate)
        const isRedirectError = 
            (error instanceof Error && error.message === 'NEXT_REDIRECT') ||
            (error && typeof error === 'object' && 'digest' in error && 
             typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT'));
        
        if (isRedirectError) {
            throw error;
        }
        // Log and rethrow all other errors so they reach the client
        console.error('Error in emailPasswordSignUp:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

export async function devLogin() {
    if (env.NODE_ENV !== 'development') {
        throw new Error('Dev login is only available in development mode');
    }

    try {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            safeRedirect(Routes.AUTH_REDIRECT);
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: SEED_USER.EMAIL,
            password: SEED_USER.PASSWORD,
        });

        if (error) {
            console.error('Error signing in with password:', {
                error: error.message,
                code: error.status,
                email: SEED_USER.EMAIL,
            });
            throw new Error(error.message);
        }

        safeRedirect(Routes.AUTH_REDIRECT);
    } catch (error: unknown) {
        // Re-throw NEXT_REDIRECT errors (these are expected and should propagate)
        const isRedirectError = 
            (error instanceof Error && error.message === 'NEXT_REDIRECT') ||
            (error && typeof error === 'object' && 'digest' in error && 
             typeof error.digest === 'string' && error.digest.includes('NEXT_REDIRECT'));
        
        if (isRedirectError) {
            throw error;
        }
        // Log and rethrow all other errors
        console.error('Error in devLogin:', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}
