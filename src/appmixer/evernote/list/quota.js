'use strict';

module.exports = {

    rules: [
        {
            name: 'note/getNote',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'note/getNote'
        },
        {
            name: 'note/findNotes',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'note/findNotes'
        },
        {
            name: 'note/findNotesMetadata',
            limit: 1,
            window: 15 * 60 * 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'note/findNotesMetadata'
        },
        {
            name: 'note/createNote',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'note/createNote'
        },
        {
            name: 'tag/listTags',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'tag/listTags'
        },
        {
            name: 'tag/listNotebooks',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'tag/listNotebooks'
        },
        {
            name: 'notebook/createNotebook',
            limit: 1,
            window: 1000,
            throttling: 'window-sliding',
            queueing: 'fifo',
            scope: 'userId',
            resource: 'notebook/createNotebook'
        }
    ]
};
