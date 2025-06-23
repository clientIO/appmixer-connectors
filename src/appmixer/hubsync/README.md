# HubSync

## Overview

HubSync is a comprehensive workspace collaboration platform designed to enhance the client-firm experience by streamlining daily tasks and centralizing client access. It eliminates the need for multiple portals, logins, and systems, allowing users to focus on their work without unnecessary distractions. The platform provides a unified interface for managing databases, sheets, and data across your organization.

Key features include:
- Centralized workspace management
- Database and sheet organization
- Customizable views for different user needs
- Structured data with support for various field types (text, dates, rich text, status choices, etc.)
- External ID support for integration with other systems

## Authentication

- **Type**: ApiKey
- **Credentials**:
  - **Base URL**: The base URL for the API requests (e.g., `https://api.hubsync.com` or your custom domain)
  - **Tenant ID**: The ID of your organization/tenant to authenticate against (sent as `X-Tenant` header)
  - **API Key**: Your personal or system API key for authenticating requests (sent as `X-Api-Key` header)

To obtain these credentials:
1. Contact your HubSync administrator or account manager
2. Request API access for your account
3. Store the credentials securely as they provide full access to your data

## Connector Structure

The connector follows a hierarchical structure matching HubSync's organization:

1. **Workspaces** - Top-level containers for organizing work
2. **Databases** - Collections of related sheets within a workspace
3. **Sheets** - Individual data tables with columns and items
4. **Views** - Different ways to visualize and interact with sheet data
5. **Items** - Individual records/rows within a sheet

## Components

### Common Components

#### Fetch Workspaces

Retrieves a list of all workspaces available to the authenticated user.

**Outputs**:
- **workspaces**: Array of workspace objects with the following properties:
  - `id`: Unique identifier for the workspace
  - `title`: Display name of the workspace
  - `description`: Optional description of the workspace's purpose

### Grid Components

#### Fetch Databases

Retrieves a list of databases available in a specific workspace.

**Inputs**: 
- **workspaceId**: The ID of the workspace to fetch databases from

**Outputs**:
- **databases**: Array of database objects with the following properties:
  - `id`: Unique identifier for the database
  - `title`: Display name of the database
  - `description`: Optional description of the database's purpose

#### Fetch Sheets

Retrieves a list of sheets available in a specific database.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database to fetch sheets from

**Outputs**:
- **sheets**: Array of sheet objects with properties like id, title, and description

#### Get Sheet

Retrieves detailed information about a specific sheet, including its columns, views, and metadata.

**Inputs**: 
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet to fetch

**Outputs**:
- **sheet**: Complete sheet object with detailed properties including:
  - `id`: Unique identifier for the sheet
  - `title`: Display name of the sheet
  - `description`: Optional description of the sheet's purpose
  - `columns`: Array of column definitions (see Get Sheet Columns)
  - `views`: Array of view definitions (see Fetch Views)

#### Get Sheet Columns

Retrieves the column definitions for a specific sheet.

**Inputs**: 
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet to fetch columns from

**Outputs**:
- **columns**: Array of column objects with the following properties:
  - `id`: Unique identifier for the column (used when creating/updating items)
  - `title`: Display name of the column
  - `type`: Data type of the column (text, number, date, choice, etc.)
  - `required`: Boolean indicating if the column requires a value
  - Additional type-specific properties

#### Get Sheet Column Choices

Retrieves the available options for a choice/status column type.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet containing the column
- **columnId**: The ID of the choice/status column to fetch options from

**Outputs**:
- **choices**: Array of choice objects with the following properties:
  - `key`: Unique identifier for the choice option
  - `value`: Display text for the choice option
  - `color`: Color code associated with the choice (for visual distinction)

#### Fetch Views

Retrieves the available views for a specific sheet.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet to fetch views from

**Outputs**:
- **views**: Array of view objects with the following properties:
  - `id`: Unique identifier for the view
  - `title`: Display name of the view
  - `type`: View type (grid, kanban, calendar, etc.)

#### Create New Item

Creates a new record/row in a specified sheet.

