// Shared TypeScript types for the Beehiiv connector.
// Compatible with Node 24 --experimental-strip-types (no transpile step required).

// --------------------------------------------------------------------------
// Appmixer context
// --------------------------------------------------------------------------

export interface AppmixerAuth {
    apiKey: string;
}

export interface SavedFile {
    fileId: string;
}

export interface FlowDescriptor {
    [componentId: string]: {
        label?: string;
        [key: string]: unknown;
    };
}

export interface AppmixerConfig {
    outputFilePrefix?: string;
    [key: string]: unknown;
}

export interface AppmixerMessage<T = Record<string, unknown>> {
    content: T;
}

export interface AppmixerMessages {
    in: AppmixerMessage;
    webhook?: AppmixerMessage;
    [portName: string]: AppmixerMessage | undefined;
}

export interface HttpRequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url: string;
    headers?: Record<string, string>;
    params?: Record<string, unknown>;
    data?: Record<string, unknown>;
}

export interface HttpResponse<T = unknown> {
    data: T;
    status: number;
    headers: Record<string, string>;
}

export interface AppmixerContext {
    auth: AppmixerAuth;
    messages: AppmixerMessages;
    properties: Record<string, unknown>;
    componentId: string;
    flowDescriptor: FlowDescriptor;
    config: AppmixerConfig;
    httpRequest<T = unknown>(options: HttpRequestOptions): Promise<HttpResponse<T>>;
    sendJson(data: unknown, portName: string): Promise<void>;
    saveFileStream(fileName: string, buffer: Buffer): Promise<SavedFile>;
    log(data: Record<string, unknown>): Promise<void>;
    CancelError: new (message: string) => Error;
    // Webhook/trigger methods
    getWebhookUrl(): string;
    saveState(state: Record<string, unknown>): Promise<void>;
    state: Record<string, unknown>;
    response(): Promise<void>;
}

// --------------------------------------------------------------------------
// Beehiiv API response types
// --------------------------------------------------------------------------

export interface BeehiivPublication {
    id: string;
    name: string;
    description?: string;
    organization_name?: string;
    referral_program_enabled?: boolean;
    created?: number;
}

export interface BeehiivSubscription {
    id: string;
    email: string;
    status?: string;
    tier?: string;
    created?: number;
    [key: string]: unknown;
}

export interface BeehiivPost {
    id: string;
    title?: string;
    subtitle?: string;
    status?: string;
    audience?: string;
    platform?: string;
    created?: number;
    [key: string]: unknown;
}

export interface BeehiivApiListResponse<T> {
    data: T[];
    total_results?: number;
    page?: number;
    limit?: number;
    [key: string]: unknown;
}

export interface BeehiivApiItemResponse<T> {
    data: T;
    [key: string]: unknown;
}

// --------------------------------------------------------------------------
// API operation type
// --------------------------------------------------------------------------

export interface ApiOperation<TParams = Record<string, unknown>, TResult = unknown> {
    method: string;
    path: string;
    docsUrl: string;
    execute(context: AppmixerContext, params: TParams): Promise<TResult>;
}

// --------------------------------------------------------------------------
// lib.js helper types
// --------------------------------------------------------------------------

export type OutputType = 'first' | 'object' | 'array' | 'file';

export interface SendArrayOutputOptions {
    context: AppmixerContext;
    outputPortName?: string;
    outputType?: OutputType;
    records?: Record<string, unknown>[];
}

export interface ItemSchemaField {
    type?: string;
    title?: string;
    [key: string]: unknown;
}

export interface ItemSchema {
    [field: string]: ItemSchemaField;
}

export interface OutputPortOption {
    label: string;
    value: string;
    schema?: Record<string, unknown>;
}
