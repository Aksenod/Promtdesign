export type AgentLogPayload = Record<string, unknown>;

interface AgentLogOptions {
    location: string;
    message: string;
    data?: AgentLogPayload;
    sessionId?: string;
    runId?: string;
    hypothesisId?: string;
}

const AGENT_INGEST_URL =
    typeof process !== 'undefined'
        ? process.env.AGENT_INGEST_URL ?? process.env.NEXT_PUBLIC_AGENT_INGEST_URL
        : undefined;

const isAgentLoggingEnabled =
    typeof process !== 'undefined' ? process.env.AGENT_LOGGING_ENABLED === 'true' : false;

export function logAgentEvent(options: AgentLogOptions): void {
    if (!AGENT_INGEST_URL || !isAgentLoggingEnabled) {
        return;
    }

    const body = {
        sessionId: options.sessionId ?? 'debug-session',
        runId: options.runId ?? 'run1',
        hypothesisId: options.hypothesisId ?? 'A',
        location: options.location,
        message: options.message,
        data: options.data ?? {},
        timestamp: Date.now(),
    };

    try {
        // In server environments we await; in the browser we fire-and-forget
        const result = fetch(AGENT_INGEST_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (typeof window === 'undefined') {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            result.catch(() => {});
        }
    } catch {
        // Swallow all errors – logging must never break user flows
    }
}