**Inputs**: 
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet where the new item will be created
- **viewId**: The ID of the view where the item will be created
- **fields**: JSON string containing the column values for the new item (see Field Formats section)
- **externalId**: (Optional) External reference ID to link this item with external systems

**Outputs**:
- **newItem**: The created item object with all properties including system-generated values

#### Get Item By ID

Retrieves a specific item from a sheet using either its internal ID or global ID.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet containing the item
- **itemId** or **itemGlobalId**: The internal ID or global ID of the item to retrieve

**Outputs**:
- **item**: The complete item object with all field values

#### Update Item

Updates field values for an existing item in a sheet.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet containing the item
- **itemId**: The ID of the item to update
- **fields**: JSON string containing only the fields to update (see Field Formats section)

**Outputs**:
- **updatedItem**: The updated item object with all properties reflecting the changes

#### Delete Item

Permanently removes an item from a sheet.

**Inputs**:
- **workspaceId**: The ID of the workspace containing the database
- **databaseId**: The ID of the database containing the sheet
- **sheetId**: The ID of the sheet containing the item
- **itemId**: The ID of the item to delete

**Outputs**:
- **result**: Success status with confirmation message

## Field Formats

When creating or updating items, you need to provide field values in specific formats depending on the column type. The `fields` parameter is a JSON string containing an object where keys are column IDs and values are formatted according to the column type.

### Text and Number Columns
For simple text and number columns, use string or number values directly:
```json
{
  "1": "Sample text value",
  "2": 42
}
```

### Status/Choice Column
For status or choice columns, you must provide the complete choice object:
```json
{
  "key": "e2232a4f-7248-4eef-ba9c-364cc5b05a69",
  "color": "#e6b3b3",
  "value": "NEW"
}
```
You can obtain valid choices using the Get Sheet Column Choices component.

### Rich Text Column
For rich text columns, provide both the HTML-formatted content and plain text:
```json
{
  "rich": "<p>test <strong>rich</strong> text.</p>",
  "plain": "test rich text."
}
```

### Date Column
For date columns, use the ISO format "YYYY-MM-DD":
```
"2025-06-13"
```

### DateTime Column
For datetime columns, use ISO 8601 format:
```
"2025-06-13T14:30:00Z"
```

### Example Fields Object
```json
{
  "1": "TST-4",
  "2": "2025-06-13",
  "3": 42,
  "4": {
    "rich": "<p>Detailed <strong>description</strong> here.</p>",
    "plain": "Detailed description here."
  },
  "5": {
    "key": "e2232a4f-7248-4eef-ba9c-364cc5b05a69",
    "color": "#e6b3b3",
    "value": "NEW"
  }
}
```

## Integration Workflow

A typical integration workflow follows these steps:

1. **Setup**: Configure authentication with your HubSync credentials
2. **Discover Resources**:
   - Use Fetch Workspaces to identify available workspaces
   - Use Fetch Databases to find databases within your workspace
   - Use Fetch Sheets to locate the specific sheets you need
   - Use Get Sheet to examine the sheet structure

3. **Work with Data**:
   - Create items with CreateNewItem
   - Retrieve items with GetItemById
   - Update items with UpdateItem
   - Remove items with DeleteItem

4. **Advanced Integration**:
   - Use externalId for two-way synchronization with other systems
   - Combine multiple components in workflows to automate processes

## Error Handling

The connector implements comprehensive error handling:

- Invalid authentication results in 401 errors
- Missing required fields trigger validation errors
- Network issues are captured and reported clearly
- API-level errors include detailed messages from the HubSync service

## Testing

Below are command-line examples for testing each component. Replace the IDs with actual values from your HubSync instance.

### Common Components

#### Fetch Workspaces

```
appmixer t c appmixer/hubsync/common/FetchWorkspaces
```

### Grid Components

#### Fetch Databases

```
appmixer t c appmixer/hubsync/grid/FetchDatabases -i '{"in": {"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81"}}'
```

#### Fetch Sheets

```
appmixer t c appmixer/hubsync/grid/FetchSheets -i '{"in": {"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941"}}'
```

#### Get Sheet

```
appmixer t c appmixer/hubsync/grid/GetSheet -i '{"in": {"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}}'
```

