'use strict';

const uuid = require('uuid');

/**
 * Publish a progress event to the agent's chat stream.
 */
function publishChatProgressEvent(context, step, content) {

    return context.pubSubPublish(`stream:agent:events:${context.messages.in.content.threadId}`, {
        type: 'progress',
        data: {
            id: uuid.v6(),
            step,
            content,
            role: 'agent',
            correlationId: context.messages.in.correlationId,
            componentId: context.componentId,
            flowId: context.flowId
        }
    });
}

/**
 * Publish a text-delta streaming event to the agent's chat stream.
 */
function publishChatDeltaEvent(context, completionId, content) {

    return context.pubSubPublish(`stream:agent:events:${context.messages.in.content.threadId}`, {
        type: 'delta',
        data: {
            id: uuid.v6(),
            content,
            role: 'agent',
            correlationId: context.messages.in.correlationId,
            componentId: context.componentId,
            flowId: context.flowId
        }
    });
}

/**
 * Accumulate token usage from a single LLM call into the component's persistent state.
 * Vercel AI SDK uses camelCase; guards against both camelCase and snake_case formats.
 */
async function updateUsage(context, usage) {

    if (!usage) return;

    const totalUsage = await context.stateGet('usage') || {};
    const promptTokens = usage.promptTokens ?? usage.prompt_tokens ?? 0;
    const completionTokens = usage.completionTokens ?? usage.completion_tokens ?? 0;
    const totalTokens = usage.totalTokens ?? usage.total_tokens ?? 0;

    return context.stateSet('usage', {
        prompt_tokens: (totalUsage.prompt_tokens || 0) + promptTokens,
        completion_tokens: (totalUsage.completion_tokens || 0) + completionTokens,
        total_tokens: (totalUsage.total_tokens || 0) + totalTokens
    });
}

/**
 * Human-readable byte size string.
 */
function formatBytes(bytes, decimals = 2) {

    if (!+bytes) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

module.exports = {
    publishChatProgressEvent,
    publishChatDeltaEvent,
    updateUsage,
    formatBytes
};
