#!/usr/bin/env node
import { CodeSandbox } from '@codesandbox/sdk';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { frames } from '../packages/db/src/schema/index.js';
import { eq } from 'drizzle-orm';

const CSB_DOMAIN = 'csb.app';

async function getSandboxPreviewUrl(sandboxId, port) {
    try {
        const sdk = new CodeSandbox();
        const hostToken = await sdk.hosts.createToken(sandboxId);
        return sdk.hosts.getUrl(hostToken, port);
    } catch (error) {
        console.warn(`Failed to generate signed URL for ${sandboxId}:${port}, using fallback:`, error.message);
        return `https://${sandboxId}-${port}.${CSB_DOMAIN}`;
    }
}

function extractSandboxIdAndPort(url) {
    const match = url.match(/https:\/\/([a-z0-9]+)-(\d+)\.csb\.app/);
    if (!match) return null;
    return { sandboxId: match[1], port: parseInt(match[2], 10) };
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is required');
    }

    const client = postgres(connectionString);
    const db = drizzle(client);

    console.log('Fetching all frames with csb.app URLs...');
    const allFrames = await db.select().from(frames);
    
    const framesToUpdate = allFrames.filter(frame => 
        frame.url && frame.url.includes('.csb.app') && !frame.url.includes('preview_token')
    );

    console.log(`Found ${framesToUpdate.length} frames to update`);

    let updated = 0;
    let failed = 0;

    for (const frame of framesToUpdate) {
        const parsed = extractSandboxIdAndPort(frame.url);
        if (!parsed) {
            console.log(`Skipping frame ${frame.id}: cannot parse URL ${frame.url}`);
            failed++;
            continue;
        }

        const { sandboxId, port } = parsed;
        const newUrl = await getSandboxPreviewUrl(sandboxId, port);

        if (newUrl === frame.url) {
            console.log(`Skipping frame ${frame.id}: URL unchanged (fallback used)`);
            continue;
        }

        try {
            await db.update(frames)
                .set({ url: newUrl })
                .where(eq(frames.id, frame.id));
            
            console.log(`✓ Updated frame ${frame.id}: ${sandboxId}-${port} -> signed URL`);
            updated++;
        } catch (error) {
            console.error(`✗ Failed to update frame ${frame.id}:`, error.message);
            failed++;
        }
    }

    await client.end();

    console.log('\n=== Migration Summary ===');
    console.log(`Total frames checked: ${allFrames.length}`);
    console.log(`Frames needing update: ${framesToUpdate.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);
}

main().catch(console.error);
