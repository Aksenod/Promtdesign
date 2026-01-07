'use client';

import { LocalForageKeys } from '@/utils/constants';
import { SignInMethod } from '@onlook/models/auth';
import localforage from 'localforage';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { devLogin, emailPasswordLogin, emailPasswordSignUp } from '../login/actions';

const LAST_SIGN_IN_METHOD_KEY = 'lastSignInMethod';

interface AuthContextType {
    signingInMethod: SignInMethod | null;
    lastSignInMethod: SignInMethod | null;
    isAuthModalOpen: boolean;
    setIsAuthModalOpen: (open: boolean) => void;
    handleEmailPasswordLogin: (email: string, password: string, returnUrl: string | null) => Promise<void>;
    handleEmailPasswordSignUp: (email: string, password: string, returnUrl: string | null) => Promise<void>;
    handleDevLogin: (returnUrl: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [lastSignInMethod, setLastSignInMethod] = useState<SignInMethod | null>(null);
    const [signingInMethod, setSigningInMethod] = useState<SignInMethod | null>(null);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    useEffect(() => {
        const getLastSignInMethod = async () => {
            const lastSignInMethod = await localforage.getItem<SignInMethod | null>(LAST_SIGN_IN_METHOD_KEY);
            setLastSignInMethod(lastSignInMethod);
        };
        getLastSignInMethod();
    }, []);

    const handleEmailPasswordLogin = async (email: string, password: string, returnUrl: string | null) => {
        try {
            setSigningInMethod(SignInMethod.EMAIL_PASSWORD);
            if (returnUrl) {
                await localforage.setItem(LocalForageKeys.RETURN_URL, returnUrl);
            }
            await localforage.setItem(LAST_SIGN_IN_METHOD_KEY, SignInMethod.EMAIL_PASSWORD);
            await emailPasswordLogin(email, password);
        } catch (error) {
            // NEXT_REDIRECT is a special Next.js error used for redirects, not a real error
            if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
                // This is expected - Next.js uses throw for redirects
                return;
            }
            console.error('Error signing in with email/password:', error);
            throw error;
        } finally {
            setSigningInMethod(null);
        }
    };

    const handleEmailPasswordSignUp = async (email: string, password: string, returnUrl: string | null) => {
        try {
            setSigningInMethod(SignInMethod.EMAIL_PASSWORD);
            if (returnUrl) {
                await localforage.setItem(LocalForageKeys.RETURN_URL, returnUrl);
            }
            await localforage.setItem(LAST_SIGN_IN_METHOD_KEY, SignInMethod.EMAIL_PASSWORD);
            await emailPasswordSignUp(email, password);
        } catch (error) {
            if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
                return;
            }
            console.error('Error signing up with email/password:', error);
            throw error;
        } finally {
            setSigningInMethod(null);
        }
    };

    const handleDevLogin = async (returnUrl: string | null) => {
        try {
            setSigningInMethod(SignInMethod.DEV);
            if (returnUrl) {
                await localforage.setItem(LocalForageKeys.RETURN_URL, returnUrl);
            }
            await devLogin();
        } catch (error) {
            // NEXT_REDIRECT is a special Next.js error used for redirects, not a real error
            if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
                // This is expected - Next.js uses throw for redirects
                return;
            }
            console.error('Error signing in with password:', error);
        } finally {
            setSigningInMethod(null);
        }
    };

    return (
        <AuthContext.Provider value={{ signingInMethod, lastSignInMethod, handleEmailPasswordLogin, handleEmailPasswordSignUp, handleDevLogin, isAuthModalOpen, setIsAuthModalOpen }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuthContext must be used within a AuthProvider');
    }
    return context;
};
