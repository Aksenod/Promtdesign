'use server';

import { env } from '@/env';
import { Routes } from '@/utils/constants';
import { createClient } from '@/utils/supabase/server';
import { SEED_USER } from '@onlook/db';
import { SignInMethod } from '@onlook/models';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function emailPasswordLogin(email: string, password: string) {
    const supabase = await createClient();

    // If already session, redirect
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (session) {
        redirect(Routes.AUTH_REDIRECT);
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
        });
        throw error;
    }

    if (!data?.user) {
        console.error('Email/password sign-in failed: no user data returned');
        throw new Error('No user data returned');
    }

    redirect(Routes.AUTH_REDIRECT);
}

export async function emailPasswordSignUp(email: string, password: string) {
    const supabase = await createClient();

    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (session) {
        redirect(Routes.AUTH_REDIRECT);
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
        });
        throw error;
    }

    if (!data?.user) {
        console.error('Email/password sign-up failed: no user data returned');
        throw new Error('No user data returned');
    }

    redirect(Routes.AUTH_REDIRECT);
}

export async function devLogin() {
    if (env.NODE_ENV !== 'development') {
        throw new Error('Dev login is only available in development mode');
    }

    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        redirect(Routes.AUTH_REDIRECT);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: SEED_USER.EMAIL,
        password: SEED_USER.PASSWORD,
    });

    if (error) {
        console.error('Error signing in with password:', error);
        throw new Error(error.message);
    }
    redirect(Routes.AUTH_REDIRECT);
}
