'use strict';

const { generateText } = require('ai');
const provider = require('./provider');
const lib = require('./lib');
const tokenizer = require('gpt-tokenizer');

const MEMORY_RECENT_MESSAGES_TOKEN_BUDGET = 32000;
const MEMORY_SUMMARY_TOKEN_BUDGET = 16000;
const MEMORY_SUMMARY_INSTRUCTION = `

You update a conversation memory summary.

Rules:

- Preserve user goals, requirements, decisions, preferences, constraints.
- Preserve open questions and unresolved tasks.
- Preserve important technical details, names, APIs, data structures, errors.
- Omit chit-chat, greetings, repetition, and already-resolved minor details.
- Do not invent facts.
- Write compactly.

`;

/**
 * Splits messages into:
 * - recent: newest messages that fit within maxTokensForRecentMessages
 * - old: older messages that should be summarized
 *
 * messages should be OpenAI/Vercel-style:
 * [
 *   { role: 'user', content: '...' },
 *   { role: 'assistant', content: '...' }
 * ]
 */
function splitMessagesByTokenBudget(messages, maxTokensForRecentMessages) {
    if (!Array.isArray(messages)) {
        throw new TypeError('messages must be an array');
    }

    if (!Number.isInteger(maxTokensForRecentMessages) || maxTokensForRecentMessages <= 0) {
        throw new TypeError('maxTokensForRecentMessages must be a positive integer');
    }

    const recent = [];

    // Walk backwards from the newest message.
    // Pass content as a plain string — isWithinTokenLimit with chat objects
    // requires a model name; encoding concatenated text is accurate enough here.
    for (let i = messages.length - 1; i >= 0; i--) {
        const candidate = [messages[i], ...recent];
        const text = candidate.map(m => normalizeContent(m.content)).join('\n');

        if (tokenizer.isWithinTokenLimit(text, maxTokensForRecentMessages) === false) {
            break;
        }

        recent.unshift(messages[i]);
    }

    const old = messages.slice(0, messages.length - recent.length);
    return { old, recent };
}

function normalizeContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (content == null) {
        return '';
    }

    return JSON.stringify(content);
}


function formatMessagesForSummary(messages) {
    return messages
        .map((m, i) => {
            const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            return `[${i + 1}] ${m.role.toUpperCase()}:\n${content}`;
        }).join('\n\n');
}

/**
 * Summarise a full conversation history into a compact representation.
 * Uses the configured model and a configurable summary prompt.
 */
async function summarizeHistory(context, oldSummary, oldMessages) {

    const model = provider.createModel(context);
    const prompt = `
        Previous summary:
        ${oldSummary || '(none)'}

        New conversation messages to incorporate:
        ${formatMessagesForSummary(oldMessages)}

        Return an updated summary only.
    `;

    const result = await generateText({
        model,
        system: MEMORY_SUMMARY_INSTRUCTION,
        prompt,
        maxTokens: context.config.MEMORY_SUMMARY_TOKEN_BUDGET || MEMORY_SUMMARY_TOKEN_BUDGET
    });

    await lib.updateUsage(context, result.usage);
    return result.text;
}

/**
 * Load the condensed conversation memory for a thread.
 * Falls back to component state when no store is configured.
 */
async function loadMemory(context, storeId, threadId) {

    const key = `agent_memory_${threadId}`;
    const messagesString = storeId
        ? (await context.store.get(storeId, key)).value
        : await context.stateGet(key);
    return messagesString ? JSON.parse(messagesString) : {
        summary: '',
        messages: []
    };
}

/**
 * Persist the condensed agent memory for a thread.
 */
async function saveMemory(context, storeId, threadId, memoryData) {

    const maxRecentMessagesTokenBudget = context.config.MEMORY_RECENT_MESSAGES_TOKEN_BUDGET
        || MEMORY_RECENT_MESSAGES_TOKEN_BUDGET;

    // If the memory exceeds the max size, summarize the oldest messages and save the summary + recent messages as the new memory.
    const split = splitMessagesByTokenBudget(memoryData.messages, maxRecentMessagesTokenBudget);

    if (split.old.length > 0) {
        const newSummary = await summarizeHistory(context, memoryData.summary, split.old);
        // todo: drop old summarized messages.
        await context.log({
            step: 'summarized-memory',
            threadId,
            oldMessagesCount: split.old.length
        });
        memoryData.summary = newSummary;
        memoryData.messages = split.recent;
    }

    const key = `agent_memory_${threadId}`;
    const value = JSON.stringify(memoryData);
    return storeId
        ? context.store.set(storeId, key, value)
        : context.stateSet(key, value);
}

/**
 * Append raw new messages to persistent memory (keyed by timestamp).
 */
function appendMessages(context, storeId, threadId, newMessages) {

    const key = `agent_messages_${threadId}_${Date.now()}`;
    const value = JSON.stringify(newMessages);
    return storeId
        ? context.store.set(storeId, key, value)
        : context.stateSet(key, value);
}

module.exports = {
    loadMemory,
    saveMemory,
    appendMessages
};