#### Get Sheet Columns

```
appmixer t c appmixer/hubsync/grid/GetSheetColumns -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}'
```

#### Get Sheet Column Choices

```
appmixer t c appmixer/hubsync/grid/GetSheetColumnChoices -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af", "columnId": "7"}'
```

#### Fetch Views

```
appmixer t c appmixer/hubsync/grid/FetchViews -i '{"in": {"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}}'
```

#### Create New Item

```
appmixer t c appmixer/hubsync/grid/CreateNewItem -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af", "viewId": "1"}' -i '{"in": {"fields":"{\n        \"1\": \"TST-4\",\n        \"2\": \"2025-06-13\",\n        \"5\": \"some summary\",\n        \"6\": {\n            \"rich\": \"<p>test <strong>rich</strong> text.</p>\",\n            \"plain\": \"test  rich  text.\"\n        },\n        \"7\": {\n            \"key\": \"e2232a4f-7248-4eef-ba9c-364cc5b05a69\",\n            \"color\": \"#e6b3b3\",\n            \"value\": \"NEW\"\n        },\n        \"8\": \"TST-1\",\n        \"9\": \"2025-06-13\",\n        \"11\": \"v2\"\n    }"}}'
```

#### Get Item By ID

```
appmixer t c appmixer/hubsync/grid/GetItemById -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemId": "34"}}'
```

#### Get Item By Global ID

```
appmixer t c appmixer/hubsync/grid/GetItemById -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemGlobalId": "external-id-123"}}'
```

#### Update Item

```
appmixer t c appmixer/hubsync/grid/UpdateItem -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemId": "34", "fields":"{\n        \"5\": \"updated summary\",\n        \"7\": {\n            \"key\": \"e2232a4f-7248-4eef-ba9c-364cc5b05a69\",\n            \"color\": \"#e6b3b3\",\n            \"value\": \"IN_PROGRESS\"\n        }\n    }"}}'
```

#### Delete Item

```
appmixer t c appmixer/hubsync/grid/DeleteItem -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemId": "34"}}'
```

## Rate Limits and Performance Considerations

HubSync API has the following limitations to be aware of when implementing integrations:
- Maximum request rate: 120 requests per minute per API key
- Maximum payload size: 10MB
- Maximum items per request: 1000

For optimal performance:
- Batch operations when possible
- Cache frequently accessed resources like workspace and database lists
- Use specific queries rather than retrieving all data and filtering client-side

## Example Integration: JIRA to HubSync Synchronization

Below is an example flow that demonstrates how to synchronize JIRA issues with HubSync items:

![JIRA to HubSync Flow](flow%20jira-hs.png)

### Flow Description

This integration enables one-way synchronization between JIRA issues and HubSync items. The flow contains three main pathways:

1. **New Issue Creation** (Top Row):
   - Triggered by a "New Issue Webhook" from JIRA
   - Fetches column choices for Status, Issue Type, Priority, and Component fields from HubSync
   - Maps JIRA issue data to the appropriate HubSync field formats
   - Creates a new item in HubSync with the mapped data

2. **Issue Update** (Middle Row):
   - Triggered by an "Updated Issue Webhook" from JIRA
   - Retrieves the corresponding HubSync item using its ID
   - Fetches current column choices for all relevant fields
   - Maps updated JIRA issue data to HubSync field formats
   - Updates the existing item in HubSync

3. **Issue Deletion** (Bottom Row):
   - Triggered by a "Deleted Issue Webhook" from JIRA
   - Retrieves the corresponding HubSync item using its ID
   - Deletes the item from HubSync

This workflow ensures that changes made in JIRA are automatically reflected in HubSync, keeping both systems in sync. Similar flows could be built to synchronize in the opposite direction (from HubSync to JIRA) or to integrate with other systems.

### Benefits of This Integration

- **Real-time Synchronization**: Changes in JIRA immediately appear in HubSync
- **Consistent Data**: Ensures both systems contain the same information
- **Simplified Reporting**: Use HubSync's flexible views while maintaining JIRA workflows
- **Centralized Access**: Provide stakeholders access to issue data without requiring JIRA accounts