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

- **Import with an `appmixer:google:drive` account, not an `appmixer:google` one.**
  The drive components declare `auth.service: "appmixer:google:drive"`, but
  `appmixer e2e import -c google` resolves the connector-level `appmixer:google`
  service and binds an account from there. Nothing complains until the first
  authenticated call: `FindFilesOrFolders`' dynamic output port fails its
  variables fetch with `TokenError: Access token not found for component …`, so
  the import rejects `$.<find>.out.googleDriveFileMetadata` as an invalid
  variable. Pass the drive account explicitly:

  ```bash
  appmixer account ls --json          # pick the id whose service is appmixer:google:drive
  appmixer e2e import -c google -a <accountId>
  ```

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
- **Cleanup in the trigger flows consumes the trigger's output**, not the
  provoking action's. `AfterAll` forwards the scope of the message that
  completed it, which is always the trigger lane (the event arrives seconds to
  minutes after the provoke), so `$.<createFileFromText>.out…` is not resolvable
  there. Reading `$.<trigger>.out.googleDriveFileMetadata.id` also doubles as a
  proof that the trigger really fired.
- **The trigger lane is correlated to the file this run created.** The triggers
  watch the whole drive, so any activity on the E2E account would otherwise
  reach the trigger's `Assert` and, worse, the cleanup `DeleteFileOrFolder`
  would hard-delete whatever file the trigger happened to report. A `Condition`
  sits between the trigger and its `Assert` and passes only events whose
  `googleDriveFileMetadata.name` matches this flow's naming pattern
  (`^e2e-drive-new-\d+\.txt$`, `^e2e-drive-updated-\d+-renamed\.txt$`,
  `^e2e-drive-deleted-\d+\.txt$`); the `Assert` repeats the same regex. Events
  for other files are dropped at the `Condition`, so nothing downstream ever
  sees them.
- **Run the trigger flows one at a time.** All three watch the entire drive, so
  files created by one flow show up in the others' change feeds. The `Condition`
  keeps such events out of the asserts and cleanup, but every event still costs
  a `changes.list` round trip on each running trigger.
- `FindFilesOrFolders` uses `outputType: "firstItem"` and an exact-name query
  scoped to the folder the flow just created, so the result is never empty. The
  `assert-field-on-dynamic-output` warning from `appmixer e2e validate` is
  expected: the rule only knows the `first` spelling of that mode, not Drive's
  `firstItem`.
