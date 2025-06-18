# HubSync

## Overview

HubSync is a service designed to enhance the client-firm experience by streamlining daily tasks and centralizing client access. It eliminates the need for multiple portals, logins, and systems, allowing users to focus on their work without unnecessary distractions.

## Authentication

- Type: ApiKey
- Credentials: base url, tenant name, api key

## Components

### Fetch Workspaces

Retreives a list of workspaces available in HubSync for particular user. 

### Fetch Databases

Retrieves a list of databases available in HubSync for particular user.

Inputs: 
- workspaceId: The ID of the workspace to fetch databases from.

### Fetch Sheets

Retrieves a list of sheets available in a specific database within HubSync.

Inputs:
 - workspaceId: The ID of the workspace containing the database.
 - databaseId: The ID of the database to fetch sheets from.

### Get Sheet (one)

Retrieves a specific sheet from a database in HubSync.

Inputs: 
- workspaceId: The ID of the workspace containing the database.
- databaseId: The ID of the database containing the sheet.
- sheetId: The ID of the sheet to fetch.

### Fetch Status Choices

Retrieves a list of status choices as objects as the Create New Item status field requires an object with a specific structure.

We will call Get Sheet (one) to get the sheet object which contains the choices for the status field.

### Fetch Views
Retrieves a list of views available in a specific sheet within HubSync.

Inputs:
- workspaceId: The ID of the workspace containing the database.
- databaseId: The ID of the database containing the sheet.
- sheetId: The ID of the sheet to fetch views from.
- model - Possible values: [WORKSPACE, SHEET, DATABASE, TRAVEL_SUMMARY, SURVEY_DASHBOARD, TIME_SURVEY]

### Create New Item

Creates a new item in a specified sheet within HubSync.

Inputs: 
- workspaceId: The ID of the workspace containing the database.
- databaseId: The ID of the database containing the sheet.
- sheetId: The ID of the sheet where the new item will be created.
- viewId: The ID of the view where the item will be created.
- fields: The fields of the new item to be created.

### Get Item

Retrieves a specific item from a specified sheet within HubSync.

TBD

### Update Item

Updates an existing item in a specified sheet within HubSync.

- workspaceId: The ID of the workspace containing the database.
- databaseId: The ID of the database containing the sheet.
- sheetId: The ID of the sheet where the item will be updated.
- itemId: The ID of the item to be updated.

## TESTS

### Create New Item

```
appmixer t c appmixer/hubsync/grid/CreateNewItem -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af", "viewId": 1}' -i '{"in": {"fields":"{\n        \"1\": \"TST-4\",\n        \"2\": \"2025-06-13\",\n        \"5\": \"some summary\",\n        \"6\": {\n            \"rich\": \"<p>test <strong>rich</strong> text.</p>\",\n            \"plain\": \"test  rich  text.\"\n        },\n        \"7\": {\n            \"key\": \"e2232a4f-7248-4eef-ba9c-364cc5b05a69\",\n            \"color\": \"#e6b3b3\",\n            \"value\": \"NEW\"\n        },\n        \"8\": \"TST-1\",\n        \"9\": \"2025-06-13\",\n        \"11\": \"v2\"\n    }"}}'
```

### Get Sheet Column choices

```
appmixer t c appmixer/hubsync/grid/GetSheetColumnChoices -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af", "columnId": 7}'
```

### Get Sheet Column

```
appmixer t c appmixer/hubsync/grid/GetSheetColumns -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}'
```

### Get Item by ID

```
appmixer t c appmixer/hubsync/grid/GetItemById -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemId": "34"}}'
```

### Delete Item by ID

```
appmixer t c appmixer/hubsync/grid/DeleteItem -p '{"workspaceId": "01722df1-cdbb-4deb-936f-10592ac1aa81", "databaseId": "4dd702fd-e2ba-4c63-a13e-58e0722fc941", "sheetId": "f34c9390-0121-48e0-b57c-fcd624d004af"}' -i '{"in": {"itemId": "34"}}'
```