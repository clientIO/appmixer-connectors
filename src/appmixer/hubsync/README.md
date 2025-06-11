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

### Fetch Views
Retrieves a list of views available in a specific sheet within HubSync.

Inputs:
- workspaceId: The ID of the workspace containing the database.
- databaseId: The ID of the database containing the sheet.
- sheetId: The ID of the sheet to fetch views from.
- model - Possible values: [WORKSPACE, SHEET, DATABASE, TRAVEL_SUMMARY, SURVEY_DASHBOARD, TIME_SURVEY]

### Create New Item

TBD

### Update Item

TBD