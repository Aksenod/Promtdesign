const PREVIEW_URL = process.env.SANDBOX_PREVIEW_URL ?? 'http://localhost:8084';
const EDITOR_URL = process.env.SANDBOX_EDITOR_URL ?? 'http://localhost:8080';

export const start = async (sandboxId: string): Promise<{
    previewUrl: string,
    editorUrl: string
}> => {
    return {
        previewUrl: PREVIEW_URL,
        editorUrl: EDITOR_URL,
    };
};

export const stop = async (sandboxId: string) => {
    return {
        previewUrl: PREVIEW_URL,
        editorUrl: EDITOR_URL,
    };
};

export const status = async (sandboxId: string) => {
    return {
        previewUrl: PREVIEW_URL,
        editorUrl: EDITOR_URL,
    };
};