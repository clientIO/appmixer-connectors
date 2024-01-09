module.exports = {
    listBoards: `
    query listBoards ($page: Int, $limit: Int) {
        boards(
        state: all,
        order_by: created_at,
        page: $page,
        limit: $limit
        ) {
            board_folder_id
            board_kind
            id
            name
            description
            items_count
            permissions
            state
            type
            updated_at
            workspace_id
        }
    }
    `,
    listWorkspaces: `
    query listWorkspaces ($page: Int, $limit: Int) {
        workspaces(page: $page, limit: $limit) {
            id
            name
            kind
            description
            created_at
        }
    }
    `,
    listColumns: `
    query listColumns ($boardId: ID!) {
        boards (ids: [$boardId]) {
            columns {
                archived
                id
                settings_str
                title
                description
                type
                width
                }
            }
        }`,
    findItems : `
    query items_page_by_column_values (
        $limit: Int,
        $boardId: ID!,
        $columnId: String!,
        $columns: ItemsPageByColumnValuesQuery!
    ) {
        items_page_by_column_values (
            limit: $limit,
            board_id: $boardId,
            columns: [$columns]
        ) {
            cursor
            items {
                    id
                    name
                    parent_item {
                        id
                    }
                    created_at
                    updated_at
                    creator_id
                    group {
                        id
                        title
                    }
                    state
                    subscribers {
                        id
                    }
                    updates(limit: 10) {
                        id
                        body
                    }
                    assets(column_ids : [$columnId]) {
                        id
                        url
                        name
                    }
                    column_values(ids : [$columnId]) {
                        id
                        text
                        type
                        value
                    }
                }
            }
    }
    `,
    nextItems: `
    query next_items_page (
        $cursor: String!,
        $limit: Int,
        $columnId: String!
    ) {
       next_items_page (
           cursor: $cursor,
           limit: $limit
       ) {
           cursor
           items {
               id
               name
               parent_item {
                   id
               }
               created_at
               updated_at
               creator_id
               group {
                   id
                   title
               }
               state
               subscribers {
                   id
               }
               updates(limit: 10) {
                   id
                   body
               }
               assets(column_ids : [$columnId]) {
                   id
                   url
                   name
               }
               column_values(ids : [$columnId]) {
                   id
                   text
                   type
                   value
               }
           }
       }

    }
    `,
    listTeams: `
    query {
        teams {
            id
            name
            picture_url
        }
    }`,
    listGroups: `
    query listGroups ($boardId: ID!) {
        boards (ids: [$boardId]) {
            groups {
            id
            title
            color
            archived
            deleted
            position
            }
        }
    }`,
    CreateItem : `
    mutation create_item (
        $boardId: ID!,
        $groupId: String,
        $itemName: String!,
        $createLabelsIfMissing: Boolean
        $columnValues: JSON,
    ) {
        create_item (
            board_id: $boardId,
            group_id: $groupId,
            item_name: $itemName,
            column_values: $columnValues,
            create_labels_if_missing: $createLabelsIfMissing
        ) {
            id
        }
    }
    `,
    DeleteItem : `
    mutation delete_item (
        $itemId: ID!
    ) {
        delete_item (
            item_id: $itemId
        ) {
            id
        }
    }
    `,
    CreateBoard : `
    mutation create_board (
        $workspaceId: ID
        $boardName: String!
        $boardKind: BoardKind!
    ) {
        create_board (
            workspace_id: $workspaceId
            board_name: $boardName,
            board_kind: $boardKind
        ) {
            id
        }
    }
    `,
    DeleteBoard : `
    mutation delete_board (
        $boardId: ID!
    ) {
        delete_board (
            board_id: $boardId
        ) {
            id
        }
    }
    `,
    ArchiveBoard : `
    mutation archive_board (
        $boardId: ID!
    ) {
        archive_board (
            board_id: $boardId
        ) {
            id
        }
    }
    `,
    RegisterAWebhook : `
    mutation create_webhook (
        $boardId: ID!
        $webhookUrl: String!
        $event: WebhookEventType!
        $config: JSON
    ) {
        create_webhook (board_id: $boardId, url: $webhookUrl, event: $event, config: $config ) {
            id
            board_id
        }
    }
    `,
    UnregisterAWebhook : `
    mutation delete_webhook (
        $id: ID!
    ) {
        delete_webhook (id: $id) {
            id
            board_id
        }
    }
    `,
    getUser: `
    query getUser($id: ID!) {
      users (ids: [$id]) {
        id
        name
        account {
          id
        }
        birthday
        country_code
        created_at
        join_date
        email
        is_admin
        is_guest
        is_pending
        is_view_only
        is_verified
        location
        mobile_phone
        phone
        photo_original
        photo_small
        photo_thumb
        photo_thumb_small
        photo_tiny
        teams {
          id
        }
        time_zone_identifier
        title
        url
        utc_hours_diff
        current_language
      }
    }`,
    getItem: `
    query getItem ($id: ID!) {
        items (ids: [$id]) {
        id
        name
        board {
            id
        }
        group {
            id
            title
        }
        state
        subscribers {
            id
        }
        updates{
            id
        }
        assets{
            id
        }
        created_at
        creator_id
        updated_at
        parent_item {
            id
        }
        column_values {
            id
            value
            title
            type
            additional_info
            text
        }
        email
        }
    }`
};
