import { transKeys } from '@/i18n/keys';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@onlook/ui/alert-dialog';
import { Button } from '@onlook/ui/button';
import { Input } from '@onlook/ui/input';
import { Label } from '@onlook/ui/label';
import { Icons } from '@onlook/ui/icons';
import { useTranslations } from 'next-intl';
import { useAuthContext } from '../auth/auth-context';
import { useState } from 'react';

export function AuthModal() {
    const { setIsAuthModalOpen, isAuthModalOpen, handleEmailPasswordLogin, handleEmailPasswordSignUp, signingInMethod } = useAuthContext();
    const t = useTranslations();
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
                await handleEmailPasswordLogin(email, password, null);
            } else {
                await handleEmailPasswordSignUp(email, password, null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${mode === 'login' ? 'sign in' : 'sign up'}`);
        }
    };

    return (
        <AlertDialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
            <AlertDialogContent className="!max-w-sm bg-black">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-center text-xl font-normal">
                        {mode === 'login' ? t(transKeys.welcome.login.loginToEdit) : 'Create account'}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-balance">
                        {mode === 'login' ? t(transKeys.welcome.login.shareProjects) : 'Sign up to get started'}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="modal-email">Email</Label>
                        <Input
                            id="modal-email"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={!!signingInMethod}
                            className="bg-background-onlook"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="modal-password">Password</Label>
                        <Input
                            id="modal-password"
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
                <AlertDialogFooter className="flex !justify-center w-full">
                    <Button variant={'ghost'} onClick={() => setIsAuthModalOpen(false)}>
                        {t(transKeys.projects.actions.close)}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
