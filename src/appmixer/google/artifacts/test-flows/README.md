# Google connector — E2E test flows

Connector-level E2E flows. Today they cover the **drive** module end to end
(every non-private `appmixer.google.drive.*` component appears in at least one
flow); the other modules keep their own flows under
`src/appmixer/google/<module>/artifacts/test-flows/`.

| Flow | Covers |
|------|--------|
| `test-flow-drive-file-lifecycle.json` | `CreateFolder`, `CreateFileFromText`, `GetFileMetadata`, `UpdateFileOrFolder`, `FindFilesOrFolders`, `DeleteFileOrFolder` |
| `test-flow-drive-copy-move-share.json` | `CopyFile`, `MoveFileOrFolder`, `CreateShortcut`, `AddFileOrFolderPermission`, `MakeApiCall` |
| `test-flow-drive-download-upload.json` | `DownloadFile`, `UploadFile` |
| `test-flow-drive-new-file-trigger.json` | `NewFileOrFolder` |
| `test-flow-drive-updated-file-trigger.json` | `UpdatedFileOrFolder` |
| `test-flow-drive-deleted-file-trigger.json` | `DeletedFileOrFolder` |

`appmixer.google.drive.GooglePicker` is `private: true` (an inspector source
helper) and is deliberately not a flow node.

## Notes for whoever runs these

- **No tenant-bound values.** Every flow creates the files and folders it needs
  and deletes them again, so swapping the E2E account needs no edits. The
  triggers watch the whole drive (no `folder` property), for the same reason.
- **The trigger flows are provoke flows.** The trigger sits sourceless next to
  the `OnStart` lane; a `Wait 1m` lets the Drive change channel propagate before
  the provoking action runs. `AfterAll` uses a 420 s timeout — Drive change
  notifications routinely take minutes.
- **The deleted-file trigger trashes via `MakeApiCall`, not `DeleteFileOrFolder`.**
  `isDeletedFileOrFolder` needs `change.file`, and a *hard* delete
  (`drive.files.delete`) drops the file object from the change feed. Trashing
  (`PATCH /files/<id> {"trashed": true}`) keeps it, so that is the provoke; the
  hard delete happens after `AfterAll` as cleanup.
- **Run the trigger flows one at a time.** All three watch the entire drive, so
  files created by one flow show up in the others' change feeds.
- `FindFilesOrFolders` uses `outputType: "firstItem"` and an exact-name query
  scoped to the folder the flow just created, so the result is never empty. The
  `assert-field-on-dynamic-output` warning from `appmixer e2e validate` is
  expected: the rule only knows the `first` spelling of that mode, not Drive's
  `firstItem`.
