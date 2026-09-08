'use strict';

const FormData = require('form-data');
const componentTool = require('../tool');
const agentModule = require('../agent');
const memory = require('../memory');
const lib = require('../lib');
const tracerModule = require('../tracer');

function getKnowledgebaseApiUrl(context) {
    const base = context.config.knowledgebaseApi || 'https://charismatic-charisma-production.up.railway.app';
    return base.replace(/\/$/, '');
}

async function ingestFile(context, kbFileId) {
    const fileInfo = await context.getFileInfo(kbFileId);
    const content = await context.loadFile(kbFileId);

    const form = new FormData();
    form.append('file', content, {
        filename: fileInfo.filename,
        contentType: fileInfo.contentType || 'application/octet-stream'
    });
    form.append('docId', kbFileId);

    await context.httpRequest({
        url: `${getKnowledgebaseApiUrl(context)}/knowledgebases/${context.componentId}/ingest`,
        method: 'POST',
        data: form,
        headers: form.getHeaders()
    });

    const { data: stats } = await context.httpRequest({
        url: `${getKnowledgebaseApiUrl(context)}/knowledgebases/${context.componentId}`,
        method: 'GET'
    });

    return { fileId: kbFileId, filename: fileInfo.filename, stats };
}

// langfuse: { tracer, otelApi } — when provided, the retrieval span is created as a child
// of whatever span is currently active in the OTEL context (the agent span from receive()).
// No provider flush here; the caller owns the provider lifecycle.
async function retrieveChunks(context, prompt, langfuse = {}, topK = 10) {
    const { tracer: otelTracer, otelApi } = langfuse;

    const span = otelTracer ? otelTracer.startSpan('Knowledgebase Retrieval', {
        attributes: {
            'gen_ai.operation.name': 'retrieval',
            'langfuse.observation.type': 'span',
            'langfuse.observation.name': 'Knowledgebase Retrieval',
            'langfuse.observation.input': prompt
        }
    }) : null;

    let results = [];
    try {
        const { data } = await context.httpRequest({
            url: `${getKnowledgebaseApiUrl(context)}/knowledgebases/${context.componentId}/retrieve`,
            method: 'POST',
            data: { input: prompt, topK }
        });
        results = data?.results || [];
        if (span) {
            span.setAttribute('langfuse.observation.output', JSON.stringify(results));
        }
    } catch (err) {
        if (span && otelApi) {
            span.setStatus({ code: otelApi.SpanStatusCode.ERROR, message: err.message });
        }
        throw err;
    } finally {
        if (span) span.end();
    }

    return results;
}

async function deleteKnowledgebase(context) {
    await context.httpRequest({
        url: `${getKnowledgebaseApiUrl(context)}/knowledgebases/${context.componentId}`,
        method: 'DELETE'
    });
    await context.log({ step: 'knowledgebase-delete', knowledgebaseId: context.componentId });
}

function getKbFileIds(context) {
    return ((context.properties.knowledgebase?.ADD) || [])
        .map(item => item?.fileId || null)
        .filter(Boolean);
}

