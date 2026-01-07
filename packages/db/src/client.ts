import * as schema from '@onlook/db/src/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

/**
 * Initialize database connection with proper error handling.
 * Throws a clear error if SUPABASE_DATABASE_URL is not set.
 */
function createDbConnection(): postgres.Sql {
    const databaseUrl = process.env.SUPABASE_DATABASE_URL;
    
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

// Always cache the connection globally to avoid creating multiple connection pools
// This is important for production where module imports can happen in multiple contexts
const conn = globalForDb.conn ?? createDbConnection();
if (!globalForDb.conn) {
    globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
export type DrizzleDb = typeof db;