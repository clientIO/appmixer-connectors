'use strict';

// One-time flag: register AsyncLocalStorageContextManager as the global OTEL context manager.
// This is required for otelApi.context.with() to propagate the active span through async/await
// boundaries. The default NoopContextManager is synchronous and does not use AsyncLocalStorage,
// so context.active() would always return the root context without this setup.
// AsyncLocalStorage is per-async-tree — concurrent agent runs are fully isolated.
let otelContextManagerSetup = false;

/**
 * Create an isolated per-call NodeTracerProvider wired to Langfuse.
 * Credentials are read from context.config.
 *
 * Returns { provider, tracer, otelApi } when Langfuse is configured,
 * or { provider: null, tracer: undefined, otelApi: null } otherwise.
 *
 * Callers must invoke provider.forceFlush() after each AI SDK call to ensure
 * all buffered spans are exported before the process continues.
 */
function createLangfuseTracer(context) {

    const publicKey = context.config?.langfusePublicKey;
    const secretKey = context.config?.langfuseSecretKey;

    if (!publicKey || !secretKey) return { provider: null, tracer: undefined, otelApi: null };

    try {
        const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
        const { LangfuseSpanProcessor } = require('@langfuse/otel');
        const otelApi = require('@opentelemetry/api');

        if (!otelContextManagerSetup) {
            otelContextManagerSetup = true;
            try {
                const { AsyncLocalStorageContextManager } = require('@opentelemetry/context-async-hooks');
                otelApi.context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
            } catch (e) { /* package unavailable; span hierarchy will not work */ }
        }

        const provider = new NodeTracerProvider({
            spanProcessors: [new LangfuseSpanProcessor({
                publicKey,
                secretKey,
                baseUrl: context.config?.langfuseBaseUrl || undefined
            })]
        });

        return { provider, tracer: provider.getTracer('appmixer-ai-agent'), otelApi };
    } catch (err) {
        return { provider: null, tracer: undefined, otelApi: null };
    }
}

module.exports = { createLangfuseTracer };
