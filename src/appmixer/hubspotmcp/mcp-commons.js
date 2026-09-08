'use strict';

/**
 * MCP (Model Context Protocol) client for Streamable HTTP transport.
 * Handles communication with remote MCP servers like HubSpot's MCP server.
 *
 * This module is designed to be duplicated per MCP vendor connector,
 * as Appmixer's sandboxing prevents cross-connector imports.
 */

const MCP_SERVER_URL = 'https://mcp.hubspot.com';
const JSONRPC_VERSION = '2.0';

class McpClient {

    constructor(accessToken, serverUrl) {
        this.serverUrl = serverUrl || MCP_SERVER_URL;
        this.accessToken = accessToken;
        this.sessionId = null;
    }

    /**
     * Send a JSON-RPC request to the MCP server via Streamable HTTP transport.
     * @param {string} method - JSON-RPC method name
     * @param {object} [params] - Method parameters
     * @param {function} httpRequest - context.httpRequest or equivalent
     * @returns {object} JSON-RPC result
     */
    async request(method, params, httpRequest) {

        const body = {
            jsonrpc: JSONRPC_VERSION,
            id: Date.now(),
            method,
            params: params || {}
        };

        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
            'Authorization': `Bearer ${this.accessToken}`
        };

        if (this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        const response = await httpRequest({
            method: 'POST',
            url: this.serverUrl,
            headers,
            data: body
        });

        // Capture session ID from response headers if present
        const newSessionId = response.headers?.['mcp-session-id'];
        if (newSessionId) {
            this.sessionId = newSessionId;
        }

        // Handle JSON-RPC response
        const data = response.data;

        if (data.error) {
            const err = new Error(data.error.message || 'MCP server error');
            err.code = data.error.code;
            err.data = data.error.data;
            throw err;
        }

        return data.result;
    }

    /**
     * Initialize the MCP session.
     * @param {function} httpRequest
     * @returns {object} Server capabilities
     */
    async initialize(httpRequest) {

        return this.request('initialize', {
            protocolVersion: '2025-06-18',
            capabilities: {},
            clientInfo: {
                name: 'Appmixer',
                version: '1.0.0'
            }
        }, httpRequest);
    }

    /**
     * List available tools from the MCP server.
     * @param {function} httpRequest
     * @param {string} [cursor] - Pagination cursor
     * @returns {object} { tools: Array, nextCursor?: string }
     */
    async listTools(httpRequest, cursor) {

        const params = {};
        if (cursor) {
            params.cursor = cursor;
        }
        return this.request('tools/list', params, httpRequest);
    }

    /**
     * List all tools, handling pagination.
     * @param {function} httpRequest
     * @returns {Array} All available tools
     */
    async listAllTools(httpRequest) {

        let allTools = [];
        let cursor = undefined;

        do {
            const result = await this.listTools(httpRequest, cursor);
            allTools = allTools.concat(result.tools || []);
            cursor = result.nextCursor;
        } while (cursor);

        return allTools;
    }

    /**
     * Call a tool on the MCP server.
     * @param {string} name - Tool name
     * @param {object} args - Tool arguments
     * @param {function} httpRequest
     * @returns {object} Tool result
     */
    async callTool(name, args, httpRequest) {

        return this.request('tools/call', { name, arguments: args }, httpRequest);
    }
}

/**
 * Create an McpClient from Appmixer context.
 * @param {object} context - Appmixer component context
 * @returns {McpClient}
 */
function createClient(context) {

    return new McpClient(context.auth.accessToken);
}

/**
 * Transform MCP tools list to Appmixer select array.
 * Used as a source transform for tool selection dropdowns.
 * @param {Array} tools - Array of MCP tool objects
 * @returns {Array} Appmixer select options
 */
function toolsToSelectArray(tools) {

    if (!Array.isArray(tools)) return [];

    return tools.map(tool => ({
        label: tool.name + (tool.description ? ` — ${tool.description}` : ''),
        value: tool.name
    }));
}

/**
 * Transform a single MCP tool's inputSchema (JSON Schema) into an Appmixer inspector.
 * This is the core of dynamic UI generation for MCP tools.
 *
 * @param {Array} tools - All tools from ListTools
 * @param {object} message - Contains in/toolName
 * @returns {object} Appmixer inspector { schema, inputs }
 */
function toolInputToInspector(tools, message) {

    const toolName = message['in/toolName'];
    if (!toolName || !Array.isArray(tools)) {
        return { schema: { properties: {} }, inputs: {} };
    }

    const tool = tools.find(t => t.name === toolName);
    if (!tool || !tool.inputSchema) {
        return { schema: { properties: {} }, inputs: {} };
    }

    const inputSchema = tool.inputSchema;
    const properties = inputSchema.properties || {};
    const required = inputSchema.required || [];

    const inspector = {
        schema: {
            type: 'object',
            properties: {},
            required: []
        },
        inputs: {}
    };

    let index = 1;
    for (const [key, schema] of Object.entries(properties)) {
        // Map JSON Schema type to Appmixer input type
        inspector.inputs[key] = {
            type: mapSchemaToInputType(schema),
            label: schema.title || formatLabel(key),
            index: index++,
            tooltip: schema.description || ''
        };

        // Set default value if present
        if (schema.default !== undefined) {
            inspector.inputs[key].defaultValue = schema.default;
        }

        // Handle enums as select
        if (schema.enum) {
            inspector.inputs[key].type = 'select';
            inspector.inputs[key].options = schema.enum.map(v => ({
                content: String(v),
                value: v
            }));
        }

        // Schema property
        inspector.schema.properties[key] = {
            type: mapSchemaToJsonType(schema)
        };

        // Required fields
        if (required.includes(key)) {
            inspector.schema.required.push(key);
        }
    }

    return inspector;
}

/**
 * Map JSON Schema type to Appmixer input widget type.
 */
function mapSchemaToInputType(schema) {

    if (schema.enum) return 'select';

    switch (schema.type) {
        case 'boolean':
            return 'toggle';
        case 'integer':
        case 'number':
            return 'number';
        case 'array':
            return 'textarea';
        case 'object':
            return 'textarea';
        case 'string':
        default:
            return 'text';
    }
}

/**
 * Map JSON Schema type to JSON Schema type string for Appmixer schema validation.
 */
function mapSchemaToJsonType(schema) {

    switch (schema.type) {
        case 'boolean':
            return 'boolean';
        case 'integer':
        case 'number':
            return 'number';
        case 'array':
            return 'string'; // JSON string representation
        case 'object':
            return 'string'; // JSON string representation
        case 'string':
        default:
            return 'string';
    }
}

/**
 * Format a camelCase or snake_case key into a human-readable label.
 */
function formatLabel(key) {

    return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/^\w/, c => c.toUpperCase())
        .trim();
}

/**
 * Parse tool result content into a flat output object.
 * MCP tool results have a content array with type/text entries.
 * @param {object} result - MCP tool/call result
 * @returns {object} Parsed result
 */
function parseToolResult(result) {

    if (!result || !result.content) {
        return { raw: result };
    }

    const textContent = result.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');

    // Try to parse as JSON
    let parsed = null;
    try {
        parsed = JSON.parse(textContent);
    } catch (e) {
        // Not JSON, keep as text
    }

    return {
        text: textContent,
        json: parsed,
        isError: result.isError || false,
        raw: result
    };
}

module.exports = {
    McpClient,
    createClient,
    toolsToSelectArray,
    toolInputToInspector,
    parseToolResult,
    formatLabel,
    MCP_SERVER_URL
};
