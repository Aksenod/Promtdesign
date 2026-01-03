#!/usr/bin/env node
/**
 * Minimal test to verify CSB_API_KEY works with @codesandbox/sdk
 * Run: CSB_API_KEY=your_token bun test-csb-token.mjs
 */

import { CodeSandbox } from '@codesandbox/sdk';

const apiKey = process.env.CSB_API_KEY;
if (!apiKey) {
    console.error('❌ CSB_API_KEY not set');
    process.exit(1);
}

console.log('🔑 CSB_API_KEY length:', apiKey.length);
console.log('🔑 CSB_API_KEY prefix:', apiKey.slice(0, 10) + '...');

try {
    const sdk = new CodeSandbox();
    console.log('📦 SDK initialized, attempting to create sandbox from template fxis37...');
    
    const sandbox = await sdk.sandboxes.create({
        source: 'template',
        id: 'fxis37',
        title: 'test-token-validation',
    });
    
    console.log('✅ SUCCESS! Sandbox created:', sandbox.id);
    
    // Clean up - hibernate the test sandbox
    if (typeof sandbox?.hibernate === 'function') {
        await sandbox.hibernate();
        console.log('🧹 Test sandbox hibernated');
    } else {
        console.log('ℹ️ Cleanup skipped (sandbox.hibernate is not available in this SDK response)');
    }
    
} catch (error) {
    console.error('❌ FAILED:', error?.message || error);
    console.error('Full error:', error);
    process.exit(1);
}
