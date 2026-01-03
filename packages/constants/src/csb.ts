import type { SandboxTemplate } from '@onlook/models';

export enum Templates {
    BLANK = 'BLANK',
    EMPTY_NEXTJS = 'EMPTY_NEXTJS',
}

export const SandboxTemplates: Record<Templates, SandboxTemplate> = {
    BLANK: {
        id: 'xzsy8c',
        port: 3000,
    },
    EMPTY_NEXTJS: {
        id: 'fxis37',
        port: 3000,
    },
};

export const CSB_PREVIEW_TASK_NAME = 'dev';
export const CSB_DOMAIN = 'csb.app';

export async function getSandboxPreviewUrl(sandboxId: string, port: number): Promise<string> {
    if (typeof window !== 'undefined') {
        return `https://${sandboxId}-${port}.${CSB_DOMAIN}`;
    }
    
    try {
        const { CodeSandbox } = await import('@codesandbox/sdk');
        const sdk = new CodeSandbox();
        const hostToken = await sdk.hosts.createToken(sandboxId);
        return sdk.hosts.getUrl(hostToken, port);
    } catch (error) {
        console.warn('Failed to generate signed preview URL, falling back to unsigned:', error);
        return `https://${sandboxId}-${port}.${CSB_DOMAIN}`;
    }
}
