'use strict';

const { generateText, streamText } = require('ai');
const provider = require('./provider');
const tracer = require('./tracer');
const componentTool = require('./tool');
const lib = require('./lib');

const AI_AGENT_MAX_ATTEMPTS = 20;
const AI_AGENT_MAX_FILE_SIZE = 1024 * 1024 * 5;

// ─── File handling ────────────────────────────────────────────────────────────

/**
 * Build the content part(s) for the user message, handling image, PDF, and text files
 * using Vercel AI SDK content part types (image, file, text).
 */
async function buildUserContent(context, prompt, fileId) {

    if (!fileId) return prompt;

    let fileInfo;
    try {
        fileInfo = await context.getFileInfo(fileId);
    } catch (err) {
        throw new context.CancelError(`Failed to get file info: ${err.message}`);
    }

    const size = fileInfo.length;
    const maxSize = context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE;

    await lib.publishChatProgressEvent(
        context,
        'file-processing',
        `Processing file ${fileInfo.filename} (${lib.formatBytes(size)})...`
    );

    if (size > maxSize) {
        throw new context.CancelError(
            `File size ${size} exceeds the maximum allowed size of ${maxSize} bytes.`
        );
    }

    const mime = fileInfo.contentType || 'application/octet-stream';

    try {
        const fileBuffer = await context.loadFile(fileId);

        if (['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(mime)) {
            return [
                { type: 'image', image: fileBuffer, mimeType: mime },
                { type: 'text', text: prompt }
            ];
        }

        if (mime === 'application/pdf') {
            return [
                { type: 'file', data: fileBuffer, mimeType: 'application/pdf' },
                { type: 'text', text: prompt }
            ];
        }

        // Other file types: read as plain text.
        await context.log({
            warning: `File type ${mime} is not an image or PDF. Parsed as text and sent as a regular prompt.`
        });
        return [
            { type: 'text', text: `File content:\n${fileBuffer.toString('utf8')}` },
            { type: 'text', text: prompt }
        ];
    } catch (err) {
        if (err instanceof context.CancelError) throw err;
        throw new context.CancelError(`Failed to process file: ${err.message}`);
    }
}

// ─── Agentic loop ─────────────────────────────────────────────────────────────

/**
 * Run the agentic loop for a single turn.
 *
 * Streaming mode: builds a custom Langfuse span hierarchy
 *   (generation → model_step → model_chunk / tool call)
 *   and streams text deltas to the pubsub chat channel.
 *
 * Non-streaming mode: uses generateText with onStepFinish callbacks.
 *
 * Returns { messages, answer }.
 */
// langfuse is optionally passed in from the caller when it already owns the trace.
// When provided the agent span already exists as the active context — just run().
// When absent, agent() creates its own tracer and wraps run() in runWithAgentSpan().
async function agent(context, instructions, prompt, fileId, componentToolsDef, memory, langfuse = {}) {

    const model = provider.createModel(context);
    const isStream = !!context.properties.stream;
    const maxSteps = context.config.AI_AGENT_MAX_ATTEMPTS || AI_AGENT_MAX_ATTEMPTS;

    const {
        provider: telemetryProvider,
        tracer: otelTracer,
        otelApi
    } = langfuse.tracer
        ? { provider: langfuse.provider, tracer: langfuse.tracer, otelApi: langfuse.otelApi }
        : tracer.createLangfuseTracer(context);

    const threadId = context.messages?.in?.content?.threadId;

    // Non-streaming path still uses SDK auto-telemetry (disabled for streaming below).
    const sdkTelemetry = otelTracer ? {
        isEnabled: true,
        tracer: otelTracer,
        // Do NOT set functionId: it prefixes span names (e.g. "appmixer-ai-agent:ai.streamText.doStream")
        // which breaks Langfuse's OTLP ingestion name-matching for input/output/toolCalls mapping.
        recordInputs: true,
        recordOutputs: true,
        metadata: {
            sessionId: threadId,
            flowId: context.flowId,
            componentId: context.componentId,
            correlationId: context.messages?.in?.correlationId
        }
    } : { isEnabled: false };

    const userContent = await buildUserContent(context, prompt, fileId);
    const inputMessages = [
        ...(memory.summary ? [{ role: 'system', content: 'Conversation summary so far:\n' + memory.summary }] : []),
        ...(memory.messages || []),
        { role: 'user', content: userContent }
    ];

    await context.log({ step: 'agent-start', isStream, maxSteps });

    let finalText;
    let responseMessages;

    // run() is called inside the active agent span context (via otelContext.with) so that
    // all child spans (generation, model_step, tool execution) inherit the correct trace ID.
    const run = async () => {

        // getStepCtx returns the current model_step OTEL context, updated as steps progress,
        // so tool execution spans parent under the right step span in Langfuse.
        let currentStepCtx = null;
        const getStepCtx = () => currentStepCtx;

        const componentVercelTools = componentTool.buildComponentVercelTools(context, componentToolsDef, otelTracer, getStepCtx);
        const vercelTools = Object.keys(componentVercelTools).length ? componentVercelTools : undefined;

        const sharedOptions = {
            model,
            system: instructions || 'You are a helpful assistant.',
            messages: inputMessages,
            ...(vercelTools ? { tools: vercelTools, maxSteps } : {}),
            experimental_telemetry: sdkTelemetry
        };

        if (isStream) {
            await runStream(context, sharedOptions, inputMessages, otelTracer, otelApi,
                getStepCtx, (stepCtx) => { currentStepCtx = stepCtx; },
                (result) => {
                    finalText = result.text;
                    responseMessages = result.messages;
                });
        } else {
            await runGenerate(context, sharedOptions,
                (result) => {
                    finalText = result.text;
                    responseMessages = result.messages;
                });
        }
    };

    if (!langfuse.tracer && telemetryProvider && otelTracer && otelApi) {
        // Caller has no active trace — own the agent span lifecycle here.
        await runWithAgentSpan(context, otelTracer, otelApi, telemetryProvider, prompt, threadId, run,
            () => finalText,
            async () => context.stateGet('usage'));
    } else {
        // Caller already established the agent span in the active context — just run.
        await run();
    }

    return { messages: responseMessages, answer: finalText };
}

// ─── Streaming execution ──────────────────────────────────────────────────────

async function runStream(context, sharedOptions, inputMessages,
    otelTracer, otelApi, getStepCtx, setStepCtx, setResult) {

    // Disable SDK auto-telemetry for streaming: we build spans manually
    // (generation → model_step → model_chunk/tool_call) so the trace hierarchy
    // matches what the user expects rather than the SDK's internal span tree.
    const streamOptions = {
        ...sharedOptions,
        experimental_telemetry: { isEnabled: false }
    };

    const otelTrace = otelApi ? otelApi.trace : null;
    const otelCtx = otelApi ? otelApi.context : null;

    // Top-level "generation" span under the agent.
    // Holds the full input (system + initial messages) and final text output.
    const agentCtx = otelCtx ? otelCtx.active() : null;
    const generationSpan = (otelTracer && agentCtx) ? otelTracer.startSpan('generation', {
        attributes: {
            'gen_ai.operation.name': 'generation',
            'langfuse.observation.type': 'generation',
            'langfuse.observation.name': 'generation',
            'gen_ai.request.model': context.properties.model || '',
            'langfuse.observation.input': JSON.stringify({
                system: sharedOptions.system,
                messages: inputMessages
            })
        }
    }, agentCtx) : null;
    const generationCtx = (generationSpan && otelTrace && agentCtx)
        ? otelTrace.setSpan(agentCtx, generationSpan)
        : agentCtx;

    const result = streamText(streamOptions);

    let stepCount = 0;
    let currentStepSpan = null;
    let currentStepText = '';

    for await (const chunk of result.fullStream) {
        switch (chunk.type) {

        case 'step-start':
            stepCount++;
            currentStepText = '';
            if (otelTracer && generationCtx && otelTrace) {
                currentStepSpan = otelTracer.startSpan('model_step', {
                    attributes: {
                        'gen_ai.operation.name': 'model_step',
                        'langfuse.observation.type': 'span',
                        'langfuse.observation.name': `model_step_${stepCount}`,
                        'appmixer.step.index': stepCount
                    }
                }, generationCtx);
                setStepCtx(otelTrace.setSpan(generationCtx, currentStepSpan));
            }
            if (stepCount > 1) {
                await lib.publishChatProgressEvent(context, 'inference', `Crunching data (${stepCount})...`);
            }
            break;

        case 'text-delta':
            currentStepText += chunk.textDelta;
            await lib.publishChatDeltaEvent(context, null, chunk.textDelta);
            break;

        case 'tool-call': {
            // chunk.toolName carries the full internal name (componentId_toolname); strip the prefix.
            const decisionToolName = chunk.toolName.split('_').slice(1).join('_');
            // EVENT: records the model's DECISION to call a tool + args (instantaneous).
            // The tool EXECUTION span is created separately in executeToolByName.
            if (otelTracer && getStepCtx() && otelTrace) {
                const toolDecisionSpan = otelTracer.startSpan(
                    `tool_call: ${decisionToolName}`, {
                        attributes: {
                            'gen_ai.operation.name': 'tool_call',
                            'langfuse.observation.type': 'event',
                            'langfuse.observation.name': `tool_call: ${decisionToolName}`,
                            'langfuse.observation.input': JSON.stringify(chunk.args),
                            'appmixer.tool.call.id': chunk.toolCallId
                        }
                    }, getStepCtx()
                );
                toolDecisionSpan.end();
            }
            break;
        }

        case 'step-finish':
            if (otelTracer && currentStepSpan && getStepCtx()) {
                // SPAN: text output chunk for this step (if non-empty)
                if (currentStepText.trim() && otelTrace) {
                    const textChunkSpan = otelTracer.startSpan('text', {
                        attributes: {
                            'gen_ai.operation.name': 'text',
                            'langfuse.observation.type': 'span',
                            'langfuse.observation.name': 'text',
                            'langfuse.observation.output': currentStepText
                        }
                    }, getStepCtx());
                    textChunkSpan.end();
                }
                const reqBody = chunk.request?.body;
                let stepInput = null;
                if (reqBody) {
                    try { stepInput = JSON.parse(reqBody); } catch { stepInput = reqBody; }
                }
                const stepOutput = {
                    text: chunk.text,
                    ...(chunk.toolCalls?.length ? {
                        toolCalls: chunk.toolCalls.map(tc => ({ name: tc.toolName, args: tc.args }))
                    } : {})
                };
                currentStepSpan.setAttributes({
                    ...(stepInput ? { 'langfuse.observation.input': JSON.stringify(stepInput) } : {}),
                    'langfuse.observation.output': JSON.stringify(stepOutput),
                    'gen_ai.usage.input_tokens': chunk.usage?.promptTokens || 0,
                    'gen_ai.usage.output_tokens': chunk.usage?.completionTokens || 0,
                    'gen_ai.request.model': context.properties.model || ''
                });
                currentStepSpan.end();
            }
            currentStepSpan = null;
            setStepCtx(null);
            break;

        default:
            break;
        }
    }

    await lib.updateUsage(context, await result.usage);

    const finalText = await result.text;
    const responseMessages = (await result.response).messages;

    // Close generation span with final output and aggregated usage.
    if (generationSpan) {
        const genUsage = await context.stateGet('usage');
        generationSpan.setAttributes({
            'langfuse.observation.output': finalText || '',
            'gen_ai.usage.input_tokens': genUsage?.prompt_tokens || 0,
            'gen_ai.usage.output_tokens': genUsage?.completion_tokens || 0
        });
        generationSpan.end();
    }

    setResult({ text: finalText, messages: responseMessages });
}

// ─── Non-streaming execution ──────────────────────────────────────────────────

async function runGenerate(context, sharedOptions, setResult) {

    let stepCount = 0;

    const result = await generateText({
        ...sharedOptions,
        onStepFinish: async ({ toolCalls }) => {
            stepCount++;
            if (toolCalls && toolCalls.length > 1) {
                await lib.publishChatProgressEvent(context, 'tool-calls', `Called ${toolCalls.length} tools.`);
            }
            if (toolCalls && toolCalls.length > 0) {
                await lib.publishChatProgressEvent(context, 'inference', `Crunching data (${stepCount + 1})...`);
            }
        }
    });

    await lib.updateUsage(context, result.usage);

    setResult({ text: result.text, messages: result.response.messages });
}

// ─── OTEL agent span wrapper ──────────────────────────────────────────────────

/**
 * Wrap the entire agentic run inside a Langfuse AGENT span.
 * Stamps prompt as input, final answer as output, and aggregated usage for cost.
 */
async function runWithAgentSpan(context, otelTracer, otelApi, telemetryProvider, prompt, threadId,
    run, getFinalText, getUsage) {

    const { context: otelContext, trace, SpanStatusCode } = otelApi;

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

    await otelContext.with(
        trace.setSpan(otelContext.active(), agentSpan),
        async () => {
            try {
                await run();
                const usage = await getUsage();
                if (usage) {
                    const inputTokens = usage.prompt_tokens || 0;
                    const outputTokens = usage.completion_tokens || 0;
                    agentSpan.setAttributes({
                        'gen_ai.usage.input_tokens': inputTokens,
                        'gen_ai.usage.output_tokens': outputTokens,
                        'gen_ai.request.model': context.properties.model || '',
                        'langfuse.observation.usage_details': JSON.stringify({ input: inputTokens, output: outputTokens })
                    });
                }
                agentSpan.setAttributes({
                    'langfuse.observation.output': getFinalText() || '',
                    'output.value': getFinalText() || '',
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
        }
    );
}

module.exports = { agent };
