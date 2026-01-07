'use client';

import { transKeys } from '@/i18n/keys';
import { LocalForageKeys, Routes } from '@/utils/constants';
import { Icons } from '@onlook/ui/icons';
import { Button } from '@onlook/ui/button';
import { Input } from '@onlook/ui/input';
import { Label } from '@onlook/ui/label';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useAuthContext } from '../auth/auth-context';

const LOGIN_BACKGROUND = '/assets/dunes-login-dark.png';

export default function LoginPage() {
    const isDev = process.env.NODE_ENV === 'development';
    const t = useTranslations();
    const returnUrl = useSearchParams().get(LocalForageKeys.RETURN_URL);
    const { handleEmailPasswordLogin, handleEmailPasswordSignUp, signingInMethod } = useAuthContext();

    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Please enter both email and password');
            return;
        }

        try {
            if (mode === 'login') {
                await handleEmailPasswordLogin(email, password, returnUrl);
            } else {
                await handleEmailPasswordSignUp(email, password, returnUrl);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${mode === 'login' ? 'sign in' : 'sign up'}`);
        }
    };

    return (
        <div className="flex h-screen w-screen justify-center">
            <div className="flex flex-col justify-between w-full h-full max-w-xl p-16 space-y-8 overflow-auto">
                <div className="flex items-center space-x-2">
                    <Link href={Routes.HOME} className="hover:opacity-80 transition-opacity">
                        <Icons.OnlookTextLogo viewBox="0 0 139 17" />
                    </Link>
                </div>
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-title1 leading-tight">
                            {mode === 'login' ? t(transKeys.welcome.title) : 'Create account'}
                        </h1>
                        <p className="text-foreground-onlook text-regular">
                            {mode === 'login' ? t(transKeys.welcome.description) : 'Sign up to get started'}
                        </p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={!!signingInMethod}
                                className="bg-background-onlook"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={!!signingInMethod}
                                className="bg-background-onlook"
                            />
                        </div>
                        {error && (
                            <p className="text-red-500 text-small">{error}</p>
                        )}
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={!!signingInMethod}
                        >
                            {signingInMethod ? (
                                <>
                                    <Icons.LoadingSpinner className="w-4 h-4 mr-2 animate-spin" />
                                    {mode === 'login' ? 'Signing in...' : 'Signing up...'}
                                </>
                            ) : (
                                mode === 'login' ? 'Sign in' : 'Sign up'
                            )}
                        </Button>
                    </form>
                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === 'login' ? 'signup' : 'login');
                                setError('');
                            }}
                            className="text-small text-foreground-onlook hover:text-gray-300 underline"
                            disabled={!!signingInMethod}
                        >
                            {mode === 'login' 
                                ? "Don't have an account? Sign up"
                                : 'Already have an account? Sign in'
                            }
                        </button>
                    </div>
                    {isDev && (
                        <div className="pt-4 border-t border-gray-700">
                            <p className="text-small text-gray-500 mb-2">Development Mode</p>
                            <Button
                                variant="outline"
                                className="w-full text-active text-small"
                                onClick={() => handleEmailPasswordLogin('joan@onlook.com', 'password123', returnUrl)}
                                disabled={!!signingInMethod}
                            >
                                Sign in as demo user
                            </Button>
                        </div>
                    )}
                    <p className="text-small text-foreground-onlook">
                        {t(transKeys.welcome.terms.agreement)}{' '}
                        <Link
                            href="https://onlook.com/privacy-policy"
                            target="_blank"
                            className="text-gray-300 hover:text-gray-50 underline transition-colors duration-200"
                        >
                            {t(transKeys.welcome.terms.privacy)}
                        </Link>
                        {' '}
                        {t(transKeys.welcome.terms.and)}{' '}
                        <Link
                            href="https://onlook.com/terms-of-service"
                            target="_blank"
                            className="text-gray-300 hover:text-gray-50 underline transition-colors duration-200"
                        >
                            {t(transKeys.welcome.terms.tos)}
                        </Link>
                    </p>
                </div>
                <div className="flex flex-row space-x-1 text-small text-gray-600">
                    <p>{t(transKeys.welcome.version, { version: '1.0.0' })}</p>
                </div>
            </div>
            <div className="hidden w-full md:block m-6">
                <Image
                    className="w-full h-full object-cover rounded-xl"
                    src={LOGIN_BACKGROUND}
                    alt="Onlook dunes dark"
                    width={1000}
                    height={1000}
                    priority={false}
                    loading="lazy"
                />
            </div>
        </div>
    );
}
