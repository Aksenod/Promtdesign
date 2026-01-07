import * as schema from '@onlook/db/src/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
    drizzle: ReturnType<typeof drizzle> | undefined;
};

/**
 * Check if we're in Next.js build phase.
 * During build, Next.js may import modules for static analysis, but env vars may not be available.
 * 
 * IMPORTANT: We ONLY check NEXT_PHASE - this is the ONLY reliable indicator.
 * In production runtime, NEXT_PHASE is NEVER set by Next.js, even if SKIP_ENV_VALIDATION
 * remains from Dockerfile build phase. This ensures DB connection is created in runtime.
 */
function isBuildPhase(): boolean {
    // ONLY check NEXT_PHASE - Next.js sets this ONLY during actual build phase
    // In production runtime, NEXT_PHASE is undefined, so we'll create DB connection
    return process.env.NEXT_PHASE === 'phase-production-build' || 
           process.env.NEXT_PHASE === 'phase-export';
}

/**
 * Initialize database connection with proper error handling.
 * During build phase, returns null to allow module import without errors.
 * Throws a clear error if SUPABASE_DATABASE_URL is not set (only in runtime, not build).
 */
function createDbConnection(): postgres.Sql | null {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;
    
    // During build phase, don't initialize - will be initialized at runtime
    if (isBuildPhase()) {
        return null;
    }
    
    if (!databaseUrl) {
        const error = new Error(
            'SUPABASE_DATABASE_URL environment variable is required but not set. ' +
            'Please ensure the database URL is configured in your environment variables.'
        );
        console.error('❌ Database connection error:', error.message);
        throw error;
    }

    try {
        return postgres(databaseUrl, { 
            prepare: false,
            // Add connection timeout and error handling
            max: 10,
            idle_timeout: 20,
            connect_timeout: 10,
        });
    } catch (error) {
        const dbError = error instanceof Error 
            ? error 
            : new Error(`Failed to create database connection: ${String(error)}`);
        console.error('❌ Database connection initialization error:', dbError.message);
        throw dbError;
    }
}

/**
 * Lazy initialization of database connection.
 * Connection is created only when first accessed, not during module import.
 * This allows the module to be imported during Next.js build phase.
 */
function getDbConnection(): postgres.Sql {
    if (globalForDb.conn) {
        return globalForDb.conn;
    }

    const conn = createDbConnection();
    
    // During build phase, conn will be null - connection will be created at runtime
    if (!conn) {
        throw new Error(
            'Database connection is not available during Next.js build phase. ' +
            'Connection will be initialized at runtime when first accessed. ' +
            'If you see this error at runtime, ensure SUPABASE_DATABASE_URL is set.'
        );
    }
    
    globalForDb.conn = conn;
    return conn;
}

/**
 * Lazy initialization of Drizzle instance.
 * This ensures we don't create connection during build phase.
 */
function getDb(): ReturnType<typeof drizzle> {
    if (globalForDb.drizzle) {
        return globalForDb.drizzle;
    }

    // During build phase, getDbConnection will throw, but that's okay
    // because we should not be using DB during build anyway
    const conn = getDbConnection();
    const drizzleInstance = drizzle(conn, { schema });
    globalForDb.drizzle = drizzleInstance;
    return drizzleInstance;
}

// Get the type of Drizzle instance for TypeScript inference
// We use a conditional to get the type without actually creating a connection
type DrizzleInstanceType = ReturnType<typeof drizzle<typeof schema>>;

// Create a type-safe proxy that lazily initializes the connection
// The proxy preserves all Drizzle types while allowing lazy initialization
export const db = new Proxy({} as DrizzleInstanceType, {
    get(_target, prop) {
        try {
            const dbInstance = getDb();
            const value = dbInstance[prop as keyof typeof dbInstance];
            
            // If it's a function, bind it to the instance
            if (typeof value === 'function') {
                return value.bind(dbInstance);
            }
            
            return value;
        } catch (error) {
            // During build phase, if someone tries to use DB, provide helpful error
            if (error instanceof Error && error.message.includes('build phase')) {
                console.warn('⚠️ Database access attempted during build phase:', error.message);
                // Return a no-op function for build phase to prevent crashes
                if (typeof prop === 'string' && (prop === 'query' || prop === 'transaction' || prop === 'insert' || prop === 'update' || prop === 'delete')) {
                    return () => {
                        throw new Error(
                            'Database operations cannot be performed during Next.js build phase. ' +
                            'This code will work correctly at runtime.'
                        );
                    };
                }
            }
            throw error;
        }
    },
}) as DrizzleInstanceType;

export type DrizzleDb = typeof db;