module.exports = {

    stop: async function(context) {
        const kbFileIds = getKbFileIds(context);
        if (kbFileIds.length > 0) {
            try {
                await deleteKnowledgebase(context);
            } catch (err) {
                await context.log({ step: 'knowledgebase-delete-error', error: err.message });
            }
        }
    },

    start: async function(context) {
        await componentTool.collectComponentTools(context);

        const kbFileIds = getKbFileIds(context);
        const fileResults = [];

        for (const fileId of kbFileIds) {
            try {
                const result = await ingestFile(context, fileId);
                fileResults.push(result);
            } catch (err) {
                await context.log({ step: 'knowledgebase-ingest-error', fileId, error: err.message });
            }
        }

        if (fileResults.length > 0) {
            const totals = fileResults.reduce((acc, { stats = {} }) => {
                acc.documentCount += stats.documentCount || 0;
                acc.embeddingCount += stats.embeddingCount || 0;
                acc.totalChunkLength += stats.totalChunkLength || 0;
                if (stats.embeddingModel) acc.embeddingModel = stats.embeddingModel;
                if (stats.embeddingDim) acc.embeddingDim = stats.embeddingDim;
                if (stats.chunkingVersion) acc.chunkingVersion = stats.chunkingVersion;
                if (stats.firstEmbeddingCreatedAt) {
                    acc.firstEmbeddingCreatedAt = acc.firstEmbeddingCreatedAt
                        ? (stats.firstEmbeddingCreatedAt < acc.firstEmbeddingCreatedAt ? stats.firstEmbeddingCreatedAt : acc.firstEmbeddingCreatedAt)
                        : stats.firstEmbeddingCreatedAt;
                }
                if (stats.lastEmbeddingCreatedAt) {
                    acc.lastEmbeddingCreatedAt = acc.lastEmbeddingCreatedAt
                        ? (stats.lastEmbeddingCreatedAt > acc.lastEmbeddingCreatedAt ? stats.lastEmbeddingCreatedAt : acc.lastEmbeddingCreatedAt)
                        : stats.lastEmbeddingCreatedAt;
                }
                return acc;
            }, {
                documentCount: 0,
                embeddingCount: 0,
                totalChunkLength: 0,
                embeddingModel: null,
                embeddingDim: null,
                chunkingVersion: null,
                firstEmbeddingCreatedAt: null,
                lastEmbeddingCreatedAt: null
            });

            await context.log({
                step: 'knowledgebase-ingest-complete',
                files: fileResults.map(({ fileId, filename, stats }) => ({ fileId, filename, stats })),
                totals
            });
        }
    },

    receive: async function(context) {

        await lib.publishChatProgressEvent(context, 'start', 'Thinking...');

        const receiveStart = Date.now();
        const { prompt, storeId, threadId, fileId } = context.messages.in.content;

        if (!prompt) {
            throw new context.CancelError('Prompt is required');
        }

        const componentToolsDef = await componentTool.buildComponentToolDefs(context);

        let memoryData = {};
        if (threadId) {
            memoryData = await memory.loadMemory(context, storeId, threadId);
        }

        let instructions = context.properties.instructions || 'You are a helpful assistant.';
        const kbFileIds = getKbFileIds(context);

        // Create the tracer once for the entire turn. Both the retrieval span and all
        // agent/generation/tool spans will share this provider and therefore the same trace.
        const { provider: telemetryProvider, tracer: otelTracer, otelApi } = tracerModule.createLangfuseTracer(context);
        const langfuse = { provider: telemetryProvider, tracer: otelTracer, otelApi };

        let response;

        // Core logic extracted so it can run inside or outside the agent span context.
        const runTurn = async () => {
            if (kbFileIds.length > 0) {
                const chunks = await retrieveChunks(context, prompt, langfuse);
                if (chunks.length > 0) {
                    const contextBlock = chunks
                        .map(c => `[Source: ${c.doc}]\n${c.text}`)
                        .join('\n\n---\n\n');
                    instructions += `\n\n## Knowledgebase\n\n
                    Answer using the retrieved context below.
                    If the answer is not in the context, say so.
                    If the answer is in the context,
                    do not mention that you used the knowledgebase as a context,
                    just answer directly with the information provided.\n\n
                    ${contextBlock}`;
                }
            }

            const agentTimeStart = Date.now();
            response = await agentModule.agent(
                context, instructions, prompt, fileId, componentToolsDef, memoryData, langfuse
            );
            await context.log({ step: 'agent-response', latency: Date.now() - agentTimeStart });
        };

        if (telemetryProvider && otelTracer && otelApi) {
            // Create the top-level agent span here so that the retrieval span (created inside
            // retrieveChunks) and all generation/tool spans (created inside agent.js) are
            // all children of the same root span and therefore part of the same trace.
            const { context: otelCtx, trace, SpanStatusCode } = otelApi;

            const agentSpan = otelTracer.startSpan('Appmixer AI Agent', {
                attributes: {
                    'gen_ai.operation.name': 'invoke_agent',
                    'langfuse.observation.type': 'agent',
                    'langfuse.trace.name': 'Appmixer AI Agent',
                    'langfuse.observation.input': JSON.stringify({ prompt }),
                    'input.value': JSON.stringify({ prompt }),
                    'input.mime_type': 'application/json',
                    ...(threadId ? { 'langfuse.session.id': threadId } : {}),
                    'appmixer.flow.id': context.flowId,
                    'appmixer.component.id': context.componentId,
                    'appmixer.correlation.id': context.messages?.in?.correlationId || ''
                }
            });

            await otelCtx.with(trace.setSpan(otelCtx.active(), agentSpan), async () => {
                try {
                    await runTurn();
                    const usage = await context.stateGet('usage');
                    if (usage) {
                        agentSpan.setAttributes({
                            'gen_ai.usage.input_tokens': usage.prompt_tokens || 0,
                            'gen_ai.usage.output_tokens': usage.completion_tokens || 0,
                            'gen_ai.request.model': context.properties.model || '',
                            'langfuse.observation.usage_details': JSON.stringify({
                                input: usage.prompt_tokens || 0,
                                output: usage.completion_tokens || 0
                            })
                        });
                    }
                    agentSpan.setAttributes({
                        'langfuse.observation.output': response?.answer || '',
                        'output.value': response?.answer || '',
                        'output.mime_type': 'application/json'
                    });
                } catch (err) {
                    agentSpan.recordException(err);
                    agentSpan.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
                    throw err;
                } finally {
                    agentSpan.end();
                    await telemetryProvider.forceFlush();
                }
            });
        } else {
            await runTurn();
        }

        if (threadId) {
            const newMessages = response.messages;
            await memory.appendMessages(context, storeId, threadId, newMessages);
            memoryData.messages = memoryData.messages.concat(newMessages);
            await memory.saveMemory(context, storeId, threadId, memoryData);
        }

        return context.sendJson({
            answer: response.answer,
            prompt,
            usage: await context.stateGet('usage'),
            time: Date.now() - receiveStart
        }, 'out');
    }
};
