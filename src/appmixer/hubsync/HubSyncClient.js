"use strict";

/**
 * HubSync API client for making authenticated requests
 */
class HubSyncClient {
    /**
     * Create a new HubSync client instance
     * 
     * @param {Object} auth Authentication details (baseUrl, apiKey, tenant)
     * @param {Object} context The component context for making HTTP requests
     */
    constructor(auth, context) {
        this.baseUrl = auth.baseUrl;
        this.apiKey = auth.apiKey;
        this.tenant = auth.tenant;
        this.context = context;
    }

    /**
     * Get common headers for all requests
     * 
     * @returns {Object} Headers object
     */
    getHeaders() {
        return {
            "X-Api-Key": this.apiKey,
            "X-Tenant": this.tenant,
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
    }

    /**
     * Make an API request to HubSync
     * 
     * @param {string} method HTTP method
     * @param {string} endpoint API endpoint (without base URL)
     * @param {Object} data Optional request data
     * @param {string} errorMessage Custom error message
     * @returns {Promise<Object>} Response data
     */
    async request(method, endpoint, data = null, errorMessage = "API request failed") {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await this.context.httpRequest({
                method,
                url,
                headers: this.getHeaders(),
                data: data || undefined
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`${errorMessage}: ${error.message}`);
        }
    }

    /**
     * Get workspaces
     * 
     * @returns {Promise<Array>} List of workspaces
     */
    async getWorkspaces() {
        const response = await this.request(
            "POST", 
            "/api/common/workspaces/fetch", 
            {}, 
            "Failed to fetch workspaces"
        );
        return response.items;
    }

    /**
     * Get databases for a workspace
     * 
     * @param {string} workspaceId Workspace ID
     * @returns {Promise<Array>} List of databases
     */
    async getDatabases(workspaceId) {
        const response = await this.request(
            "GET", 
            `/api/datagrid/workspaces/${workspaceId}/databases`, 
            null, 
            "Failed to fetch databases"
        );
        return response.items;
    }

    /**
     * Get sheets for a database
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @returns {Promise<Array>} List of sheets
     */
    async getSheets(workspaceId, databaseId) {
        return this.request(
            "GET", 
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets`, 
            null, 
            "Failed to fetch sheets"
        );
    }

    /**
     * Get views for a sheet
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @returns {Promise<Array>} List of views
     */
    async getViews(workspaceId, databaseId, sheetId) {
        return this.request(
            "GET", 
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/views`, 
            null, 
            "Failed to fetch views"
        );
    }

    /**
     * Get sheet details including columns
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @returns {Promise<Object>} Sheet details
     */
    async getSheet(workspaceId, databaseId, sheetId) {
        return this.request(
            "GET", 
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}`, 
            null, 
            "Failed to fetch sheet"
        );
    }

    /**
     * Create a new item
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @param {string} viewId View ID
     * @param {Object} fields Fields to set
     * @returns {Promise<Object>} Created item
     */
    async createItem(workspaceId, databaseId, sheetId, viewId, fields) {
        return this.request(
            "POST",
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items`,
            { viewId, fields },
            "Failed to create new item"
        );
    }

    /**
     * Update an existing item
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @param {string} itemId Item ID
     * @param {Object} fields Fields to update
     * @returns {Promise<Object>} Updated item
     */
    async updateItem(workspaceId, databaseId, sheetId, itemId, fields) {
        return this.request(
            "PUT",
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`,
            { fields },
            "Failed to update item"
        );
    }

    /**
     * Get an item by ID
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @param {string} itemId Item ID
     * @returns {Promise<Object>} Item details
     */
    async getItem(workspaceId, databaseId, sheetId, itemId) {
        return this.request(
            "GET",
            `/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`,
            null,
            "Failed to get item"
        );
    }

    /**
     * Delete an item
     * 
     * @param {string} workspaceId Workspace ID
     * @param {string} databaseId Database ID
     * @param {string} sheetId Sheet ID
     * @param {string} itemId Item ID
     * @returns {Promise<Object>} Response data
     */
    async deleteItem(workspaceId, databaseId, sheetId, itemId) {
        const url = `${this.baseUrl}/api/datagrid/workspaces/${workspaceId}/databases/${databaseId}/sheets/${sheetId}/items/${itemId}`;
        
        try {
            // Use custom headers without Accept and Content-Type for DELETE requests
            const headers = {
                "X-Api-Key": this.apiKey,
                "X-Tenant": this.tenant
            };
            
            const response = await this.context.httpRequest({
                method: "DELETE",
                url,
                headers,
                data: undefined
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`Failed to delete item: ${error.message}`);
        }
    }
}

module.exports = HubSyncClient;